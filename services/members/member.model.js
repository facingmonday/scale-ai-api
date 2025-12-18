const mongoose = require("mongoose");
const { clerkClient } = require("@clerk/express");

// Schema that mirrors Clerk's OrganizationMembership object structure
const organizationMembershipSchema = new mongoose.Schema(
  {
    // Core membership identifiers
    id: {
      type: String,
      required: true, // Clerk membership ID
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    // Clerk's standard OrganizationMembership fields
    role: {
      type: String,
      required: true,
    },
    // Store publicMetadata as Clerk does - no custom field mapping
    publicMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Store minimal organization reference (full org data available via ref)
    organization: {
      id: String, // Clerk organization ID
      name: String,
      slug: String,
      imageUrl: String,
    },
    // Clerk timestamps
    createdAt: {
      type: Date,
      required: true,
    },
    updatedAt: {
      type: Date,
      required: false, // Not required since Mongoose handles document-level timestamps
    },
  },
  {
    _id: false, // Don't create separate _id for subdocuments
  }
);

// Schema that mirrors Clerk's User object structure
const memberSchema = new mongoose.Schema(
  {
    // Core Clerk User fields
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    firstName: String,
    lastName: String,
    username: String,
    imageUrl: String,
    hasImage: {
      type: Boolean,
      default: false,
    },

    // Primary identifiers
    primaryEmailAddressId: String,
    primaryPhoneNumberId: String,
    primaryWeb3WalletId: String,

    // Contact arrays (simplified - store key info, full objects available via Clerk API)
    emailAddresses: [
      {
        id: String,
        verification: {
          status: String,
          strategy: String,
        },
      },
    ],
    phoneNumbers: [
      {
        id: String,
        verification: {
          status: String,
          strategy: String,
        },
      },
    ],
    web3Wallets: [
      {
        id: String,
        web3Wallet: String,
        verification: {
          status: String,
          strategy: String,
        },
      },
    ],
    externalAccounts: [
      {
        id: String,
        provider: String,
        providerUserId: String,
        verification: {
          status: String,
          strategy: String,
        },
      },
    ],

    // Metadata as Clerk structures it
    publicMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    privateMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    unsafeMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Capabilities
    passwordEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    totpEnabled: {
      type: Boolean,
      default: false,
    },
    backupCodeEnabled: {
      type: Boolean,
      default: false,
    },
    createOrganizationEnabled: {
      type: Boolean,
      default: false,
    },
    createOrganizationsLimit: Number,
    deleteSelfEnabled: {
      type: Boolean,
      default: true,
    },

    // Verification status
    hasVerifiedEmailAddress: {
      type: Boolean,
      default: false,
    },
    hasVerifiedPhoneNumber: {
      type: Boolean,
      default: false,
    },

    // Organization memberships - array of Clerk OrganizationMembership objects
    organizationMemberships: [organizationMembershipSchema],

    // Clerk timestamps
    createdAt: {
      type: Date,
      required: true,
    },
    updatedAt: {
      type: Date,
      required: false, // Not required since Mongoose handles document-level timestamps
    },
    lastSignInAt: Date,
    legalAcceptedAt: Date,
    devices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Device",
      },
    ],
    preferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
      transactional: { type: Boolean, default: true },
    },
    // External ID for integration
    externalId: String,
    maskedEmail: {
      type: String,
      default: "",
    },
    maskedPhone: {
      type: String,
      default: "",
    },
    // Active classroom - stores user's currently selected classroom with their role
    activeClassroom: {
      classroomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Classroom",
        default: null,
      },
      role: {
        type: String,
        enum: ["admin", "member"],
        default: null,
      },
      setAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true, // Keep MongoDB timestamps for internal tracking
  }
);

// Compound index for organization membership queries
memberSchema.index({
  "organizationMemberships.organizationId": 1,
  "organizationMemberships.publicMetadata.isActive": 1,
});

