const { clerkClient } = require("@clerk/express");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("./enrollment.model");
const Member = require("../members/member.model");
const SeatClaim = require("../licensing/seatClaim.model");
const OrgSeatReservation = require("../licensing/orgSeatReservation.model");
const RosterSeat = require("../licensing/rosterSeat.model");
const { makeTransferError } = require("./transfer.errors");

function getPrimaryEmail(member) {
  return String(member?.email || member?.maskedEmail || "")
    .trim()
    .toLowerCase();
}

async function releaseRosterSeatForClaim(claim, updatedBy) {
  if (!claim?.rosterSeatId) return;

  const rosterSeat = await RosterSeat.findById(claim.rosterSeatId);
  if (!rosterSeat) return;

  rosterSeat.status = "reserved";
  rosterSeat.claimedBy = undefined;
  rosterSeat.claimedAt = undefined;
  rosterSeat.updatedBy = updatedBy;
  await rosterSeat.save();
}

async function attachTargetRosterSeat({ claim, member, toClassroomId, updatedBy }) {
  const email = getPrimaryEmail(member);
  if (!email) return null;

  const rosterSeat = await RosterSeat.findReservableForEmail(
    toClassroomId,
    email
  );
  if (!rosterSeat) return null;

  rosterSeat.status = "claimed";
  rosterSeat.claimedBy = member._id;
  rosterSeat.claimedAt = new Date();
  rosterSeat.updatedBy = updatedBy;
  await rosterSeat.save();

  claim.rosterSeatId = rosterSeat._id;
  return rosterSeat;
}

async function updateStudentActiveClassroom({
  member,
  fromClassroomId,
  toClassroom,
  enrollmentRole,
}) {
  const activeId = member.activeClassroom?.classroomId?.toString?.();
  if (!activeId || activeId !== fromClassroomId.toString()) {
    return;
  }

  const activeClassroomData = {
    classroomId: toClassroom._id.toString(),
    classroomName: toClassroom.name,
    role: enrollmentRole,
    setAt: new Date().toISOString(),
  };

  member.activeClassroom = {
    classroomId: toClassroom._id,
    role: enrollmentRole,
    setAt: new Date(),
  };
  member.publicMetadata = {
    ...(member.publicMetadata || {}),
    activeClassroom: activeClassroomData,
  };
  await member.save();

  if (member.clerkUserId) {
    try {
      await clerkClient.users.updateUserMetadata(member.clerkUserId, {
        publicMetadata: member.publicMetadata,
      });
    } catch (error) {
      console.error(
        "Failed to sync transferred student active classroom to Clerk:",
        error.message
      );
    }
  }
}

/**
 * Move a student from one classroom to another within the same organization.
 * The student's active org seat claim moves with them (usedSeats unchanged).
 */
async function transferStudentBetweenClassrooms({
  organizationId,
  fromClassroomId,
  toClassroomId,
  userId,
  performedByClerkUserId,
}) {
  if (fromClassroomId.toString() === toClassroomId.toString()) {
    throw makeTransferError(
      "Source and target classrooms must be different.",
      400,
      "SAME_CLASSROOM"
    );
  }

  const [fromClassroom, toClassroom, member] = await Promise.all([
    Classroom.findOne({ _id: fromClassroomId, organization: organizationId }),
    Classroom.findOne({ _id: toClassroomId, organization: organizationId }),
    Member.findById(userId),
  ]);

  if (!fromClassroom) {
    throw makeTransferError("Source classroom not found.", 404, "SOURCE_NOT_FOUND");
  }
  if (!toClassroom) {
    throw makeTransferError("Target classroom not found.", 404, "TARGET_NOT_FOUND");
  }
  if (!toClassroom.isActive) {
    throw makeTransferError(
      "Target classroom is not active.",
      400,
      "TARGET_INACTIVE"
    );
  }
  if (!member) {
    throw makeTransferError("Student not found.", 404, "STUDENT_NOT_FOUND");
  }

  const sourceEnrollment = await Enrollment.findOne({
    classroomId: fromClassroomId,
    userId: member._id,
    isRemoved: false,
  });
  if (!sourceEnrollment) {
    throw makeTransferError(
      "Student is not enrolled in the source classroom.",
      404,
      "NOT_ENROLLED_IN_SOURCE"
    );
  }

  const existingTargetEnrollment = await Enrollment.findOne({
    classroomId: toClassroomId,
    userId: member._id,
    isRemoved: false,
  });
  if (existingTargetEnrollment) {
    throw makeTransferError(
      "Student is already enrolled in the target classroom.",
      409,
      "ALREADY_ENROLLED_IN_TARGET"
    );
  }

  const seatClaim = await SeatClaim.findActiveClaim(
    fromClassroomId,
    member._id
  );

  sourceEnrollment.softRemove();
  sourceEnrollment.updatedBy = performedByClerkUserId;
  await sourceEnrollment.save();

  let targetEnrollment = await Enrollment.findOne({
    classroomId: toClassroomId,
    userId: member._id,
  });

  if (targetEnrollment?.isRemoved) {
    targetEnrollment.restore();
    targetEnrollment.role = "member";
    targetEnrollment.organization = organizationId;
    targetEnrollment.updatedBy = performedByClerkUserId;
    await targetEnrollment.save();
  } else if (!targetEnrollment) {
    targetEnrollment = await Enrollment.enrollUser(
      toClassroomId,
      member._id,
      "member",
      organizationId,
      performedByClerkUserId
    );
  }

  let transferredSeat = null;
  if (seatClaim) {
    await releaseRosterSeatForClaim(seatClaim, performedByClerkUserId);

    seatClaim.classroomId = toClassroom._id;
    seatClaim.rosterSeatId = undefined;
    seatClaim.updatedBy = performedByClerkUserId;
    seatClaim.metadata = {
      ...(seatClaim.metadata || {}),
      transferredFrom: fromClassroomId.toString(),
      transferredAt: new Date().toISOString(),
      transferredBy: performedByClerkUserId,
    };

    await attachTargetRosterSeat({
      claim: seatClaim,
      member,
      toClassroomId: toClassroom._id,
      updatedBy: performedByClerkUserId,
    });

    await seatClaim.save();

    if (seatClaim.orgSeatReservationId) {
      await OrgSeatReservation.findByIdAndUpdate(seatClaim.orgSeatReservationId, {
        $set: {
          claimedClassroomId: toClassroom._id,
          updatedBy: performedByClerkUserId,
        },
      });
    } else {
      await OrgSeatReservation.findOneAndUpdate(
        {
          organization: organizationId,
          claimedBy: member._id,
          status: "claimed",
          claimedClassroomId: fromClassroomId,
        },
        {
          $set: {
            claimedClassroomId: toClassroom._id,
            updatedBy: performedByClerkUserId,
          },
        }
      );
    }

    transferredSeat = seatClaim;
  }

  await updateStudentActiveClassroom({
    member,
    fromClassroomId,
    toClassroom,
    enrollmentRole: targetEnrollment.role,
  });

  return {
    fromClassroomId,
    toClassroomId,
    userId: member._id,
    enrollment: targetEnrollment,
    seatClaim: transferredSeat,
  };
}

module.exports = {
  transferStudentBetweenClassrooms,
};
