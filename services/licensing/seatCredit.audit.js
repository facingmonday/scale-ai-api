// Read collections directly so the preflight cannot create indexes or documents.
async function auditSeatCredits(connection) {
  const db = connection.db;
  const hello = await db.admin().command({ hello: 1 });
  const supportsRequiredMongoVersion = hello.maxWireVersion >= 17; // MongoDB 6+
  let transactionsSupported = false;
  let transactionError = "ReplicaSetOrShardedClusterRequired";
  if (
    (hello.setName || hello.msg === "isdbgrid") &&
    hello.logicalSessionTimeoutMinutes != null
  ) {
    const session = await connection.startSession();
    try {
      session.startTransaction({ readConcern: { level: "snapshot" } });
      await db
        .collection("seatpools")
        .findOne({}, { session, projection: { _id: 1 } });
      await session.commitTransaction();
      transactionsSupported = true;
      transactionError = null;
    } catch (error) {
      transactionError = error.codeName || error.name;
      if (session.inTransaction()) await session.abortTransaction();
    } finally {
      await session.endSession();
    }
  }

  const duplicateActivePools = await db
    .collection("seatpools")
    .aggregate([
      {
        $match: { planKey: "org_seats", status: { $in: ["active", "manual"] } },
      },
      {
        $group: {
          _id: "$organization",
          count: { $sum: 1 },
          pools: {
            $push: {
              id: "$_id",
              totalSeats: "$totalSeats",
              usedSeats: "$usedSeats",
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  const duplicateActiveReservations = await db
    .collection("orgseatreservations")
    .aggregate([
      { $match: { status: { $in: ["reserved", "claimed"] } } },
      {
        $group: {
          _id: { organization: "$organization", email: "$email" },
          count: { $sum: 1 },
          reservations: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
      {
        $project: {
          _id: 0,
          organization: "$_id.organization",
          count: 1,
          reservations: 1,
        },
      },
    ])
    .toArray();

  const unfinishedPurchases = await db
    .collection("stripecheckoutrecords")
    .aggregate([
      { $match: { type: "org_seats", status: { $ne: "completed" } } },
      {
        $lookup: {
          from: "seatcredits",
          let: {
            organization: "$organization",
            referenceId: "$stripeSessionId",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$organization", "$$organization"] },
                    { $eq: ["$referenceId", "$$referenceId"] },
                    { $eq: ["$source", "stripe"] },
                  ],
                },
              },
            },
          ],
          as: "credits",
        },
      },
      {
        $project: {
          _id: 1,
          organization: 1,
          stripeSessionId: 1,
          status: 1,
          quantity: 1,
          creditQuantity: { $arrayElemAt: ["$credits.quantity", 0] },
        },
      },
    ])
    .toArray();
  const requiresReconciliation = unfinishedPurchases.filter(
    (purchase) => purchase.creditQuantity !== purchase.quantity,
  );
  return {
    database: db.databaseName,
    supportsRequiredMongoVersion,
    transactionsSupported,
    transactionError,
    duplicateActivePools,
    duplicateActiveReservations,
    requiresReconciliation,
    retryableCreditedPurchases: unfinishedPurchases.filter(
      (purchase) => purchase.creditQuantity === purchase.quantity,
    ),
    ready:
      supportsRequiredMongoVersion &&
      transactionsSupported &&
      duplicateActivePools.length === 0 &&
      duplicateActiveReservations.length === 0 &&
      requiresReconciliation.length === 0,
  };
}

module.exports = { auditSeatCredits };