// Virtual for computed fullName from firstName and lastName
memberSchema.virtual("fullName").get(function () {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`.trim();
  } else if (this.firstName) {
    return this.firstName;
  } else if (this.lastName) {
    return this.lastName;
  }
  return "";
});

// Virtual for computed fields (name virtual for backwards compatibility)
memberSchema.virtual("name").get(function () {
  return this.fullName || this.username || this.clerkUserId;
});

memberSchema.virtual("primaryEmailAddress").get(function () {
  return this.emailAddresses?.find(
    (email) => email.id === this.primaryEmailAddressId
  );
});

memberSchema.virtual("primaryPhoneNumber").get(function () {
  return this.phoneNumbers?.find(
    (phone) => phone.id === this.primaryPhoneNumberId
  );
});

memberSchema.virtual("primaryWeb3Wallet").get(function () {
  return this.web3Wallets?.find(
    (wallet) => wallet.id === this.primaryWeb3WalletId
  );
});

// These virtuals now return empty strings since actual values are in Clerk
memberSchema.virtual("email").get(function () {
  return ""; // Email stored in Clerk, use getEmailFromClerk() method
});

memberSchema.virtual("phone").get(function () {
  return ""; // Phone stored in Clerk, use getPhoneFromClerk() method
});

// Ensure virtuals are included in JSON output
memberSchema.set("toJSON", {
  virtuals: true,
});

// Methods for organization membership management
memberSchema.methods.getOrganizationMembership = function (organization) {
  if (!organization) return null;

  return this.organizationMemberships.find((membership) => {
    return membership.organizationId.toString() === organization._id.toString();
  });
};

memberSchema.methods.isActiveInOrganization = function (organization) {
  const membership = this.getOrganizationMembership(organization);
  return membership && membership.publicMetadata?.isActive !== false;
};

memberSchema.methods.addOrganizationMembership = function (
  organization,
  clerkMembership
) {
  if (!organization || !clerkMembership) return this;

  // Remove existing membership if it exists
  this.organizationMemberships = this.organizationMemberships.filter(
    (membership) => {
      return (
        membership.organizationId.toString() !== organization._id.toString()
      );
    }
  );

  // Add new membership in Clerk's format
  this.organizationMemberships.push({
    id: clerkMembership.id,
    organizationId: organization._id,
    role: clerkMembership.role,
    publicMetadata: clerkMembership.publicMetadata || {},
    organization: {
      id: organization.clerkOrganizationId,
      name: organization.name,
      slug: organization.slug,
      imageUrl: organization.imageUrl,
    },
    createdAt: new Date(clerkMembership.createdAt),
    ...(clerkMembership.updatedAt && {
      updatedAt: new Date(clerkMembership.updatedAt),
    }),
  });

  return this;
};

memberSchema.methods.updateOrganizationMembership = function (
  organization,
  clerkMembership
) {
  const membership = this.getOrganizationMembership(organization);
  if (!membership) return this;

  // Update with Clerk's data structure
  membership.role = clerkMembership.role;
  membership.publicMetadata = clerkMembership.publicMetadata || {};
  if (clerkMembership.updatedAt) {
    membership.updatedAt = new Date(clerkMembership.updatedAt);
  }

  return this;
};

memberSchema.methods.removeOrganizationMembership = function (organization) {
  if (!organization) return this;

  this.organizationMemberships = this.organizationMemberships.filter(
    (membership) => {
      return (
        membership.organizationId.toString() !== organization._id.toString()
      );
    }
  );

  return this;
};

// Methods for fetching email/phone from Clerk
memberSchema.methods.getEmailFromClerk = async function () {
  try {
    const clerkUser = await clerkClient.users.getUser(this.clerkUserId);
    const primaryEmail = clerkUser.emailAddresses?.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    );
    return primaryEmail?.emailAddress || "";
  } catch (error) {
    console.error("Error fetching email from Clerk:", error);
    return "";
  }
};

memberSchema.methods.getPhoneFromClerk = async function () {
  try {
    const clerkUser = await clerkClient.users.getUser(this.clerkUserId);
    const primaryPhone = clerkUser.phoneNumbers?.find(
      (phone) => phone.id === clerkUser.primaryPhoneNumberId
    );
    return primaryPhone?.phoneNumber || "";
  } catch (error) {
    console.error("Error fetching phone from Clerk:", error);
    return "";
  }
};

// Static methods
memberSchema.statics.findByClerkUserId = function (clerkUserId) {
  return this.findOne({ clerkUserId: clerkUserId });
};

memberSchema.statics.findByEmail = async function (email) {
  const { clerkClient } = require("@clerk/express");

  try {
    const { data: users } = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    if (users.length === 0) {
      return null;
    }

    // Find the local member record by clerk user ID
    const clerkUser = users[0];
    return await this.findByClerkUserId(clerkUser.id);
  } catch (error) {
    console.error("Error finding member by email:", error);
    return null;
  }
};

// Static utility to mask email
memberSchema.statics.maskEmail = function (email) {
  const [user, domain] = email.split("@");
  return `${user[0]}****@${domain}`;
};

// Static utility to mask phone
memberSchema.statics.maskPhone = function (phone) {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, "(***) ***-$3");
};

memberSchema.statics.findByOrganization = function (
  organization,
  filters = {}
) {
  const organizationId = organization._id;
  const query = {
    "organizationMemberships.organizationId": organizationId,
  };

  // Apply filters to publicMetadata
  if (filters.isActive !== undefined) {
    query["organizationMemberships.publicMetadata.isActive"] = filters.isActive;
  }
  if (filters.subscribed !== undefined) {
    query["organizationMemberships.publicMetadata.subscribed"] =
      filters.subscribed;
  }
  if (filters.membershipType) {
    query["organizationMemberships.publicMetadata.membershipType"] =
      filters.membershipType;
  }

  return this.find(query);
};

memberSchema.statics.searchInOrganization = function (
  organization,
  searchTerm,
  options = {}
) {
  const { limit = 20, skip = 0 } = options;
  const organizationId = organization._id;

  const query = {
    "organizationMemberships.organizationId": organizationId,
    $or: [
      { firstName: { $regex: searchTerm, $options: "i" } },
      { lastName: { $regex: searchTerm, $options: "i" } },
      { username: { $regex: searchTerm, $options: "i" } },
      // Note: Cannot search by email/phone since they're stored in Clerk
      // Consider implementing Clerk-based search for email/phone if needed
    ],
  };

  return this.find(query).limit(limit).skip(skip);
};

/**
 * Find existing Clerk user by email
 */
memberSchema.statics.findClerkUserByEmail = async function (email) {
  const { clerkClient } = require("@clerk/express");

  try {
    const { data: users } = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error("Error finding Clerk user by email:", error);
    return null;
  }
};

/**
 * Find or create Clerk user
 * @param {Object} memberData - Member data { email, name, phone, id? }
 * @returns {Promise<Object>} - Clerk user object
 */
memberSchema.statics.findOrCreateClerkUser = async function (memberData) {
  const { clerkClient } = require("@clerk/express");

  try {
    if (!memberData.email) {
      throw new Error("Email is required to find or create Clerk user");
    }

    // First check if user already exists in Clerk
    let clerkUser = await this.findClerkUserByEmail(memberData.email);

    if (!clerkUser) {
      // Create user in Clerk if they don't exist
      const createUserData = {
        emailAddress: [memberData.email],
        firstName: memberData.firstName || "",
        lastName: memberData.lastName || "",
        skipPasswordRequirement: true,
      };

      clerkUser = await clerkClient.users.createUser(createUserData);

      // Add phone number separately if provided (Clerk doesn't support phone in createUser)
      if (memberData.phoneNumber && memberData.phoneNumber.trim()) {
        try {
          await clerkClient.phoneNumbers.createPhoneNumber({
            userId: clerkUser.id,
            phoneNumber: memberData.phoneNumber,
          });
        } catch (phoneError) {
          console.warn(
            "Could not add phone number to user:",
            phoneError.message
          );
          // Don't fail the entire user creation if phone number addition fails
        }
      }
    }

    return clerkUser;
  } catch (error) {
    console.error("Error finding or creating Clerk user:", error);
    throw error;
  }
};

/**
 * Unified member finding/creation for checkout process
 * Handles all 6 checkout situations:
 * 1. Guest checkout ($0) - member not in DB, not in Clerk
 * 2. Guest checkout ($0) - member in DB, not in Clerk
 * 3. Guest checkout ($0) - member in DB and Clerk
 * 4. Member checkout ($$$) - member not in DB
 * 5. Logged in member checkout ($$$) - member in DB, not in Clerk
 * 6. Logged in member checkout ($0)
 *
 * @param {Object} customerData - Customer info { email, name, phone, userId? }
 * @param {Object} organization - Organization document
 * @param {Object} options - Optional settings { membershipData, createInClerk }
 * @returns {Promise<Object>} - Formatted member object ready for order creation
 */
memberSchema.statics.findOrCreateForCheckout = async function (
  customerData,
  organization,
  options = {}
) {
  const { membershipData = {}, createInClerk = true } = options;

  if (!customerData.email) {
    throw new Error("Customer email is required for checkout");
  }

  if (!organization) {
    throw new Error("Organization is required for checkout");
  }

  try {
    let member = null;
    let orgMembership = null;

    // Step 1: Try to find existing member
    if (!member && customerData.userId) {
      // Logged-in user - try by userId first
      member = await this.findByClerkUserId(customerData.userId);
      if (member) {
        orgMembership = member.getOrganizationMembership(organization);
      }
    }

    if (!member) {
      // Try by email (for both logged-in and guest) - now async
      member = await this.findByEmail(customerData.email);
      if (member) {
        orgMembership = member.getOrganizationMembership(organization);
      }
    }

    // Step 2: Handle member found scenarios
    if (member && orgMembership) {
      // Member exists and is in organization - return formatted member
      return await this.formatForCheckout(member, orgMembership);
    }

    if (member && !orgMembership) {
      // Member exists but not in organization - add them
      await this.addMemberToOrganizationInClerk(
        member.clerkUserId,
        organization.clerkOrganizationId,
        membershipData
      );

      // Create a basic membership object structure for immediate use
      const clerkMembership = {
        id: `temp_${Date.now()}`, // Temporary ID until webhook sync
        role: "org:member",
        publicMetadata: membershipData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      member.addOrganizationMembership(organization, clerkMembership);
      await member.save();

      // Populate masked contact info for the new member
      try {
        await member.populateMaskedContactInfo();
      } catch (error) {
        console.warn(
          "Could not populate masked contact info for new member:",
          error.message
        );
      }

      const newOrgMembership = member.getOrganizationMembership(organization);
      return await this.formatForCheckout(member, newOrgMembership);
    }

    // Step 3: Member doesn't exist - create new member
    const clerkUser = await this.findOrCreateClerkUser(customerData);

    // Create local member record from Clerk user data
    if (!clerkUser) {
      throw new Error("Clerk user not found or created");
    }

    // Check if local member already exists for this clerkUserId
    // This handles the case where Clerk user exists but local member wasn't found by email
    member = await this.findByClerkUserId(clerkUser.id);

    if (member) {
      // Member exists but might not be in this organization
      orgMembership = member.getOrganizationMembership(organization);

      if (!orgMembership) {
        // Member exists but not in organization - add them
        await this.addMemberToOrganizationInClerk(
          member.clerkUserId,
          organization.clerkOrganizationId,
          membershipData
        );

        // Create a basic membership object structure for immediate use
        const clerkMembership = {
          id: `temp_${Date.now()}`, // Temporary ID until webhook sync
          role: "org:member",
          publicMetadata: membershipData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        member.addOrganizationMembership(organization, clerkMembership);
        await member.save();

        // Populate masked contact info for the existing member
        try {
          await member.populateMaskedContactInfo();
        } catch (error) {
          console.warn(
            "Could not populate masked contact info for existing member:",
            error.message
          );
        }

        const newOrgMembership = member.getOrganizationMembership(organization);
        return await this.formatForCheckout(member, newOrgMembership);
      } else {
        // Member exists and is in organization - return formatted member
        return await this.formatForCheckout(member, orgMembership);
      }
    }

    // Member doesn't exist locally - create new member using upsert to avoid race conditions
    const memberData = {
      clerkUserId: clerkUser.id,
      firstName: clerkUser.firstName || "",
      lastName: clerkUser.lastName || "",
      username: clerkUser.username || "",
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
      createOrganizationEnabled: clerkUser.createOrganizationEnabled || false,
      createOrganizationsLimit: clerkUser.createOrganizationsLimit || 0,
      deleteSelfEnabled: clerkUser.deleteSelfEnabled !== false,
      hasVerifiedEmailAddress: clerkUser.hasVerifiedEmailAddress || false,
      hasVerifiedPhoneNumber: clerkUser.hasVerifiedPhoneNumber || false,
      createdAt: new Date(clerkUser.createdAt),
      lastSignInAt: clerkUser.lastSignInAt
        ? new Date(clerkUser.lastSignInAt)
        : null,
      legalAcceptedAt: clerkUser.legalAcceptedAt
        ? new Date(clerkUser.legalAcceptedAt)
        : null,
      externalId: clerkUser.externalId,
    };

    member = await this.findOneAndUpdate(
      { clerkUserId: clerkUser.id },
      { $setOnInsert: memberData },
      { new: true, upsert: true }
    );

    // Add user to organization in Clerk
    await this.addMemberToOrganizationInClerk(
      clerkUser.id,
      organization.clerkOrganizationId,
      membershipData
    );

    // Create membership object structure
    const clerkMembership = {
      id: `temp_${Date.now()}`, // Temporary ID until webhook sync
      role: "org:member",
      publicMetadata: membershipData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    member.addOrganizationMembership(organization, clerkMembership);
    await member.save();

    // Populate masked contact info for the new member
    try {
      await member.populateMaskedContactInfo();
    } catch (error) {
      console.warn(
        "Could not populate masked contact info for new member:",
        error.message
      );
    }

    const newOrgMembership = member.getOrganizationMembership(organization);
    return await this.formatForCheckout(member, newOrgMembership);
  } catch (error) {
    console.error("Error in findOrCreateForCheckout:", error);
    throw error;
  }
};

/**
 * Create a Clerk user and add them to organization
 */
memberSchema.statics.createClerkUserAndAddToOrg = async function (
  customerData,
  organization,
  membershipData = {}
) {
  const { clerkClient } = require("@clerk/express");

  try {
    // First check if user already exists in Clerk
    let clerkUser = await this.findClerkUserByEmail(customerData.email);

    if (!clerkUser) {
      // Create user in Clerk if they don't exist
      const createUserData = {
        emailAddress: [customerData.email],
        firstName: customerData.firstName || "",
        lastName: customerData.lastName || "",
        phoneNumber: [customerData.phoneNumber],
        skipPasswordRequirement: true,
      };

      clerkUser = await clerkClient.users.createUser(createUserData);

      // Add phone number separately if provided (Clerk doesn't support phone in createUser)
      if (customerData.phone && customerData.phone.trim()) {
        try {
          await clerkClient.phoneNumbers.createPhoneNumber({
            userId: clerkUser.id,
            phoneNumber: customerData.phone,
          });
        } catch (phoneError) {
          console.warn(
            "Could not add phone number to user:",
            phoneError.message
          );
          // Don't fail the entire user creation if phone number addition fails
        }
      }
    }

    // Add to organization using publicMetadata structure
    await this.addMemberToOrganizationInClerk(
      clerkUser.id,
      organization.clerkOrganizationId,
      membershipData
    );

    return clerkUser;
  } catch (error) {
    console.error("Error creating Clerk user and adding to org:", error);
    throw error;
  }
};

/**
 * Add member to organization in Clerk
 */
memberSchema.statics.addMemberToOrganizationInClerk = async function (
  clerkUserId,
  clerkOrganizationId,
  publicMetadata = {}
) {
  const { clerkClient } = require("@clerk/express");

  try {
    const membershipPayload = {
      organizationId: clerkOrganizationId,
      userId: clerkUserId,
      role: "org:member",
      publicMetadata: publicMetadata, // Store exactly as provided
    };

    await clerkClient.organizations.createOrganizationMembership(
      membershipPayload
    );
  } catch (clerkError) {
    // If user is already a member, update the membership instead
    const isAlreadyMember =
      (clerkError.status === 422 &&
        clerkError.errors?.[0]?.code === "form_membership_exists") ||
      (clerkError.status === 400 &&
        clerkError.errors?.[0]?.code === "already_a_member_in_organization");

    if (isAlreadyMember) {
      await this.updateMembershipInClerk(
        clerkUserId,
        clerkOrganizationId,
        publicMetadata
      );
    } else {
      throw clerkError;
    }
  }
};

/**
 * Update membership metadata in Clerk
 */
memberSchema.statics.updateMembershipInClerk = async function (
  clerkUserId,
  clerkOrganizationId,
  publicMetadata
) {
  const { clerkClient } = require("@clerk/express");

  try {
    const { data: memberships } =
      await clerkClient.users.getOrganizationMembershipList({
        userId: clerkUserId,
      });

    const membership = memberships.find(
      (m) => m.organization.id === clerkOrganizationId
    );
    if (!membership) {
      throw new Error("Membership not found in Clerk");
    }

    // Merge with existing publicMetadata
    const currentMetadata = membership.publicMetadata || {};
    const updatedMetadata = {
      ...currentMetadata,
      ...publicMetadata,
    };

    await clerkClient.organizations.updateOrganizationMembershipMetadata({
      organizationId: clerkOrganizationId,
      userId: clerkUserId,
      role: membership.role,
      publicMetadata: updatedMetadata,
    });
  } catch (error) {
    console.error("Error updating membership in Clerk:", error);
    throw error;
  }
};

/**
 * Format member data for checkout/order creation
 */
memberSchema.statics.formatForCheckout = async function (
  member,
  orgMembership
) {
  if (!member || !orgMembership) {
    return null;
  }

  // Use masked fields if available, otherwise fetch from Clerk
  let email = member.maskedEmail || "";
  let phone = member.maskedPhone || "";

  // If masked fields are not available, fetch from Clerk and populate them
  if (!email || !phone) {
    try {
      await member.populateMaskedContactInfo();
      email = member.maskedEmail || "";
      phone = member.maskedPhone || "";
    } catch (error) {
      console.warn(
        "Could not populate masked contact info for checkout:",
        error.message
      );
      // Fallback to fetching from Clerk without storing
      email = await member.getEmailFromClerk();
      phone = await member.getPhoneFromClerk();
    }
  }

  return {
    id: member.clerkUserId, // Use Clerk user ID for external references
    _id: member._id, // Keep MongoDB ObjectId for database relationships
    userId: member.clerkUserId, // Clerk user ID for external references
    clerkUserId: member.clerkUserId, // Explicit Clerk user ID field
    email: email,
    firstName: member.firstName,
    lastName: member.lastName,
    name: member.fullName || member.name,
    phone: phone,
    maskedEmail: member.maskedEmail || "",
    maskedPhone: member.maskedPhone || "",
    imageUrl: member.imageUrl,
    role: orgMembership.role,
    isActive: orgMembership.publicMetadata?.isActive !== false,
    subscribed: orgMembership.publicMetadata?.subscribed === true,
    membershipType: orgMembership.publicMetadata?.membershipType || "basic",
    tags: orgMembership.publicMetadata?.tags || [],
    joinedDate: orgMembership.createdAt,
    customFields: orgMembership.publicMetadata || {},
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    lastSignInAt: member.lastSignInAt,
  };
};

/**
 * Populate masked email and phone fields from Clerk data
 * This method fetches the full user profile from Clerk once and stores only masked versions
 * @param {String} clerkUserId - Clerk user ID
 * @returns {Promise<Object>} - Updated member with masked fields populated
 */
memberSchema.statics.populateMaskedContactInfo = async function (clerkUserId) {
  try {
    const member = await this.findByClerkUserId(clerkUserId);
    if (!member) {
      throw new Error("Member not found");
    }

    // Fetch full user profile from Clerk
    const clerkUser = await clerkClient.users.getUser(clerkUserId);

    let maskedEmail = "";
    let maskedPhone = "";

    // Get and mask email
    if (clerkUser.primaryEmailAddressId) {
      const primaryEmail = clerkUser.emailAddresses?.find(
        (email) => email.id === clerkUser.primaryEmailAddressId
      );
      if (primaryEmail?.emailAddress) {
        maskedEmail = this.maskEmail(primaryEmail.emailAddress);
      }
    }

    // Get and mask phone
    if (clerkUser.primaryPhoneNumberId) {
      const primaryPhone = clerkUser.phoneNumbers?.find(
        (phone) => phone.id === clerkUser.primaryPhoneNumberId
      );
      if (primaryPhone?.phoneNumber) {
        maskedPhone = this.maskPhone(primaryPhone.phoneNumber);
      }
    }

    // Update member with masked fields
    member.maskedEmail = maskedEmail;
    member.maskedPhone = maskedPhone;
    await member.save();

    return member;
  } catch (error) {
    console.error("Error populating masked contact info:", error);
    throw error;
  }
};

/**
 * Populate masked contact info for a member instance
 * @returns {Promise<Object>} - Updated member with masked fields populated
 */
memberSchema.methods.populateMaskedContactInfo = async function () {
  return await this.constructor.populateMaskedContactInfo(this.clerkUserId);
};

/**
 * Populate masked contact info for all members that don't have it
 * Useful for migration or bulk updates
 * @param {Object} options - Options for the operation
 * @param {Number} options.batchSize - Number of members to process at once (default: 50)
 * @param {Number} options.delay - Delay between batches in ms (default: 1000)
 * @returns {Promise<Object>} - Results of the operation
 */
memberSchema.statics.populateMaskedContactInfoForAll = async function (
  options = {}
) {
  const { batchSize = 50, delay = 1000 } = options;

  try {
    console.log("Starting masked contact info population for all members...");

    // Find all members without masked contact info
    const membersWithoutMaskedInfo = await this.find({
      $or: [
        { maskedEmail: { $exists: false } },
        { maskedEmail: "" },
        { maskedEmail: null },
        { maskedPhone: { $exists: false } },
        { maskedPhone: "" },
        { maskedPhone: null },
      ],
    });

    console.log(
      `Found ${membersWithoutMaskedInfo.length} members without masked contact info`
    );

    let processed = 0;
    let success = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < membersWithoutMaskedInfo.length; i += batchSize) {
      const batch = membersWithoutMaskedInfo.slice(i, i + batchSize);

      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          membersWithoutMaskedInfo.length / batchSize
        )}`
      );

      const batchPromises = batch.map(async (member) => {
        try {
          await member.populateMaskedContactInfo();
          success++;
          return { success: true, memberId: member._id };
        } catch (error) {
          failed++;
          console.error(
            `Failed to populate masked contact info for member ${member._id}:`,
            error.message
          );
          return { success: false, memberId: member._id, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      processed += batch.length;

      console.log(
        `Batch completed: ${
          batchResults.filter((r) => r.success).length
        } success, ${batchResults.filter((r) => !r.success).length} failed`
      );

      // Add delay between batches to avoid overwhelming Clerk API
      if (i + batchSize < membersWithoutMaskedInfo.length) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log(
      `Masked contact info population completed: ${success} success, ${failed} failed, ${processed} total`
    );

    return {
      total: membersWithoutMaskedInfo.length,
      processed,
      success,
      failed,
    };
  } catch (error) {
    console.error("Error in populateMaskedContactInfoForAll:", error);
    throw error;
  }
};

/**
 * Fetch all members for an organization with their emails from Clerk API (throttled)
 * This method fetches members directly from Clerk's API instead of local database
 * @param {Object} organization - Organization document
 * @param {Object} options - Options for throttling
 * @param {Number} options.rateLimitDelay - Delay between Clerk API calls in ms (default: 1000)
 * @returns {Promise<Array>} - Array of members with email and phone data
 */
memberSchema.statics.getAllMembersWithEmails = async function (
  organization,
  options = {}
) {
  const { rateLimitDelay = 1000 } = options;
  const { clerkClient } = require("@clerk/express");

  try {
    if (!organization) {
      throw new Error("Organization is required");
    }

    if (!organization.clerkOrganizationId) {
      throw new Error("Organization clerkOrganizationId is required");
    }

    console.log(
      `Fetching members from Clerk API for organization ${organization.clerkOrganizationId}`
    );

    const membersWithEmails = [];
    let offset = 0;
    const limit = 500; // Clerk's maximum per page
    let hasMore = true;
    let totalProcessed = 0;

    // Fetch all memberships from Clerk with pagination
    while (hasMore) {
      try {
        const response =
          await clerkClient.organizations.getOrganizationMembershipList({
            organizationId: organization.clerkOrganizationId,
            limit: limit,
            offset: offset,
          });

        const memberships = response.data || [];
        const totalCount = response.totalCount || 0;

        console.log(
          `Fetched page: ${memberships.length} members (offset: ${offset}, total: ${totalCount})`
        );

        // Process each membership
        for (let i = 0; i < memberships.length; i++) {
          const membership = memberships[i];
          try {
            const publicUserData = membership.publicUserData || {};
            const publicMetadata = membership.publicMetadata || {};
            const userId = publicUserData.userId || membership.userId;

            if (!userId) {
              console.warn("Skipping membership without userId");
              continue;
            }

            // Fetch full user data to get email and phone (publicUserData doesn't include emails)
            let email = "";
            let phone = "";
            let firstName = publicUserData.firstName || "";
            let lastName = publicUserData.lastName || "";
            let username = publicUserData.username || "";
            let imageUrl = publicUserData.imageUrl || "";

            try {
              const fullUser = await clerkClient.users.getUser(userId);
              const primaryEmailId = fullUser.primaryEmailAddressId;
              const primaryPhoneId = fullUser.primaryPhoneNumberId;

              const emailAddresses = fullUser.emailAddresses || [];
              const phoneNumbers = fullUser.phoneNumbers || [];

              const primaryEmail = emailAddresses.find(
                (e) => e.id === primaryEmailId
              );
              const primaryPhone = phoneNumbers.find(
                (p) => p.id === primaryPhoneId
              );

              email = primaryEmail?.emailAddress || "";
              phone = primaryPhone?.phoneNumber || "";

              // Use full user data if publicUserData is missing fields
              if (!firstName) firstName = fullUser.firstName || "";
              if (!lastName) lastName = fullUser.lastName || "";
              if (!username) username = fullUser.username || "";
              if (!imageUrl) imageUrl = fullUser.imageUrl || "";
            } catch (userError) {
              console.warn(
                `Could not fetch full user data for ${userId}:`,
                userError.message
              );
              // Continue with publicUserData only
            }

            // Build full name
            const fullName = [firstName, lastName].filter(Boolean).join(" ");

            // Try to find local member record for additional data
            let localMember = null;
            try {
              localMember = await this.findByClerkUserId(userId);
            } catch (err) {
              // Ignore if local member not found
            }

            membersWithEmails.push({
              id: localMember?._id?.toString() || "",
              clerkUserId: userId,
              firstName: firstName,
              lastName: lastName,
              fullName: fullName,
              username: username,
              email: email,
              phone: phone,
              maskedEmail: localMember?.maskedEmail || "",
              maskedPhone: localMember?.maskedPhone || "",
              imageUrl: imageUrl,
              role: membership.role || "",
              isActive: publicMetadata.isActive !== false,
              subscribed: publicMetadata.subscribed === true,
              membershipType: publicMetadata.membershipType || "basic",
              tags: publicMetadata.tags || [],
              joinedDate: membership.createdAt
                ? new Date(membership.createdAt)
                : null,
              createdAt: localMember?.createdAt
                ? new Date(localMember.createdAt)
                : null,
              updatedAt: localMember?.updatedAt
                ? new Date(localMember.updatedAt)
                : null,
              lastSignInAt: localMember?.lastSignInAt
                ? new Date(localMember.lastSignInAt)
                : null,
            });

            totalProcessed++;
          } catch (error) {
            console.error(
              `Error processing membership for user ${membership.publicUserData?.userId || membership.userId || "unknown"}:`,
              error.message
            );
            // Continue processing other members
          }
        }

        // Check if there are more pages
        hasMore = offset + memberships.length < totalCount;
        offset += memberships.length;

        // Add delay between pages to respect rate limits
        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));
        }

        // Log progress
        if (totalProcessed % 50 === 0 || !hasMore) {
          console.log(
            `Progress: ${totalProcessed}/${totalCount} members processed`
          );
        }
      } catch (error) {
        console.error(
          `Error fetching members page (offset: ${offset}):`,
          error.message
        );
        // If we've already processed some members, return what we have
        if (membersWithEmails.length > 0) {
          console.warn(
            `Returning partial results: ${membersWithEmails.length} members`
          );
          break;
        }
        throw error;
      }
    }

    console.log(
      `Completed fetching members from Clerk: ${totalProcessed} members processed`
    );

    return membersWithEmails;
  } catch (error) {
    console.error("Error getting all members with emails from Clerk:", error);
    throw error;
  }
};

