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
    const { name, description, imageUrl, templateId } = req.body;
    const memberId = req.user._id;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    if (!memberId || !organizationId) {
      return res.status(404).json({ error: "Member not found" });
    }

    if (!name) {
      return res.status(400).json({ error: "Class name is required" });
    }

    // If a templateId was provided, validate it belongs to this organization before creating the class
    let templateToApply = null;
    if (templateId) {
      const ClassroomTemplate = require("../classroomTemplate/classroomTemplate.model");
      templateToApply = await ClassroomTemplate.findOne({
        _id: templateId,
        organization: organizationId,
        isActive: true,
      });
      if (!templateToApply) {
        return res.status(400).json({ error: "Invalid templateId" });
      }
    }

    // Create classroom
    const newClassroom = new Classroom({
      name,
      description: description || "",
      imageUrl: imageUrl || null,
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

    // Apply classroom template (create-only)
    let templateApplyStats = null;
    try {
      const ClassroomTemplate = require("../classroomTemplate/classroomTemplate.model");

      if (!templateToApply) {
        // Default to the org copy of the global default template key.
        const defaultKey = ClassroomTemplate.GLOBAL_DEFAULT_KEY;
        templateToApply = await ClassroomTemplate.findOne({
          organization: organizationId,
          key: defaultKey,
          isActive: true,
        });

        // If missing (older orgs), create org copy and retry.
        if (!templateToApply) {
          await ClassroomTemplate.copyGlobalToOrganization(
            organizationId,
            clerkUserId
          );
          templateToApply = await ClassroomTemplate.findOne({
            organization: organizationId,
            key: defaultKey,
            isActive: true,
          });
        }
      }

      if (templateToApply) {
        templateApplyStats = await templateToApply.applyToClassroom({
          classroomId: newClassroom._id,
          organizationId,
          clerkUserId,
        });

        // Persist template prompts onto the classroom (create-only).
        // Prompts are used to build OpenAI messages and should exist even if no store/scenario exists yet.
        const prompts = templateToApply.payload?.prompts;
        if (
          Array.isArray(prompts) &&
          prompts.length > 0 &&
          (!newClassroom.prompts || newClassroom.prompts.length === 0)
        ) {
          newClassroom.prompts = prompts;
          newClassroom.updatedBy = clerkUserId;
          await newClassroom.save();
        }
      }
    } catch (seedError) {
      // Log error but don't fail the classroom creation
      console.error("Error applying template for new classroom:", seedError);
    }

    // Ensure prompts exist even if no templateId was provided (or template apply failed).
    // This lets the frontend rely on classroom.prompts being present for AI simulations.
    if (!newClassroom.prompts || newClassroom.prompts.length === 0) {
      try {
        const ClassroomTemplate = require("../classroomTemplate/classroomTemplate.model");

        // Ensure org has a default template copy, then use its prompts.
        await ClassroomTemplate.copyGlobalToOrganization(
          organizationId,
          clerkUserId
        );
        const defaultTemplate = await ClassroomTemplate.findOne({
          organization: organizationId,
          key: ClassroomTemplate.GLOBAL_DEFAULT_KEY,
          isActive: true,
        });

        const prompts =
          defaultTemplate?.payload?.prompts ||
          ClassroomTemplate.getDefaultClassroomPrompts();

        if (Array.isArray(prompts) && prompts.length > 0) {
          newClassroom.prompts = prompts;
          newClassroom.updatedBy = clerkUserId;
          await newClassroom.save();
        }
      } catch (promptError) {
        console.error("Error ensuring classroom prompts:", promptError);
      }
    }

    res.status(201).json({
      success: true,
      data: newClassroom,
      ...(templateApplyStats && {
        templateApply: templateApplyStats,
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
 * Update a classroom
 * PUT /api/admin/class/:classroomId
 */
exports.updateClass = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const { name, description, imageUrl, isActive, prompts } = req.body;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    // Validate admin access
    const classroom = await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    // Update allowed fields
    if (name !== undefined) {
      classroom.name = name;
    }
    if (description !== undefined) {
      classroom.description = description;
    }
    if (imageUrl !== undefined) {
      classroom.imageUrl = imageUrl || null;
    }
    if (isActive !== undefined) {
      classroom.isActive = isActive;
    }

    // Update classroom prompts (optional)
    // - omit prompts => no change
    // - prompts: null => clear prompts
    // - prompts: [{ role, content }] => replace prompts
    if (prompts !== undefined) {
      if (prompts === null) {
        classroom.prompts = [];
      } else {
        if (!Array.isArray(prompts)) {
          return res.status(400).json({ error: "prompts must be an array" });
        }

        const allowedRoles = new Set([
          "system",
          "user",
          "assistant",
          "developer",
        ]);
        const normalized = prompts.map((p) => ({
          role: typeof p?.role === "string" ? p.role.trim() : "",
          content: typeof p?.content === "string" ? p.content : "",
        }));

        for (const p of normalized) {
          if (!allowedRoles.has(p.role)) {
            return res.status(400).json({
              error:
                "prompts[].role must be one of: system, user, assistant, developer",
            });
          }
          if (!p.content) {
            return res.status(400).json({
              error: "prompts[].content is required",
            });
          }
        }

        classroom.prompts = normalized;
      }
    }

    classroom.updatedBy = clerkUserId;
    await classroom.save();

    res.json({
      success: true,
      message: "Classroom updated successfully",
      data: classroom,
    });
  } catch (error) {
    console.error("Error updating classroom:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
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
 * Admin: delete all VariableDefinitions (and VariableValues) for a classroom
 * DELETE /api/admin/class/:classroomId/variables
 */
exports.deleteClassroomVariables = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const result =
      await Classroom.adminDeleteAllVariableDefinitionsForClassroom(
        classroomId,
        organizationId,
        { deleteValues: true }
      );

    return res.json({
      success: true,
      message: "Classroom variables cleared",
      data: result,
    });
  } catch (error) {
    console.error("Error deleting classroom variables:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Admin: restore classroom from template, wiping defs + values
 * POST /api/admin/class/:classroomId/restore-template
 */
exports.restoreClassroomTemplate = async function (req, res) {
  try {
    const { classroomId } = req.params;
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;
    const { templateId, templateKey } = req.body || {};

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const result = await Classroom.adminRestoreTemplateForClassroom(
      classroomId,
      organizationId,
      clerkUserId,
      { templateId, templateKey }
    );

    return res.json({
      success: true,
      message: "Classroom restored from template",
      data: result,
    });
  } catch (error) {
    console.error("Error restoring classroom template:", error);
    if (error.message === "Class not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Template not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Delete a classroom and all associated data
 * DELETE /api/admin/class/:classroomId
 */
exports.deleteClass = async function (req, res) {
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

    // Clear this classroom from any member's activeClassroom before deleting
    await Member.clearActiveClassroomForAll(classroomId);

    // Delete classroom and all associated data
    const stats = await Classroom.deleteClassroom(classroomId, organizationId);

    res.json({
      success: true,
      message: "Classroom and all associated data deleted successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error deleting classroom:", error);
    if (error.message === "Classroom not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === "Class not found") {
      return res.status(404).json({ error: "Classroom not found" });
    }
    if (error.message.includes("Insufficient permissions")) {
      return res.status(403).json({ error: error.message });
    }
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
