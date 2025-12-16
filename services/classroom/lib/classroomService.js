const Classroom = require("../classroom.model");
const enrollmentService = require("../../enrollment/lib/enrollmentService");

/**
 * Classroom Service - Business logic layer
 * Handles complex operations and data aggregation for classrooms
 */

class ClassroomService {
  /**
   * Get dashboard data for a class
   * @param {string} classId - Class ID
   * @param {string} organizationId - Organization ID for scoping
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboard(classId, organizationId) {
    const classDoc = await Classroom.findOne({
      _id: classId,
      organization: organizationId,
    });

    if (!classDoc) {
      throw new Error("Class not found");
    }

    // Count students (members with role 'member')
    const studentCount = await enrollmentService.countByClass(classId);

    // Get active scenario (placeholder - will be implemented when Scenario service exists)
    const activeScenario = null; // TODO: Implement when Scenario model exists

    // Count completed submissions (placeholder - will be implemented when Submission service exists)
    const submissionsCompleted = 0; // TODO: Implement when Submission model exists

    // Get leaderboard top 3 (placeholder - will be implemented when Ledger service exists)
    const leaderboardTop3 = []; // TODO: Implement when Ledger model exists

    // Get pending approvals (placeholder - will be implemented when Scenario service exists)
    const pendingApprovals = 0; // TODO: Implement when Scenario model exists

    return {
      className: classDoc.name,
      classDescription: classDoc.description,
      isActive: classDoc.isActive,
      students: studentCount,
      activeScenario: activeScenario,
      submissionsCompleted: submissionsCompleted,
      leaderboardTop3: leaderboardTop3,
      pendingApprovals: pendingApprovals,
    };
  }

  /**
   * Get roster for a class
   * @param {string} classId - Class ID
   * @param {string} organizationId - Organization ID for scoping
   * @returns {Promise<Array>} Roster data with student info
   * @deprecated Use enrollmentService.getClassRoster() instead
   */
  async getRoster(classId, organizationId) {
    const classDoc = await Classroom.findOne({
      _id: classId,
      organization: organizationId,
    });

    if (!classDoc) {
      throw new Error("Class not found");
    }

    // Delegate to enrollment service
    return await enrollmentService.getClassRoster(classId);
  }

  /**
   * Validate admin access to a class
   * @param {string} classId - Class ID
   * @param {string} clerkUserId - Clerk user ID
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Class document if admin, throws error otherwise
   */
  async validateAdminAccess(classId, clerkUserId, organizationId) {
    const classDoc = await Classroom.findOne({
      _id: classId,
      organization: organizationId,
    });

    if (!classDoc) {
      throw new Error("Class not found");
    }

    if (!classDoc.isAdmin(clerkUserId)) {
      throw new Error("Insufficient permissions: Admin access required");
    }

    return classDoc;
  }

  /**
   * Generate join link for a class
   * @param {string} classId - Class ID
   * @returns {string} Join link URL
   */
  generateJoinLink(classId) {
    const baseUrl = process.env.SCALE_API_HOST || "http://localhost:1337";
    const apiVersion = process.env.SCALE_API_VERSION || "v1";
    return `${baseUrl}/${apiVersion}/class/${classId}/join`;
  }
}

module.exports = new ClassroomService();