// =====================
// READ OPERATIONS (Local MongoDB)
// =====================

/**
 * Get all members for an organization
 * @param {Object} organization - Organization document
 * @param {Object} filters - Optional filters
 * @param {Number} page - Page number (0-based)
 * @param {Number} pageSize - Page size
 * @returns {Promise<Object>} - Paginated list of members
 */
memberSchema.statics.getOrganizationMembers = async function (
  organization,
  filters = {},
  page = 0,
  pageSize = 50
) {
  try {
    if (!organization) {
      throw new Error("Organization is required");
    }

    const organizationId = organization._id;

    const query = {
      "organizationMemberships.organizationId": organizationId,
    };

    // Apply filters
    if (filters.isActive !== undefined) {
      query["organizationMemberships.publicMetadata.isActive"] =
        filters.isActive;
    }
    if (filters.subscribed !== undefined) {
      query["organizationMemberships.publicMetadata.subscribed"] =
        filters.subscribed;
    }
    if (filters.membershipType) {
      query["organizationMemberships.publicMetadata.membershipType"] =
        filters.membershipType;
    }

    const skip = page * pageSize;
    const members = await this.find(query)
      .limit(pageSize)
      .skip(skip)
      .sort({ "organizationMemberships.createdAt": -1 });

    const totalCount = await this.countDocuments(query);

    // Format members to include organization-specific data
    const formattedMembers = await Promise.all(
      members.map(async (member) => {
        const orgMembership = member.getOrganizationMembership(organization);
        const formattedMember = await this.formatMemberResponse(
          member,
          orgMembership
        );

        // Ensure masked contact info is populated if not already available
        if (
          formattedMember &&
          (!formattedMember.maskedEmail || !formattedMember.maskedPhone)
        ) {
          try {
            if (member.clerkUserId) {
              await this.populateMaskedContactInfo(member.clerkUserId);
            } else {
              console.warn(
                `Member ${member._id} missing clerkUserId; skipping masked contact population`
              );
            }
            // Re-format with updated masked fields
            const updatedMember = await this.findById(member._id);
            const updatedOrgMembership =
              updatedMember.getOrganizationMembership(organization);
            return await this.formatMemberResponse(
              updatedMember,
              updatedOrgMembership
            );
          } catch (error) {
            console.warn(
              `Could not populate masked contact info for member ${member._id}:`,
              error.message
            );
            // Return original formatted member if population fails
          }
        }

        return formattedMember;
      })
    );

    // Filter out any null results
    const validMembers = formattedMembers.filter(Boolean);

    return {
      members: validMembers,
      totalCount,
      hasMore: skip + pageSize < totalCount,
    };
  } catch (error) {
    console.error("Error getting organization members:", error);
    throw error;
  }
};

