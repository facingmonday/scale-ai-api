const { getUsersRoutes } = require("../../lib/routes");
const { clerkClient } = require("@clerk/express");

exports.me = async function (req, res, next) {
  try {
    // If user doesn't have an organization yet, return basic user info
    if (!req.organization) {
      return res.status(200).json({
        user: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
          imageUrl: req.user.imageUrl,
        },
        organization: null,
        activeClassroom: null,
        routes: [],
      });
    }

    // Get user's role in the active organization using existing helper method
    const membership = req.user.getOrganizationMembership(req.organization);

    if (!membership) {
      return res.status(403).json({
        error: "User membership does not exist for this organization",
      });
    }

    const routes = getUsersRoutes({
      activeClassroom: req.activeClassroom,
      orgRole: membership.role,
      classroomRole: req.classroomRole,
    });

    res.status(200).json({
      routes,
      organization: req.organization,
      activeClassroom: req.activeClassroom,
    });
  } catch (error) {
    next(error);
  }
};

exports.setActiveClassroom = async function (req, res, next) {
  try {
    const { classroomId } = req.body;
    // If classroomId is null/empty, clear the active classroom
    if (!classroomId) {
      // Update Clerk publicMetadata
      await clerkClient.users.updateUserMetadata(req.user.clerkUserId, {
        publicMetadata: {
          ...req.user.publicMetadata,
          activeClassroom: null,
        },
      });

      // Also update local MongoDB for consistency
      req.user.publicMetadata.activeClassroom = null;
      req.user.activeClassroom = {
        classroomId: null,
        role: null,
        setAt: null,
      };
      await req.user.save();

      return res.status(200).json({
        message: "Active classroom cleared",
        activeClassroom: null,
      });
    }

    // Verify the classroom exists and belongs to the organization
    const Classroom = require("../classroom/classroom.model");
    const classroom = await Classroom.findById(classroomId);

    if (!classroom) {
      return res.status(404).json({
        error: "Classroom not found",
      });
    }

    if (classroom.organization.toString() !== req.organization._id.toString()) {
      return res.status(403).json({
        error: "Classroom does not belong to your organization",
      });
    }

    // Verify user is enrolled in this classroom
    const Enrollment = require("../enrollment/enrollment.model");
    const enrollment = await Enrollment.findOne({
      classId: classroomId,
      userId: req.user._id,
      isRemoved: false,
    });

    if (!enrollment) {
      return res.status(403).json({
        error: "You are not enrolled in this classroom",
      });
    }

    // Prepare activeClassroom data
    const activeClassroomData = {
      classroomId: classroom._id.toString(),
      classroomName: classroom.name,
      role: enrollment.role, // "admin" or "member" from enrollment
      setAt: new Date().toISOString(),
    };

    // Update Clerk publicMetadata (source of truth for frontend)
    await clerkClient.users.updateUserMetadata(req.user.clerkUserId, {
      publicMetadata: {
        ...req.user.publicMetadata,
        activeClassroom: activeClassroomData,
      },
    });

    // Also update local MongoDB for consistency and backend convenience
    req.user.publicMetadata.activeClassroom = activeClassroomData;
    req.user.activeClassroom = {
      classroomId: classroom._id,
      role: enrollment.role,
      setAt: new Date(),
    };

    await req.user.save();

    res.status(200).json({
      message: "Active classroom set successfully",
      activeClassroom: {
        _id: classroom._id,
        name: classroom.name,
        role: enrollment.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
