const Classroom = require("../classroom/classroom.model");
const RosterSeat = require("./rosterSeat.model");
const SeatClaim = require("./seatClaim.model");
const SeatPool = require("./seatPool.model");
const OrgSeatReservation = require("./orgSeatReservation.model");
const Enrollment = require("../enrollment/enrollment.model");
const Member = require("../members/member.model");
const {
  createOrgSeatCheckoutSession,
  createStudentSeatCheckoutSession,
  getStripeClient,
} = require("../stripe/stripe.service");
const { isStripeConfigured } = require("../stripe/stripe.config");
const {
  processCheckoutSessionCompleted,
} = require("../stripe/stripe.webhook.service");
const StripeCheckoutRecord = require("./stripeCheckoutRecord.model");
const { PLAN_CATALOG, PLAN_KEYS } = require("./planCatalog");

function getClerkPrimaryEmail(clerkUser) {
  const primaryEmailObj = clerkUser?.emailAddresses?.find(
    (email) => email.id === clerkUser?.primaryEmailAddressId,
  );
  return primaryEmailObj?.emailAddress;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseRosterCsv(csv) {
  const lines = String(csv || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.trim().toLowerCase(),
  );
  const rows = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push({
      email: row.email || row["email address"] || "",
      studentId: row.studentid || row.student_id || row["student id"] || "",
      firstName: row.firstname || row.first_name || row["first name"] || "",
      lastName: row.lastname || row.last_name || row["last name"] || "",
      section: row.section || row.group || "",
    });
  }

  return rows;
}

exports.getPlans = async function getPlans(req, res) {
  return res.json({
    success: true,
    data: PLAN_CATALOG,
  });
};

