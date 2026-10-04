const mongoose = require("mongoose");
const SeatCredit = require("./seatCredit.model");
const SeatPool = require("./seatPool.model");
const { makeLicensingError } = require("./licensing.errors");

function validateCredit({ quantity, source, referenceId }) {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity <= 0 ||
    !["clerk", "stripe"].includes(source) ||
    typeof referenceId !== "string" ||
    !referenceId.trim()
  ) {
    throw makeLicensingError(
      "Seat credits require a positive integer quantity, a valid source, and a nonempty reference ID.",
      400,
      "INVALID_SEAT_CREDIT",
    );
  }
}

async function addSeats({
  organizationId,
  quantity,
  source,
  referenceId,
  actor,
}) {
  validateCredit({ quantity, source, referenceId });
  if (!mongoose.isObjectIdOrHexString(organizationId) || !actor) {
    throw makeLicensingError(
      "Organization and actor are required.",
      400,
      "INVALID_SEAT_CREDIT",
    );
  }

  // Wait for the uniqueness constraints before accepting concurrent credits.
  await Promise.all([SeatCredit.init(), SeatPool.init()]);
  const key = { organization: organizationId, source, referenceId };

  // Mongo retries transient transaction failures. A simultaneous first insert
  // can instead raise E11000; retry in a fresh transaction to see the winner.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await mongoose.connection.transaction(
        async (session) => {
          const existing = await SeatCredit.findOne(key).session(session);
          if (existing) {
            if (existing.quantity !== quantity) {
              throw makeLicensingError(
                "This seat credit reference was already used with a different quantity. Use a new reference for an additional credit.",
                409,
                "SEAT_CREDIT_CONFLICT",
              );
            }
            const pool = await SeatPool.findOne({
              _id: existing.seatPoolId,
              organization: organizationId,
            }).session(session);
            return { duplicate: true, credit: existing, pool, quantity };
          }

          const Organization = require("../organizations/organization.model");
          if (
            !(await Organization.exists({ _id: organizationId }).session(
              session,
            ))
          ) {
            throw makeLicensingError(
              "Organization not found.",
              404,
              "ORGANIZATION_NOT_FOUND",
            );
          }
          const pool = await SeatPool.findOrCreateOrgSeatPool(
            organizationId,
            actor,
            { session },
          );
          const [credit] = await SeatCredit.create(
            [
              {
                ...key,
                quantity,
                seatPoolId: pool._id,
                createdBy: actor,
                updatedBy: actor,
              },
            ],
            { session },
          );
          const updatedPool = await SeatPool.findOneAndUpdate(
            {
              _id: pool._id,
              organization: organizationId,
              totalSeats: { $lte: Number.MAX_SAFE_INTEGER - quantity },
            },
            { $inc: { totalSeats: quantity }, $set: { updatedBy: actor } },
            { new: true, session },
          );
          if (!updatedPool) {
            throw makeLicensingError(
              "Seat balance exceeds the supported limit.",
              409,
              "SEAT_BALANCE_OVERFLOW",
            );
          }
          return { duplicate: false, credit, pool: updatedPool, quantity };
        },
        { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
      );
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error;
    }
  }
}

// Only call this with metadata obtained from a verified Clerk webhook or the
// backend Clerk SDK. Public/client-provided metadata must never grant seats.
async function applyClerkSeatGrant({
  organizationId,
  privateMetadata,
  actor = "clerk_webhook",
  dryRun = false,
}) {
  const grant = privateMetadata?.seatGrant;
  if (grant === undefined || grant === null) return { ignored: true };
  try {
    const credit = {
      organizationId,
      quantity: grant.quantity,
      source: "clerk",
      referenceId: grant.id,
      actor,
    };
    validateCredit(credit);
    if (dryRun)
      return { dryRun: true, referenceId: grant.id, quantity: grant.quantity };
    return await addSeats(credit);
  } catch (error) {
    if (!["INVALID_SEAT_CREDIT", "SEAT_CREDIT_CONFLICT"].includes(error.code))
      throw error;
    console.warn("Clerk seat grant skipped:", {
      organizationId: String(organizationId || ""),
      referenceId: typeof grant.id === "string" ? grant.id : undefined,
      code: error.code,
      message: error.message,
    });
    return { ignored: true, code: error.code };
  }
}

module.exports = { addSeats, applyClerkSeatGrant };