/**
 * Search members by name or email for an organization
 * @param {Object} organization - Organization document
 * @param {String} searchTerm - Search term
 * @param {Number} page - Page number (0-based)
 * @param {Number} pageSize - Page size
 * @returns {Promise<Array>} - List of matching members
 */
memberSchema.statics.searchMembers = async function (
  organization,
  searchTerm,
  page = 0,
  pageSize = 20
) {
  try {
    if (!organization) {
      throw new Error("Organization is required");
    }

    const skip = page * pageSize;
    const members = await this.searchInOrganization(organization, searchTerm, {
      limit: pageSize,
      skip,
    });

    const formattedMembers = await Promise.all(
      members.map(async (member) => {
        const orgMembership = member.getOrganizationMembership(organization);
        const formattedMember = await this.formatMemberResponse(
          member,
          orgMembership
        );

        // Ensure masked contact info is populated if not already available
        if (
          formattedMember &&
          (!formattedMember.maskedEmail || !formattedMember.maskedPhone)
        ) {
          try {
            if (member.clerkUserId) {
              await this.populateMaskedContactInfo(member.clerkUserId);
            } else {
              console.warn(
                `Member ${member._id} missing clerkUserId; skipping masked contact population`
              );
            }
            // Re-format with updated masked fields
            const updatedMember = await this.findById(member._id);
            const updatedOrgMembership =
              updatedMember.getOrganizationMembership(organization);
            return await this.formatMemberResponse(
              updatedMember,
              updatedOrgMembership
            );
          } catch (error) {
            console.warn(
              `Could not populate masked contact info for member ${member._id}:`,
              error.message
            );
            // Return original formatted member if population fails
          }
        }

        return formattedMember;
      })
    );

    return formattedMembers.filter(Boolean); // Remove any null results
  } catch (error) {
    console.error("Error searching members:", error);
    throw error;
  }
};

