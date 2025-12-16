const Enrollment = require("../enrollment.model");
const Classroom = require("../../classroom/classroom.model");
const Member = require("../../members/member.model");

/**
 * Enrollment Service - Business logic layer
 * Handles all enrollment-related operations
 */

class EnrollmentService {
  /**
   * Enroll a user into a class
   * @param {string} classId - Class ID
   * @param {string} userId - Member ID (ObjectId)
   * @param {string} role - Role ("admin" or "member")
   * @param {string} organizationId - Organization ID
   * @param {string} clerkUserId - Clerk user ID for createdBy/updatedBy
   * @returns {Promise<Object>} Enrollment document
   */
  async enrollUser(
    classId,
    userId,
    role = "member",
    organizationId,
    clerkUserId
  ) {
    // Check if already enrolled
    const existing = await Enrollment.findByClassAndUser(classId, userId);
    if (existing) {
      if (existing.isRemoved) {
        // Restore enrollment
        existing.restore();
        existing.role = role; // Update role if changed
        existing.updatedBy = clerkUserId;
        await existing.save();
        return existing;
      }
      throw new Error("User is already enrolled in this class");
    }

    // Create new enrollment
    const enrollment = new Enrollment({
      classId,
      userId,
      role,
      joinedAt: new Date(),
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await enrollment.save();
    return enrollment;
  }

  /**
   * Check if user is enrolled in a class
   * @param {string} classId - Class ID
   * @param {string} userId - Member ID
   * @returns {Promise<boolean>} True if enrolled
   */
  async isUserEnrolled(classId, userId) {
    const enrollment = await Enrollment.findByClassAndUser(classId, userId);
    return !!enrollment;
  }

  /**
   * Get user's role in a class
   * @param {string} classId - Class ID
   * @param {string} userId - Member ID
   * @returns {Promise<string|null>} Role ("admin" or "member") or null if not enrolled
   */
  async getUserRole(classId, userId) {
    const enrollment = await Enrollment.findByClassAndUser(classId, userId);
    return enrollment ? enrollment.role : null;
  }

  /**
   * Require admin role - throws error if user is not admin
   * @param {string} classId - Class ID
   * @param {string} userId - Member ID
   * @returns {Promise<void>} Throws error if not admin
   */
  async requireAdmin(classId, userId) {
    const role = await this.getUserRole(classId, userId);
    if (role !== "admin") {
      throw new Error("Insufficient permissions: Admin access required");
    }
  }

  /**
   * Get class roster
   * @param {string} classId - Class ID
   * @returns {Promise<Array>} Roster array with user info
   */
  async getClassRoster(classId) {
    const enrollments = await Enrollment.findByClass(classId).populate({
      path: "userId",
      select: "firstName lastName clerkUserId",
    });

    return enrollments.map((enrollment) => {
      const member = enrollment.userId;
      const displayName = member
        ? `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
          "Unknown"
        : "Unknown";

      return {
        enrollmentId: enrollment._id,
        userId: member?._id,
        clerkUserId: member?.clerkUserId,
        displayName,
        firstName: member?.firstName || "",
        lastName: member?.lastName || "",
        role: enrollment.role,
        joinedAt: enrollment.joinedAt,
      };
    });
  }

  /**
   * Remove enrollment (soft delete)
   * @param {string} classId - Class ID
   * @param {string} userId - Member ID
   * @param {string} clerkUserId - Clerk user ID for updatedBy
   * @returns {Promise<Object>} Updated enrollment
   */
  async removeEnrollment(classId, userId, clerkUserId) {
    const enrollment = await Enrollment.findOne({
      classId,
      userId,
      isRemoved: false,
    });

    if (!enrollment) {
      throw new Error("Enrollment not found");
    }

    enrollment.softRemove();
    enrollment.updatedBy = clerkUserId;
    await enrollment.save();

    return enrollment;
  }

  /**
   * Get enrollment by class and user
   * @param {string} classId - Class ID
   * @param {string} userId - Member ID
   * @returns {Promise<Object|null>} Enrollment or null
   */
  async getEnrollment(classId, userId) {
    return await Enrollment.findByClassAndUser(classId, userId);
  }

  /**
   * Count enrollments for a class
   * @param {string} classId - Class ID
   * @returns {Promise<number>} Count of active enrollments
   */
  async countByClass(classId) {
    return await Enrollment.countByClass(classId);
  }

  /**
   * Get enrollments by user
   * @param {string} userId - Member ID
   * @param {Object} options - Options (includeRemoved)
   * @returns {Promise<Array>} Array of enrollments
   */
  async getEnrollmentsByUser(userId, options = {}) {
    return await Enrollment.findByUser(userId, options);
  }

  /**
   * Get enrollments by class and role
   * @param {string} classId - Class ID
   * @param {string} role - Role ("admin" or "member")
   * @returns {Promise<Array>} Array of enrollments
   */
  async getEnrollmentsByClassAndRole(classId, role) {
    return await Enrollment.findByClassAndRole(classId, role);
  }
}

module.exports = new EnrollmentService();
