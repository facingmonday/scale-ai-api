const { clerkClient } = require("@clerk/express");

/**
 * Helper functions for working with Clerk metadata
 */

/**
 * Get all organizations registered in Clerk
 * @returns {Object} All organizations
 */
async function getAllOrganizations() {
  return await clerkClient.organizations.getOrganizationList();
}

/**
 * Get organization metadata
 * @param {string} organizationId - Clerk organization ID
 * @returns {Object} Organization with metadata
 */
async function getOrganizationWithMetadata(organizationId) {
  try {
    const organization = await clerkClient.organizations.getOrganization({
      organizationId,
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      imageUrl: organization.imageUrl,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      metadata: {
        public: organization.publicMetadata || {},
        private: organization.privateMetadata || {},
      },
    };
  } catch (error) {
    console.error("Error fetching organization:", error);
    throw error;
  }
}

/**
 * Update organization metadata
 * @param {string} organizationId - Clerk organization ID
 * @param {Object} metadata - Metadata to update
 * @param {Object} metadata.public - Public metadata
 * @param {Object} metadata.private - Private metadata
 * @returns {Object} Updated organization
 */
async function updateOrganizationMetadata(organizationId, metadata = {}) {
  try {
    const { public: publicMeta = {}, private: privateMeta = {} } = metadata;

    const organization = await clerkClient.organizations.updateOrganization(
      organizationId,
      {
        publicMetadata: publicMeta,
        privateMetadata: privateMeta,
      }
    );

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      metadata: {
        public: organization.publicMetadata || {},
        private: organization.privateMetadata || {},
      },
    };
  } catch (error) {
    console.error("Error updating organization metadata:", error);
    throw error;
  }
}

/**
 * Get user metadata
 * @param {string} userId - Clerk user ID
 * @returns {Object} User with metadata
 */
async function getUserWithMetadata(userId) {
  try {
    const user = await clerkClient.users.getUser(userId);

    return {
      id: user.id,
      email: user.emailAddresses[0].emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      metadata: {
        public: user.publicMetadata || {},
        private: user.privateMetadata || {},
      },
    };
  } catch (error) {
    console.error("Error fetching user:", error);
    throw error;
  }
}

/**
 * Update user metadata
 * @param {string} userId - Clerk user ID
 * @param {Object} metadata - Metadata to update
 * @param {Object} metadata.public - Public metadata
 * @param {Object} metadata.private - Private metadata
 * @returns {Object} Updated user
 */
async function updateUserMetadata(userId, metadata = {}) {
  try {
    const { public: publicMeta = {}, private: privateMeta = {} } = metadata;

    const user = await clerkClient.users.updateUser(userId, {
      publicMetadata: publicMeta,
      privateMetadata: privateMeta,
    });

    return {
      id: user.id,
      email: user.emailAddresses[0].emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      metadata: {
        public: user.publicMetadata || {},
        private: user.privateMetadata || {},
      },
    };
  } catch (error) {
    console.error("Error updating user metadata:", error);
    throw error;
  }
}

/**
 * Set user's current organization
 * @param {string} userId - Clerk user ID
 * @param {string} organizationId - Clerk organization ID
 * @returns {Object} Updated user
 */
async function setUserCurrentOrganization(userId, organizationId) {
  try {
    // Verify the user is a member of this organization
    const memberships = await clerkClient.users.getOrganizationMembershipList({
      userId,
    });

    const isMember = memberships.some(
      (m) => m.organization.id === organizationId
    );

    if (!isMember) {
      throw new Error(
        `Failed to set user current organization. User(${userId}) is not a member of this organization(${organizationId})`
      );
    }

    // Update user's metadata
    return await updateUserMetadata(userId, {
      private: { currentOrganizationId: organizationId },
    });
  } catch (error) {
    console.error("Error setting current organization:", error);
    throw error;
  }
}

module.exports = {
  getAllOrganizations,
  getOrganizationWithMetadata,
  updateOrganizationMetadata,
  getUserWithMetadata,
  updateUserMetadata,
  setUserCurrentOrganization,
};
