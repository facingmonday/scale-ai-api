const { clerkClient, getAuth } = require("@clerk/express");
const Member = require("../services/members/member.model");
const Organization = require("../services/organizations/organization.model");
const Enrollment = require("../services/enrollment/enrollment.model");
const Classroom = require("../services/classroom/classroom.model");

// Combined middleware to authenticate and load user data
const requireAuth = (options = {}) => {
  const { organizationOptional = false } = options;

  return async (req, res, next) => {
    try {
      const auth = getAuth(req);
      if (!auth || !auth.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get the Clerk user with their metadata
      const clerkUser = await clerkClient.users.getUser(auth.userId);

      let member = await Member.findOne({
        clerkUserId: auth.userId,
      });

      // Auto-create member if it doesn't exist (handles webhook delays/failures)
      if (!member) {
        console.log(
          `Member not found for Clerk user ${auth.userId}, creating automatically...`
        );

        // Convert Clerk user to Member data format
        const primaryEmail = clerkUser.emailAddresses?.find(
          (email) => email.id === clerkUser.primaryEmailAddressId
        );
        const primaryPhone = clerkUser.phoneNumbers?.find(
          (phone) => phone.id === clerkUser.primaryPhoneNumberId
        );
        const primaryWeb3Wallet = clerkUser.web3Wallets?.find(
          (wallet) => wallet.id === clerkUser.primaryWeb3WalletId
        );

        const memberData = {
          clerkUserId: clerkUser.id,
          username: clerkUser.username || "",
          email: primaryEmail?.emailAddress || "",
          firstName: clerkUser.firstName || "",
          lastName: clerkUser.lastName || "",
          phone: primaryPhone?.phoneNumber,
          imageUrl: clerkUser.imageUrl || "",
          hasImage: clerkUser.hasImage || false,
          primaryEmailAddressId: clerkUser.primaryEmailAddressId,
          primaryPhoneNumberId: clerkUser.primaryPhoneNumberId,
          primaryWeb3WalletId: clerkUser.primaryWeb3WalletId,
          emailAddresses:
            clerkUser.emailAddresses?.map((email) => ({
              id: email.id,
              verification: email.verification,
            })) || [],
          phoneNumbers:
            clerkUser.phoneNumbers?.map((phone) => ({
              id: phone.id,
              verification: phone.verification,
            })) || [],
          web3Wallets: clerkUser.web3Wallets || [],
          externalAccounts:
            clerkUser.externalAccounts?.map((account) => ({
              id: account.id,
              provider: account.provider,
              providerUserId: account.providerUserId,
              verification: account.verification,
            })) || [],
          publicMetadata: clerkUser.publicMetadata || {},
          privateMetadata: clerkUser.privateMetadata || {},
          unsafeMetadata: clerkUser.unsafeMetadata || {},
          passwordEnabled: clerkUser.passwordEnabled || false,
          twoFactorEnabled: clerkUser.twoFactorEnabled || false,
          totpEnabled: clerkUser.totpEnabled || false,
          backupCodeEnabled: clerkUser.backupCodeEnabled || false,
          createOrganizationEnabled:
            clerkUser.createOrganizationEnabled || false,
          createOrganizationsLimit: clerkUser.createOrganizationsLimit || 0,
          deleteSelfEnabled: clerkUser.deleteSelfEnabled !== false,
          hasVerifiedEmailAddress: clerkUser.hasVerifiedEmailAddress || false,
          hasVerifiedPhoneNumber: clerkUser.hasVerifiedPhoneNumber || false,
          externalId: clerkUser.externalId,
          banned: clerkUser.banned || false,
          locked: clerkUser.locked || false,
          lockoutExpiresInSeconds: clerkUser.lockoutExpiresInSeconds,
          verificationAttemptsRemaining:
            clerkUser.verificationAttemptsRemaining,
          lastActiveAt: clerkUser.lastActiveAt
            ? new Date(clerkUser.lastActiveAt)
            : null,
          clerkCreatedAt: new Date(clerkUser.createdAt),
          clerkUpdatedAt: new Date(clerkUser.updatedAt),
          createdAt: new Date(clerkUser.createdAt),
          updatedAt: new Date(clerkUser.updatedAt),
          lastSignInAt: clerkUser.lastSignInAt
            ? new Date(clerkUser.lastSignInAt)
            : null,
        };

        // Use findOneAndUpdate with upsert to avoid race conditions
        member = await Member.findOneAndUpdate(
          { clerkUserId: auth.userId },
          { $set: memberData },
          { new: true, upsert: true }
        );

        // Populate masked contact info if available
        try {
          await member.populateMaskedContactInfo();
        } catch (error) {
          console.warn(
            "Could not populate masked contact info for auto-created member:",
            error.message
          );
        }

        console.log(`✅ Auto-created member for Clerk user ${auth.userId}`);
      }

      req.user = member;
      req.clerkUser = clerkUser;

      let organization;

      // If orgId is provided in auth, use it
      if (auth.orgId) {
        organization = await Organization.findOne({
          clerkOrganizationId: auth.orgId,
        });

        // Auto-create organization if it doesn't exist (handles webhook delays/failures)
        if (!organization) {
          console.log(
            `Organization not found for Clerk org ${auth.orgId}, creating automatically...`
          );

          try {
            // Fetch organization data from Clerk
            const clerkOrg = await clerkClient.organizations.getOrganization({
              organizationId: auth.orgId,
            });

            const organizationData = {
              clerkOrganizationId: clerkOrg.id,
              name: clerkOrg.name,
              slug: clerkOrg.slug,
              imageUrl: clerkOrg.imageUrl,
              maxAllowedMemberships: clerkOrg.maxAllowedMemberships || 1000,
              adminDeleteEnabled: clerkOrg.adminDeleteEnabled !== false,
              publicMetadata: clerkOrg.publicMetadata || {},
              privateMetadata: clerkOrg.privateMetadata || {},
              clerkCreatedAt: new Date(clerkOrg.createdAt),
              clerkUpdatedAt: new Date(clerkOrg.updatedAt),
            };

            // Use findOneAndUpdate with upsert to avoid race conditions
            organization = await Organization.findOneAndUpdate(
              { clerkOrganizationId: auth.orgId },
              { $set: organizationData },
              { new: true, upsert: true }
            );

            console.log(
              `✅ Auto-created organization for Clerk org ${auth.orgId}`
            );

            // Also sync the organization membership for this member
            try {
              const memberships =
                await clerkClient.organizations.getOrganizationMembershipList({
                  organizationId: auth.orgId,
                  userId: auth.userId,
                });

              const membership = memberships.data?.find(
                (m) => m.publicUserData.userId === auth.userId
              );

              if (membership) {
                const clerkMembership = {
                  id: membership.id,
                  role: membership.role,
                  publicMetadata: membership.publicMetadata || {},
                  createdAt: new Date(membership.createdAt),
                  updatedAt: new Date(membership.updatedAt),
                };

                member.addOrganizationMembership(organization, clerkMembership);
                await member.save();
                console.log(
                  `✅ Synced organization membership for user ${auth.userId}`
                );
              }
            } catch (membershipError) {
              console.warn(
                `Could not sync organization membership:`,
                membershipError.message
              );
            }
          } catch (error) {
            console.warn(
              `Could not auto-create organization for Clerk org ${auth.orgId}:`,
              error.message
            );
            // If we can't create it and it's required, throw error
            if (!organizationOptional) {
              throw new Error(
                "Organization not found and could not be created"
              );
            }
          }
        } else {
          // Organization exists, but check if member has membership synced
          const membership = member.getOrganizationMembership(organization);
          if (!membership && auth.orgId) {
            // Try to sync membership from Clerk
            try {
              const memberships =
                await clerkClient.organizations.getOrganizationMembershipList({
                  organizationId: auth.orgId,
                  userId: auth.userId,
                });

              const clerkMembership = memberships.data?.find(
                (m) => m.publicUserData.userId === auth.userId
              );

              if (clerkMembership) {
                const membershipData = {
                  id: clerkMembership.id,
                  role: clerkMembership.role,
                  publicMetadata: clerkMembership.publicMetadata || {},
                  createdAt: new Date(clerkMembership.createdAt),
                  updatedAt: new Date(clerkMembership.updatedAt),
                };

                member.addOrganizationMembership(organization, membershipData);
                await member.save();
                console.log(
                  `✅ Synced organization membership for user ${auth.userId}`
                );
              }
            } catch (membershipError) {
              console.warn(
                `Could not sync organization membership:`,
                membershipError.message
              );
            }
          }
        }
      } else {
        // If no orgId, try to use the first organization from member's memberships
        if (
          member.organizationMemberships &&
          member.organizationMemberships.length > 0
        ) {
          const firstOrgMembership = member.organizationMemberships[0];
          organization = await Organization.findById(
            firstOrgMembership.organizationId
          );
        }
      }

      // Only require organization if not marked as optional
      if (!organization && !organizationOptional) {
        throw new Error("Organization not found");
      }

      req.organization = organization || null;

      // Load active classroom from user's stored preference in publicMetadata
      // Only load if organization exists
      if (organization) {
        // Prioritize publicMetadata (synced from Clerk) for frontend consistency
        const activeClassroomData =
          member.publicMetadata?.activeClassroom ||
          member.activeClassroom?.classroomId
            ? member.activeClassroom
            : null;

        if (activeClassroomData) {
          try {
            // Extract classroomId (handle both formats)
            const classroomId =
              typeof activeClassroomData.classroomId === "string"
                ? activeClassroomData.classroomId
                : activeClassroomData.classroomId;

            if (classroomId) {
              const classroom = await Classroom.findById(classroomId);

              if (classroom) {
                // Validate classroom still belongs to organization
                if (
                  classroom.organization.toString() ===
                  organization._id.toString()
                ) {
                  req.activeClassroom = classroom;
                  req.classroomRole = activeClassroomData.role; // Use stored role

                  // Optionally still load the full enrollment if needed elsewhere
                  const enrollment = await Enrollment.findOne({
                    classId: classroom._id,
                    userId: member._id,
                    isRemoved: false,
                  });
                  req.enrollment = enrollment;
                }
              }
            }
          } catch (classroomError) {
            // Log but don't fail the request if classroom loading fails
            console.warn("Error loading active classroom:", classroomError);
          }
        }
      } else {
        // No organization, so no active classroom
        req.activeClassroom = null;
        req.classroomRole = null;
        req.enrollment = null;
      }
      next();
    } catch (error) {
      console.error("Authentication error requireAuth:", error);
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

      let member = await Member.findOne({
        clerkUserId: auth.userId,
      });

      // Auto-create member if it doesn't exist (handles webhook delays/failures)
      if (!member) {
        console.log(
          `Member not found for Clerk user ${auth.userId}, creating automatically...`
        );

        // Convert Clerk user to Member data format
        const primaryEmail = clerkUser.emailAddresses?.find(
          (email) => email.id === clerkUser.primaryEmailAddressId
        );
        const primaryPhone = clerkUser.phoneNumbers?.find(
          (phone) => phone.id === clerkUser.primaryPhoneNumberId
        );
        const primaryWeb3Wallet = clerkUser.web3Wallets?.find(
          (wallet) => wallet.id === clerkUser.primaryWeb3WalletId
        );

        const memberData = {
          clerkUserId: clerkUser.id,
          username: clerkUser.username || "",
          email: primaryEmail?.emailAddress || "",
          firstName: clerkUser.firstName || "",
          lastName: clerkUser.lastName || "",
          phone: primaryPhone?.phoneNumber,
          imageUrl: clerkUser.imageUrl || "",
          hasImage: clerkUser.hasImage || false,
          primaryEmailAddressId: clerkUser.primaryEmailAddressId,
          primaryPhoneNumberId: clerkUser.primaryPhoneNumberId,
          primaryWeb3WalletId: clerkUser.primaryWeb3WalletId,
          emailAddresses:
            clerkUser.emailAddresses?.map((email) => ({
              id: email.id,
              verification: email.verification,
            })) || [],
          phoneNumbers:
            clerkUser.phoneNumbers?.map((phone) => ({
              id: phone.id,
              verification: phone.verification,
            })) || [],
          web3Wallets: clerkUser.web3Wallets || [],
          externalAccounts:
            clerkUser.externalAccounts?.map((account) => ({
              id: account.id,
              provider: account.provider,
              providerUserId: account.providerUserId,
              verification: account.verification,
            })) || [],
          publicMetadata: clerkUser.publicMetadata || {},
          privateMetadata: clerkUser.privateMetadata || {},
          unsafeMetadata: clerkUser.unsafeMetadata || {},
          passwordEnabled: clerkUser.passwordEnabled || false,
          twoFactorEnabled: clerkUser.twoFactorEnabled || false,
          totpEnabled: clerkUser.totpEnabled || false,
          backupCodeEnabled: clerkUser.backupCodeEnabled || false,
          createOrganizationEnabled:
            clerkUser.createOrganizationEnabled || false,
          createOrganizationsLimit: clerkUser.createOrganizationsLimit || 0,
          deleteSelfEnabled: clerkUser.deleteSelfEnabled !== false,
          hasVerifiedEmailAddress: clerkUser.hasVerifiedEmailAddress || false,
          hasVerifiedPhoneNumber: clerkUser.hasVerifiedPhoneNumber || false,
          externalId: clerkUser.externalId,
          banned: clerkUser.banned || false,
          locked: clerkUser.locked || false,
          lockoutExpiresInSeconds: clerkUser.lockoutExpiresInSeconds,
          verificationAttemptsRemaining:
            clerkUser.verificationAttemptsRemaining,
          lastActiveAt: clerkUser.lastActiveAt
            ? new Date(clerkUser.lastActiveAt)
            : null,
          clerkCreatedAt: new Date(clerkUser.createdAt),
          clerkUpdatedAt: new Date(clerkUser.updatedAt),
          createdAt: new Date(clerkUser.createdAt),
          updatedAt: new Date(clerkUser.updatedAt),
          lastSignInAt: clerkUser.lastSignInAt
            ? new Date(clerkUser.lastSignInAt)
            : null,
        };

        // Use findOneAndUpdate with upsert to avoid race conditions
        member = await Member.findOneAndUpdate(
          { clerkUserId: auth.userId },
          { $set: memberData },
          { new: true, upsert: true }
        );

        // Populate masked contact info if available
        try {
          await member.populateMaskedContactInfo();
        } catch (error) {
          console.warn(
            "Could not populate masked contact info for auto-created member:",
            error.message
          );
        }

        console.log(`✅ Auto-created member for Clerk user ${auth.userId}`);
      }

      req.user = member;
      req.clerkUser = clerkUser;

      next();
    } catch (error) {
      console.error("Authentication error requireMemberAuth:", error);
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
      console.error("Authentication error checkRole:", error);
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
      console.error("Authentication error checkPermissions:", error);
      return res.status(500).json({ error: "Authentication error" });
    }
  };
};

const requireActiveClassroom = (options = {}) => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user._id) {
        return res.status(401).json({
          error: "User must be authenticated to access classroom",
        });
      }

      const classroomId = req.headers["x-classroom"];

      if (!classroomId) {
        return res.status(400).json({
          error: "No active classroom selected",
        });
      }

      // Find enrollment for this user and classroom
      const enrollment = await Enrollment.findOne({
        classId: classroomId,
        userId: req.user._id,
        isRemoved: false,
      });

      if (!enrollment) {
        return res.status(403).json({
          error: "User not enrolled in classroom",
        });
      }

      // Fetch the classroom document
      const classroom = await Classroom.findById(classroomId);

      if (!classroom) {
        return res.status(404).json({
          error: "Classroom not found",
        });
      }

      // If organization context exists, validate classroom belongs to organization
      if (req.organization) {
        if (
          classroom.organization.toString() !== req.organization._id.toString()
        ) {
          return res.status(403).json({
            error: "Classroom does not belong to your organization",
          });
        }
      }

      // Attach classroom and enrollment info to request
      req.activeClassroom = classroom;
      req.classroomRole = enrollment.role;
      req.enrollment = enrollment;

      next();
    } catch (error) {
      console.error("Error in requireActiveClassroom:", error);
      return res.status(500).json({
        error: "Error validating classroom access",
      });
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
  requireActiveClassroom,
};