/**
 * Wait for member data to be synced from Clerk webhook to local database
 * @param {String} clerkUserId - Clerk user ID
 * @param {Object} organization - Organization document
 * @param {Number} maxRetries - Maximum number of retry attempts
 * @param {Number} delayMs - Delay between retries in milliseconds
 * @returns {Promise<Object|null>} - Synced member data or null if not found after all retries
 */
memberSchema.statics.waitForMemberSync = async function (
  clerkUserId,
  organization,
  maxRetries = 5,
  delayMs = 3000
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `Waiting for member sync (attempt ${attempt}/${maxRetries})...`
      );

      // Wait for the specified delay
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Try to find the member in local database
      const member = await this.getMemberByClerkUserId(
        clerkUserId,
        organization
      );

      if (member) {
        console.log(`Member sync successful on attempt ${attempt}`);
        return member;
      }

      console.log(
        `Member not found in local DB on attempt ${attempt}, retrying...`
      );
    } catch (error) {
      console.warn(
        `Error checking member sync on attempt ${attempt}:`,
        error.message
      );

      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }

  console.error(`Member sync failed after ${maxRetries} attempts`);
  return null;
};

/**
 * Create or invite a new member (creates in Clerk, synced locally via webhooks)
 * @param {Object} memberData - Member data
 * @param {Object} organization - Organization document
 * @param {Object} organizationMemberData - Organization-specific member data
 * @returns {Promise<Object>} - Created member (from local data after webhook sync)
 */