exports.getSummary = async function getSummary(req, res, next) {
  try {
    const data = await SeatPool.getBillingSummary({
      user: req.user,
      organization: req.organization,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getClassroomSummary = async function getClassroomSummary(
  req,
  res,
  next,
) {
  try {
    const { classroomId } = req.params;
    const classroom = await Classroom.validateAdminAccess(
      classroomId,
      req.clerkUser.id,
      req.organization._id,
    );
    const summary = await Classroom.getClassroomSeatSummary(classroom._id);
    return res.json({
      success: true,
      data: {
        classroom: {
          _id: classroom._id,
          name: classroom.name,
          joinPolicy: classroom.joinPolicy,
          allowedDomains: classroom.allowedDomains || [],
          allowAnonymousJoin: classroom.allowAnonymousJoin !== false,
        },
        ...summary,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.importRoster = async function importRoster(req, res, next) {
  try {
    const { classroomId } = req.params;
    const { csv, rows } = req.body || {};

    const classroom = await Classroom.validateAdminAccess(
      classroomId,
      req.clerkUser.id,
      req.organization._id,
    );

    const parsedRows = Array.isArray(rows) ? rows : parseRosterCsv(csv);
    const normalizedRows = parsedRows.map((row) => ({
      email: String(row.email || "")
        .trim()
        .toLowerCase(),
      studentId: String(row.studentId || row.student_id || "").trim(),
      firstName: String(row.firstName || row.first_name || "").trim(),
      lastName: String(row.lastName || row.last_name || "").trim(),
      section: String(row.section || row.group || "").trim(),
    }));

    const validRows = normalizedRows.filter((row) => row.email.includes("@"));
    const invalidRows = normalizedRows.filter(
      (row) => !row.email.includes("@"),
    );

    const upserted = [];
    for (const row of validRows) {
      const doc = await RosterSeat.findOneAndUpdate(
        {
          classroomId: classroom._id,
          email: row.email,
        },
        {
          $set: {
            ...row,
            status: "reserved",
            organization: classroom.organization,
            updatedBy: req.clerkUser.id,
          },
          $setOnInsert: {
            createdBy: req.clerkUser.id,
          },
        },
        { new: true, upsert: true },
      );
      upserted.push(doc);
    }

    return res.status(200).json({
      success: true,
      data: {
        imported: upserted.length,
        invalid: invalidRows.length,
        rows: upserted,
        invalidRows,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getRosterSeats = async function getRosterSeats(req, res, next) {
  try {
    const { classroomId } = req.params;
    await Classroom.validateAdminAccess(
      classroomId,
      req.clerkUser.id,
      req.organization._id,
    );

    const seats = await RosterSeat.find({
      classroomId,
    }).sort({ status: 1, email: 1 });

    return res.json({ success: true, data: seats });
  } catch (error) {
    return next(error);
  }
};

exports.createStudentCheckout = async function createStudentCheckout(
  req,
  res,
  next,
) {
  try {
    const { classroomId } = req.body || {};
    if (!classroomId) {
      return res.status(400).json({
        success: false,
        error: "classroomId is required",
      });
    }

    if (!isStripeConfigured()) {
      return res.status(501).json({
        success: false,
        error: "Stripe checkout is not configured.",
      });
    }

    const classroom = await Classroom.findOne({
      _id: classroomId,
      organization: req.organization._id,
    });

    if (!classroom) {
      return res.status(404).json({
        success: false,
        error: "Classroom not found",
      });
    }

    const session = await createStudentSeatCheckoutSession({
      organization: req.organization,
      member: req.user,
      classroom,
      customerEmail: getClerkPrimaryEmail(req.clerkUser),
    });

    return res.json({
      success: true,
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
        planKey: PLAN_KEYS.STUDENT_CLASS_PASS,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.createOrgCheckout = async function createOrgCheckout(req, res, next) {
  try {
    const { quantity } = req.body || {};
    const seatCount = Math.max(Number(quantity || 1), 1);

    if (!isStripeConfigured()) {
      return res.status(501).json({
        success: false,
        error: "Stripe checkout is not configured.",
      });
    }

    const session = await createOrgSeatCheckoutSession({
      organization: req.organization,
      member: req.user,
      quantity: seatCount,
      customerEmail: getClerkPrimaryEmail(req.clerkUser),
    });

    return res.json({
      success: true,
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
        planKey: PLAN_KEYS.ORG_SEATS,
        quantity: seatCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getStudentCheckoutStatus = async function getStudentCheckoutStatus(
  req,
  res,
  next,
) {
  try {
    const sessionId = String(req.query.sessionId || "");
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "sessionId is required",
      });
    }

    if (!isStripeConfigured()) {
      return res.status(501).json({
        success: false,
        error: "Stripe checkout is not configured.",
      });
    }

    const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
    const metadata = session.metadata || {};
    const isOwnedStudentCheckout =
      metadata.type === "student_seat" &&
      String(metadata.organizationId || "") === String(req.organization._id) &&
      String(metadata.purchaserUserId || "") === String(req.user._id);

    if (!isOwnedStudentCheckout) {
      return res.status(404).json({
        success: false,
        error: "Checkout session not found",
      });
    }

    if (session.payment_status !== "paid") {
      return res.json({
        success: true,
        data: {
          status: "pending",
          paymentStatus: session.payment_status || "unpaid",
        },
      });
    }

    let record = await StripeCheckoutRecord.findOne({
      stripeSessionId: session.id,
      organization: req.organization._id,
      purchaserUserId: req.user._id,
      type: "student_seat",
    });

    if (record?.status !== "completed") {
      // Stripe normally invokes this through the webhook endpoint. Replaying the
      // same idempotent handler here recovers a delayed or failed delivery.
      const result = await processCheckoutSessionCompleted(session);
      record = result.record;
    }

    return res.json({
      success: true,
      data: {
        status: "completed",
        paymentStatus: session.payment_status,
        processedAt: record?.processedAt || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getStudentAccess = async function getStudentAccess(req, res, next) {
  try {
    const claims = await SeatClaim.find({
      organization: req.organization._id,
      userId: req.user._id,
      status: { $in: ["active", "held"] },
    })
      .populate("classroomId", "name description")
      .populate("seatPoolId", "planKey status")
      .sort({ claimedAt: -1 });

    return res.json({ success: true, data: claims });
  } catch (error) {
    return next(error);
  }
};

exports.getSeatPools = async function getSeatPools(req, res, next) {
  try {
    const pool = await SeatPool.findOrCreateOrgSeatPool(
      req.organization,
      req.clerkUser.id,
    );
    return res.json({ success: true, data: [pool] });
  } catch (error) {
    return next(error);
  }
};

exports.getSeatReservations = async function getSeatReservations(req, res, next) {
  try {
    const reservations = await OrgSeatReservation.listReservations(req.organization._id);
    return res.json({ success: true, data: reservations });
  } catch (error) {
    return next(error);
  }
};

exports.createSeatReservation = async function createSeatReservation(
  req,
  res,
  next,
) {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "email is required",
      });
    }

    const reservation = await OrgSeatReservation.createReservation({
      organization: req.organization,
      email,
      createdBy: req.clerkUser.id,
    });

    return res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    return next(error);
  }
};

exports.revokeSeatReservation = async function revokeSeatReservation(
  req,
  res,
  next,
) {
  try {
    const { id } = req.params;
    const reservation = await OrgSeatReservation.revokeReservation({
      organization: req.organization,
      reservationId: id,
      updatedBy: req.clerkUser.id,
    });

    return res.json({ success: true, data: reservation });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    return next(error);
  }
};

exports.grantSeat = async function grantSeat(req, res, next) {
  try {
    const { userId, classroomId, source, reason } = req.body || {};

    if (!userId || !classroomId) {
      return res.status(400).json({
        success: false,
        error: "userId and classroomId are required",
      });
    }

    const classroom = await Classroom.validateAdminAccess(
      classroomId,
      req.clerkUser.id,
      req.organization._id
    );

    const member = await Member.findById(userId);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
      });
    }

    const result = await Enrollment.grantOrgSeatAndEnroll({
      classroom,
      organization: req.organization,
      member,
      source,
      reason,
      grantedBy: req.clerkUser.id,
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    return next(error);
  }
};
