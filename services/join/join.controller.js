const { ensureJoin } = require("./join.service");

/**
 * POST /v1/join  (also mounted at /api/join)
 *
 * Body: { orgId: string, classroomId: string }
 *
 * Guarantees on success:
 * - authenticated user
 * - classroom exists
 * - classroom belongs to orgId
 * - user is a Clerk member of orgId
 * - user is enrolled in classroomId (unique, idempotent)
 */
exports.join = async function join(req, res) {
  try {
    const { orgId, classroomId } = req.body || {};
    const clerkUserId = req.clerkUser?.id;
    const member = req.user;

    if (!clerkUserId || !member?._id) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!orgId || !classroomId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: orgId, classroomId",
      });
    }

    const { organization, classroom, enrollment } = await ensureJoin({
      orgId,
      classroomId,
      clerkUserId,
      member,
    });

    return res.status(200).json({
      success: true,
      data: {
        orgId,
        classroomId: classroom._id,
        organizationDbId: organization._id,
        enrollmentId: enrollment._id,
        enrollmentRole: enrollment.role,
      },
    });
  } catch (error) {
    console.error("Error in join:", {
      message: error?.message,
      status: error?.status,
      code: error?.errors?.[0]?.code,
      data: error?.errors,
    });

    if (error?.statusCode) {
      return res
        .status(error.statusCode)
        .json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to join classroom",
    });
  }
};


