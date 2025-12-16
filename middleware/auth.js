const { clerkClient, getAuth } = require("@clerk/express");
const Member = require("../services/members/member.model");
const Organization = require("../services/organizations/organization.model");

// Combined middleware to authenticate and load user data
const requireAuth = (options = {}) => {
  return async (req, res, next) => {
    try {
      const auth = getAuth(req);

      if (!auth || !auth.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get the Clerk user with their metadata
      const clerkUser = await clerkClient.users.getUser(auth.userId);

      const member = await Member.findOne({
        clerkUserId: auth.userId,
      });

      if (!member) {
        throw new Error("Member not found");
      }

      req.user = member;
      req.clerkUser = clerkUser;

      const organization = await Organization.findOne({
        clerkOrganizationId: auth.orgId,
      });

      if (!organization) {
        throw new Error("Organization not found");
      }

      req.organization = organization;

      next();
    } catch (error) {
      console.error("Authentication error:", error);
      return res.status(500).json({ message: "Authentication error" });
    }
  };
};

const requireMemberAuth = (options = {}) => {
  return async (req, res, next) => {
    try {
      const auth = getAuth(req);

      if (!auth || !auth.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get the Clerk user with their metadata
      const clerkUser = await clerkClient.users.getUser(auth.userId);

      const member = await Member.findOne({
        clerkUserId: auth.userId,
      });

      if (!member) {
        throw new Error("Member not found");
      }

      req.user = member;
      req.clerkUser = clerkUser;

      next();
    } catch (error) {
      console.error("Authentication error:", error);
      return res.status(500).json({ message: "Authentication error" });
    }
  };
};

// Middleware to check user role in organization
const checkRole = (requiredRoles) => {
  // Convert to array if single role is passed
  const rolesArray = Array.isArray(requiredRoles)
    ? requiredRoles
    : [requiredRoles];

  return async (req, res, next) => {
    try {
      const auth = getAuth(req);

      if (!auth || !auth.userId || !auth.orgId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      try {
        // Get user's membership in the organization
        const memberships =
          await clerkClient.organizations.getOrganizationMembershipList({
            userId: auth.userId,
            organizationId: auth.orgId,
          });

        if (
          !memberships ||
          !memberships.data ||
          memberships.data.length === 0
        ) {
          return res
            .status(403)
            .json({ message: "Check role: Memberships is empty." });
        }
        // Find the user's membership
        const membership = memberships.data.find(
          (m) => m.publicUserData.userId === auth.userId
        );

        if (!membership) {
          return res.status(403).json({
            message: `Check role failed: Membership not found for user(${auth?.userId})`,
          });
        }

        // Check if user's role is in the required roles
        if (rolesArray.includes(membership.role)) {
          return next();
        }

        return res.status(403).json({ message: "Insufficient permissions" });
      } catch (error) {
        console.error("Role check error:", error);
        return res.status(500).json({ error: "Error checking role" });
      }
    } catch (error) {
      console.error("Authentication error:", error);
      return res.status(500).json({ error: "Authentication error" });
    }
  };
};

// Middleware to check custom permissions
const checkPermissions = (requiredPermissions) => {
  // Convert to array if single permission is passed
  const permissionsArray = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return async (req, res, next) => {
    try {
      const auth = getAuth(req);

      if (!auth || !auth.userId || !auth.orgId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      try {
        // Get user's membership in the organization
        const memberships = await clerkClient.organizations.getMembershipList({
          organizationId: auth.orgId,
        });

        // Find the user's membership
        const membership = memberships.find(
          (m) => m.publicUserData.userId === auth.userId
        );

        if (!membership) {
          return res.status(403).json({
            message: `Check permissions failed: Membership not found for user(${auth?.userId})`,
          });
        }

        // Admin role has all permissions
        if (membership.role === "admin") {
          return next();
        }

        // Check custom permissions from metadata
        const userPermissions = membership.privateMetadata?.permissions || [];
        const hasPermission = permissionsArray.some((permission) =>
          userPermissions.includes(permission)
        );

        if (hasPermission) {
          return next();
        }

        return res.status(403).json({ message: "Insufficient permissions" });
      } catch (error) {
        console.error("Permission check error:", error);
        return res.status(500).json({ error: "Error checking permissions" });
      }
    } catch (error) {
      console.error("Authentication error:", error);
      return res.status(500).json({ error: "Authentication error" });
    }
  };
};

module.exports = {
  requireAuth,
  requireMemberAuth,
  checkRole,
  checkPermissions,
  clerkClient,
  getAuth,
};
