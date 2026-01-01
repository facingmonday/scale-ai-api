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
    const { name, description, seedSubmissionVariables } = req.body;
    const memberId = req.user._id;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!memberId || !organizationId) {
      return res.status(404).json({ error: "Member not found" });
    }

    if (!name) {
      return res.status(400).json({ error: "Class name is required" });
    }

    // Create classroom
    const newClassroom = new Classroom({
      name,
      description: description || "",
      isActive: true,
      adminIds: [clerkUserId], // Auto-enroll creator as admin
      ownership: memberId, // Set ownership to the creator
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await newClassroom.save();

    // Auto-enroll creator as admin enrollment using Enrollment model
    await Enrollment.enrollUser(
      newClassroom._id,
      memberId,
      "admin",
      organizationId,
      clerkUserId
    );

    // Optionally seed submission variables
    let submissionVariablesStats = null;
    if (seedSubmissionVariables) {
      try {
        submissionVariablesStats = await Classroom.seedSubmissionVariables(
          newClassroom._id,
          organizationId,
          clerkUserId
        );
      } catch (seedError) {
        // Log error but don't fail the classroom creation
        console.error(
          "Error seeding submission variables for new classroom:",
          seedError
        );
      }
    }

    res.status(201).json({
      success: true,
      data: newClassroom,
      ...(submissionVariablesStats && {
        submissionVariables: submissionVariablesStats,
      }),
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
 * GET /api/admin/class/:classroomId/dashboard
 */
exports.getClassDashboard = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Validate admin access
    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Get dashboard data
    const dashboard = await Classroom.getDashboard(classroomId, organizationId);

    res.json(dashboard);
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

exports.getStudentDashboard = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Validate student access
    await Classroom.validateStudentAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Get dashboard data
    const dashboard = await Classroom.getStudentDashboard(
      classroomId,
      organizationId
    );

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Error getting student dashboard:", error);
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
    }).populate({
      path: "ownership",
      select: "firstName lastName",
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
 * POST /api/admin/class/:classroomId/invite
 */
exports.inviteStudent = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const { email } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Validate admin access
    const classDoc = await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Generate join link
    const joinLink = Classroom.generateJoinLink(classroomId);

    // Get sender info
    const senderMember = await Member.findOne({ clerkUserId });
    const senderEmail = await senderMember?.getEmailFromClerk();

    // Send invitation email via SendGrid
    try {
      await sendEmail({
        to: {
          email: email,
        },
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

      // Provide more helpful error information
      if (emailError.code === 401) {
        console.error(
          "SendGrid authentication failed. Please check SENDGRID_API_KEY environment variable."
        );
      }

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