memberSchema.statics.createMember = async function (
  memberData,
  organization,
  organizationMemberData = {}
) {
  try {
    if (!organization) {
      throw new Error("Organization is required");
    }

    // Check if member already exists in this organization
    if (memberData.id) {
      const existingMember = await this.getMemberByClerkUserId(
        memberData.id,
        organization
      );
      if (existingMember) {
        throw new Error("User is already a member of this organization");
      }
    }

    // Check by email
    if (memberData.email) {
      const member = await this.findByEmail(memberData.email);
      if (member) {
        const orgMembership = member.getOrganizationMembership(organization);
        if (orgMembership) {
          throw new Error(
            "User with this email is already a member of this organization"
          );
        }
      }
    }

    // Find or create the Clerk user
    const clerkUser = await this.findOrCreateClerkUser(memberData);

    // Add user to organization
    await this.addUserToOrganization(
      clerkUser.id,
      organization.clerkOrganizationId,
      organizationMemberData
    );

    // Wait for webhook to sync member data to local DB with retry mechanism
    const syncedMember = await this.waitForMemberSync(
      clerkUser.id,
      organization,
      5, // max retries
      3000 // 3 seconds delay
    );

    if (!syncedMember) {
      throw new Error(
        "Failed to sync member data from Clerk webhook after 5 attempts"
      );
    }

    return syncedMember;
  } catch (error) {
    console.error("Error creating member:", error);
    throw error;
  }
};

