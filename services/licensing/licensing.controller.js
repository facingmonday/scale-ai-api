const Classroom = require("../classroom/classroom.model");
const RosterSeat = require("./rosterSeat.model");
const SeatPool = require("./seatPool.model");
const SeatClaim = require("./seatClaim.model");
const ClassroomSeatAllocation = require("./classroomSeatAllocation.model");
const {
  PLAN_CATALOG,
  PLAN_KEYS,
} = require("./planCatalog");
const {
  getBillingSummary,
  getClassroomSeatSummary,
  createManualSeatPool,
  allocateSeatsToClassroom,
} = require("./licensing.service");

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
    header.trim().toLowerCase()
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
    const data = await getBillingSummary({
      user: req.user,
      organization: req.organization,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

exports.getClassroomSummary = async function getClassroomSummary(req, res, next) {
  try {
    const { classroomId } = req.params;
    const classroom = await Classroom.validateAdminAccess(
      classroomId,
      req.clerkUser.id,
      req.organization._id
    );
    const summary = await getClassroomSeatSummary(classroom._id);
    return res.json({
      success: true,
      data: {
        classroom: {
          _id: classroom._id,
          name: classroom.name,
          billingMode: classroom.billingMode,
          joinPolicy: classroom.joinPolicy,
          studentPaysAllowed: classroom.studentPaysAllowed,
          allowedDomains: classroom.allowedDomains || [],
        },
        ...summary,
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.createManualSeatPool = async function createManualSeatPoolController(
  req,
  res,
  next
) {
  try {
    const { planKey = PLAN_KEYS.TEACHER_SEAT_PACK_30, totalSeats } =
      req.body || {};
    const pool = await createManualSeatPool({
      organization: req.organization,
      purchaserUserId: req.user._id,
      planKey,
      totalSeats,
      createdBy: req.clerkUser.id,
    });
    return res.status(201).json({ success: true, data: pool });
  } catch (error) {
    return next(error);
  }
};

exports.allocateSeats = async function allocateSeats(req, res, next) {
  try {
    const { classroomId } = req.params;
    const { seatPoolId, seatsAllocated, mode } = req.body || {};
    const classroom = await Classroom.validateAdminAccess(
      classroomId,
      req.clerkUser.id,
      req.organization._id
    );

    const allocation = await allocateSeatsToClassroom({
      classroom,
      seatPoolId,
      seatsAllocated: Number(seatsAllocated || 0),
      mode,
      createdBy: req.clerkUser.id,
    });

    return res.status(201).json({ success: true, data: allocation });
  } catch (error) {
    return next(error);
  }
};

exports.importRoster = async function importRoster(req, res, next) {
  try {
    const { classroomId } = req.params;
    const {
      csv,
      rows,
      reserveSeats = false,
      allocationId = null,
    } = req.body || {};

    const classroom = await Classroom.validateAdminAccess(
      classroomId,
      req.clerkUser.id,
      req.organization._id
    );

    const parsedRows = Array.isArray(rows) ? rows : parseRosterCsv(csv);
    const normalizedRows = parsedRows.map((row) => ({
      email: String(row.email || "").trim().toLowerCase(),
      studentId: String(row.studentId || row.student_id || "").trim(),
      firstName: String(row.firstName || row.first_name || "").trim(),
      lastName: String(row.lastName || row.last_name || "").trim(),
      section: String(row.section || row.group || "").trim(),
    }));

    const validRows = normalizedRows.filter((row) => row.email.includes("@"));
    const invalidRows = normalizedRows.filter((row) => !row.email.includes("@"));

    let allocation = null;
    if (reserveSeats && allocationId) {
      allocation = await ClassroomSeatAllocation.findOne({
        _id: allocationId,
        classroomId: classroom._id,
        status: "active",
      });
      if (!allocation) {
        return res.status(400).json({
          success: false,
          error: "Allocation not found for roster seat reservation",
        });
      }
    }

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
            allocationId: reserveSeats ? allocation?._id : null,
            status: "reserved",
            organization: classroom.organization,
            updatedBy: req.clerkUser.id,
          },
          $setOnInsert: {
            createdBy: req.clerkUser.id,
          },
        },
        { new: true, upsert: true }
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
    const classroom = await Classroom.validateAdminAccess(
      classroomId,
      req.clerkUser.id,
      req.organization._id
    );

    const seats = await RosterSeat.find({
      classroomId: classroom._id,
    }).sort({ status: 1, email: 1 });

    return res.json({ success: true, data: seats });
  } catch (error) {
    return next(error);
  }
};

exports.createStudentCheckout = async function createStudentCheckout(
  req,
  res,
  next
) {
  try {
    const { classroomId } = req.body || {};
    if (!classroomId) {
      return res.status(400).json({
        success: false,
        error: "classroomId is required",
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

    const checkoutBaseUrl = process.env.CLERK_STUDENT_CLASS_PASS_CHECKOUT_URL;
    if (!checkoutBaseUrl) {
      return res.status(501).json({
        success: false,
        error:
          "Student checkout is not configured. Set CLERK_STUDENT_CLASS_PASS_CHECKOUT_URL.",
        data: {
          planKey: PLAN_KEYS.STUDENT_CLASS_PASS,
          classroomId,
        },
      });
    }

    const checkoutUrl = new URL(checkoutBaseUrl);
    checkoutUrl.searchParams.set("plan", PLAN_KEYS.STUDENT_CLASS_PASS);
    checkoutUrl.searchParams.set("classroomId", classroom._id.toString());
    checkoutUrl.searchParams.set("orgId", req.organization.clerkOrganizationId);

    return res.json({
      success: true,
      data: {
        checkoutUrl: checkoutUrl.toString(),
        planKey: PLAN_KEYS.STUDENT_CLASS_PASS,
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
    })
      .populate("classroomId", "name description billingMode")
      .populate("seatPoolId", "planKey status")
      .sort({ claimedAt: -1 });

    return res.json({ success: true, data: claims });
  } catch (error) {
    return next(error);
  }
};

exports.getSeatPools = async function getSeatPools(req, res, next) {
  try {
    const pools = await SeatPool.find({
      organization: req.organization._id,
    }).sort({ createdDate: -1 });
    return res.json({ success: true, data: pools });
  } catch (error) {
    return next(error);
  }
};
