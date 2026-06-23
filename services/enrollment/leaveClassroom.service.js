const { clerkClient } = require("@clerk/express");
const Enrollment = require("./enrollment.model");
const Member = require("../members/member.model");
const { releaseSeatOnRemoval } = require("../licensing/seatLifecycle.service");
const { makeLeaveError } = require("./leave.errors");

async function clearActiveClassroomForMember({ member, classroomId }) {
  const activeId = member.activeClassroom?.classroomId?.toString?.();
  if (!activeId || activeId !== classroomId.toString()) {
    return;
  }

  member.activeClassroom = undefined;
  member.publicMetadata = {
    ...(member.publicMetadata || {}),
    activeClassroom: undefined,
  };
  await member.save();

  if (member.clerkUserId) {
    try {
      await clerkClient.users.updateUserMetadata(member.clerkUserId, {
        publicMetadata: member.publicMetadata,
      });
    } catch (error) {
      console.error(
        "Failed to clear active classroom from Clerk metadata:",
        error.message
      );
    }
  }
}

async function leaveClassroom({
  classroomId,
  userId,
  organizationId,
  updatedBy,
  allowAdminEnrollment = false,
}) {
  const enrollment = await Enrollment.findByClassAndUser(classroomId, userId);
  if (!enrollment) {
    throw makeLeaveError("Enrollment not found.", 404, "NOT_ENROLLED");
  }

  if (!allowAdminEnrollment && enrollment.role === "admin") {
    throw makeLeaveError(
      "Classroom admins cannot leave via this action.",
      403,
      "ADMIN_CANNOT_LEAVE"
    );
  }

  const member = await Member.findById(userId);

  const removedEnrollment = await Enrollment.removeEnrollment(
    classroomId,
    userId,
    updatedBy
  );

  const seatRelease = await releaseSeatOnRemoval({
    classroomId,
    userId,
    organizationId,
    updatedBy,
  });

  if (member) {
    await clearActiveClassroomForMember({ member, classroomId });
  }

  return {
    enrollment: removedEnrollment,
    seatRelease,
  };
}

module.exports = {
  clearActiveClassroomForMember,
  leaveClassroom,
};