/**
 * Update member organization-specific data (updates Clerk, synced locally via webhooks)
 * @param {String} userId - Clerk user ID
 * @param {Object} organization - Organization document
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated member
 */
memberSchema.statics.updateMember = async function (
  userId,
  organization,
  updateData
) {
  try {
    if (!userId || !organization) {
      throw new Error("User ID and Organization are required");
    }

    // Validate that member belongs to this organization
    await this.validateMemberInOrganization(userId, organization);

    // Update in Clerk first
    await this.updateMembershipInClerk(
      userId,
      organization.clerkOrganizationId,
      updateData
    );

    // Return updated local data (will be updated by webhook eventually)
    const updatedMember = await this.getMemberByClerkUserId(
      userId,
      organization
    );
    if (!updatedMember) {
      throw new Error("Failed to retrieve updated member");
    }

    return updatedMember;
  } catch (error) {
    console.error("Error updating member:", error);
    throw error;
  }
};

/**
 * Remove member from organization (removes from Clerk, synced locally via webhooks)
 * @param {String} userId - Clerk user ID
 * @param {Object} organization - Organization document
 * @returns {Promise<Object>} - Result message
 */
memberSchema.statics.removeMemberFromOrganization = async function (
  member,
  organization
) {
  try {
    if (!member || !organization) {
      throw new Error("Member and Organization are required");
    }

    // Validate that member belongs to this organization before removing
    await this.validateMemberInOrganization(member, organization);

    // Remove from Clerk
    await clerkClient.organizations.deleteOrganizationMembership({
      organizationId: organization.clerkOrganizationId,
      userId: member.clerkUserId,
    });

    return {
      message: "Member removed from organization",
      memberId: member.clerkUserId,
      organizationId: organization._id.toString(),
    };
  } catch (error) {
    console.error("Error removing member from organization:", error);
    throw error;
  }
};

