const Classroom = require("./classroom.model");
const Member = require("../members/member.model");
const Enrollment = require("../enrollment/enrollment.model");
const { sendEmail } = require("../../lib/sendGrid/sendEmail");

/**
 * Create a new class
 * POST /api/admin/class
 */
exports.createClass = async function (req, res) {
  try {
    const { name, description } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!name) {
      return res.status(400).json({ error: "Class name is required" });
    }

    // Create classroom
    const newClassroom = new Classroom({
      name,
      description: description || "",
      isActive: true,
      adminIds: [clerkUserId], // Auto-enroll creator as admin
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await newClassroom.save();

    // Auto-enroll creator as admin enrollment using Enrollment model
    const member = await Member.findOne({ clerkUserId });
    if (member) {
      await Enrollment.enrollUser(
        newClassroom._id,
        member._id,
        "admin",
        organizationId,
        clerkUserId
      );
    }

    res.status(201).json({
      success: true,
      data: newClassroom,
    });
  } catch (error) {
    console.error("Error creating class:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get class dashboard
 * GET /api/admin/class/:classId/dashboard
 */
exports.getClassDashboard = async function (req, res) {
  try {
    const { classId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Validate admin access
    await Classroom.validateAdminAccess(classId, clerkUserId, organizationId);

    // Get dashboard data
    const dashboard = await Classroom.getDashboard(classId, organizationId);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Error getting class dashboard:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all classrooms
 * GET /api/admin/class
 */
exports.getAllClassrooms = async function (req, res) {
  try {
    const classrooms = await Classroom.find({
      organization: req.organization._id,
    });
    res.json({
      success: true,
      data: classrooms,
    });
  } catch (error) {
    console.error("Error getting all classrooms:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Invite student to class
 * POST /api/admin/class/:classId/invite
 */
exports.inviteStudent = async function (req, res) {
  try {
    const { classId } = req.params;
    const { email } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Validate admin access
    const classDoc = await Classroom.validateAdminAccess(
      classId,
      clerkUserId,
      organizationId
    );

    // Generate join link
    const joinLink = Classroom.generateJoinLink(classId);

    // Get sender info
    const senderMember = await Member.findOne({ clerkUserId });
    const senderEmail = await senderMember?.getEmailFromClerk();

    // Send invitation email via SendGrid
    try {
      await sendEmail({
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || "noreply@scale.ai",
          name: process.env.SENDGRID_FROM_NAME || "SCALE.ai",
        },
        subject: `Invitation to join ${classDoc.name}`,
        html: `
          <h2>You've been invited to join ${classDoc.name}</h2>
          <p>${classDoc.description || "Join this class to get started."}</p>
          <p><a href="${joinLink}">Click here to join the class</a></p>
          <p>Or copy this link: ${joinLink}</p>
        `,
        text: `You've been invited to join ${classDoc.name}. Join here: ${joinLink}`,
      });

      res.json({
        success: true,
        message: "Invitation sent successfully",
        data: {
          email,
          joinLink,
        },
      });
    } catch (emailError) {
      console.error("Error sending invitation email:", emailError);
      // Still return success with join link if email fails
      res.json({
        success: true,
        message: "Join link generated (email may have failed)",
        data: {
          email,
          joinLink,
        },
      });
    }
  } catch (error) {
    console.error("Error inviting student:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