/**
 * Verify that a member belongs to the specified organization
 * @param {Object} member - Member document
 * @param {Object} organization - Organization document
 * @returns {Promise<Object>} - Member document and organization membership
 * @throws {Error} - If member not found or not in organization
 */
memberSchema.statics.validateMemberInOrganization = async function (
  member,
  organization
) {
  if (!member || !organization) {
    throw new Error("Member and Organization are required");
  }

  if (!member) {
    throw new Error("Member not found");
  }

  const orgMembership = member.getOrganizationMembership(organization);
  if (!orgMembership) {
    throw new Error("Member not found in this organization");
  }

  return { member, orgMembership };
};

/**
 * Get member by Clerk user ID for a specific organization
 * @param {String} clerkUserId - Clerk user ID
 * @param {Object} organization - Organization document
 * @returns {Promise<Object>} - Member with organization membership details
 */
memberSchema.statics.getMemberByClerkUserId = async function (
  clerkUserId,
  organization
) {
  if (!clerkUserId || !organization) {
    return null;
  }

  const member = await this.findByClerkUserId(clerkUserId);
  if (!member) {
    return null;
  }

  const orgMembership = member.getOrganizationMembership(organization);
  if (!orgMembership) {
    return null;
  }

  return await this.formatMemberResponse(member, orgMembership);
};

/**
 * Add user to organization in Clerk
 * @param {String} clerkUserId - Clerk user ID
 * @param {String} clerkOrganizationId - Clerk Organization ID
 * @param {Object} publicMetadata - Organization membership metadata
 * @returns {Promise<void>}
 */
memberSchema.statics.addUserToOrganization = async function (
  clerkUserId,
  clerkOrganizationId,
  publicMetadata = {}
) {
  const membershipData = {
    organizationId: clerkOrganizationId,
    userId: clerkUserId,
    publicMetadata: publicMetadata, // Store exactly as provided
    role: "org:member",
  };

  try {
    await clerkClient.organizations.createOrganizationMembership(
      membershipData
    );
  } catch (clerkError) {
    // If user is already a member, update the membership instead
    if (
      (clerkError.status === 422 &&
        clerkError.errors?.[0]?.code === "form_membership_exists") ||
      (clerkError.status === 400 &&
        clerkError.errors?.[0]?.code === "already_a_member_in_organization")
    ) {
      await this.updateMembershipInClerk(
        clerkUserId,
        clerkOrganizationId,
        publicMetadata
      );
    } else {
      throw clerkError;
    }
  }
};

/**
 * Format member response from local member and organization membership
 * @param {Object} member - Local Member document
 * @param {Object} orgMembership - Organization membership data
 * @returns {Object} - Formatted member object
 */
memberSchema.statics.formatMemberResponse = async function (
  member,
  orgMembership,
  fetchClerkContactInfo = false
) {
  if (!member || !orgMembership) {
    return null;
  }

  // Always try to fetch full email and phone from Clerk first
  let email = "";
  let phone = "";

  try {
    // Fetch full contact info from Clerk
    if (fetchClerkContactInfo) {
      email = await member.getEmailFromClerk();
      phone = await member.getPhoneFromClerk();
    } else {
      email = member.maskedEmail || "";
      phone = member.maskedPhone || "";
    }
  } catch (error) {
    console.warn("Could not fetch contact info from Clerk:", error.message);
    // Fallback to masked fields if Clerk fetch fails
    email = member.maskedEmail || "";
    phone = member.maskedPhone || "";
  }

  return {
    ...member.toObject(),
    email: email,
    phone: phone,
    maskedEmail: member.maskedEmail || "",
    maskedPhone: member.maskedPhone || "",
    organizationMembership: orgMembership,
    organizationMemberships: undefined,
  };
};

const Member = mongoose.model("Member", memberSchema);

module.exports = Member;
