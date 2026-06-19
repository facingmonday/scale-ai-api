const Member = require("../../members/member.model");
const Organization = require("../../organizations/organization.model");
const ClassroomTemplate = require("../../classroomTemplate/classroomTemplate.model");
const BillingSubscription = require("../../licensing/billingSubscription.model");
const SeatPool = require("../../licensing/seatPool.model");
const { getPlan } = require("../../licensing/planCatalog");

// Helper function to convert Clerk user to Member data
const convertClerkUserToMemberData = (clerkUser) => {
  const primaryEmail = clerkUser.email_addresses?.find(
    (email) => email.id === clerkUser.primary_email_address_id
  );
  const primaryPhone = clerkUser.phone_numbers?.find(
    (phone) => phone.id === clerkUser.primary_phone_number_id
  );
  const primaryWeb3Wallet = clerkUser.web3_wallets?.find(
    (wallet) => wallet.id === clerkUser.primary_web3_wallet_id
  );

  return {
    clerkUserId: clerkUser.id,
    username: clerkUser.username,
    email: primaryEmail?.email_address || "",
    firstName: clerkUser.first_name,
    lastName: clerkUser.last_name,
    phone: primaryPhone?.phone_number,
    imageUrl: clerkUser.image_url,
    hasImage: clerkUser.has_image,
    primaryEmailAddressId: clerkUser.primary_email_address_id,
    primaryPhoneNumberId: clerkUser.primary_phone_number_id,
    primaryWeb3WalletId: clerkUser.primary_web3_wallet_id,
    emailAddresses:
      clerkUser.email_addresses?.map((email) => ({
        id: email.id,
        verification: email.verification,
      })) || [],
    phoneNumbers:
      clerkUser.phone_numbers?.map((phone) => ({
        id: phone.id,
        verification: phone.verification,
      })) || [],
    web3Wallets: clerkUser.web3_wallets || [],
    externalAccounts:
      clerkUser.external_accounts?.map((account) => ({
        id: account.id,
        provider: account.provider,
        providerUserId: account.provider_user_id,
        verification: account.verification,
      })) || [],
    publicMetadata: clerkUser.public_metadata || {},
    privateMetadata: clerkUser.private_metadata || {},
    unsafeMetadata: clerkUser.unsafe_metadata || {},
    passwordEnabled: clerkUser.password_enabled,
    twoFactorEnabled: clerkUser.two_factor_enabled,
    totpEnabled: clerkUser.totp_enabled,
    backupCodeEnabled: clerkUser.backup_code_enabled,
    externalId: clerkUser.external_id,
    banned: clerkUser.banned,
    locked: clerkUser.locked,
    lockoutExpiresInSeconds: clerkUser.lockout_expires_in_seconds,
    verificationAttemptsRemaining: clerkUser.verification_attempts_remaining,
    deleteSelfEnabled: clerkUser.delete_self_enabled,
    createOrganizationEnabled: clerkUser.create_organization_enabled,
    lastActiveAt: clerkUser.last_active_at
      ? new Date(clerkUser.last_active_at)
      : null,
    clerkCreatedAt: new Date(clerkUser.created_at),
    clerkUpdatedAt: new Date(clerkUser.updated_at),
    createdAt: new Date(clerkUser.created_at),
    updatedAt: new Date(clerkUser.updated_at),
    lastSignInAt: clerkUser.last_sign_in_at
      ? new Date(clerkUser.last_sign_in_at)
      : null,
  };
};

// Helper function to convert Clerk organization to Organization data
const convertClerkOrgToOrgData = (clerkOrg) => {
  return {
    clerkOrganizationId: clerkOrg.id,
    name: clerkOrg.name,
    slug: clerkOrg.slug,
    imageUrl: clerkOrg.image_url,
    maxAllowedMemberships: clerkOrg.max_allowed_memberships,
    adminDeleteEnabled: clerkOrg.admin_delete_enabled,
    publicMetadata: clerkOrg.public_metadata || {},
    privateMetadata: clerkOrg.private_metadata || {},
    clerkCreatedAt: new Date(clerkOrg.created_at),
    clerkUpdatedAt: new Date(clerkOrg.updated_at),
  };
};

// User event handlers
const userCreated = async (userData) => {
  try {
    console.log("Processing user.created webhook for user:", userData.id);

    const memberData = convertClerkUserToMemberData(userData);

    // Atomic upsert to avoid duplicate key races
    const member = await Member.findOneAndUpdate(
      { clerkUserId: userData.id },
      { $set: memberData },
      { new: true, upsert: true }
    );

    // Populate masked contact info from webhook data (avoids API call)
    try {
      await Member.populateMaskedContactInfoFromWebhook(member, userData);
      console.log(
        "Upserted member and populated masked contact info:",
        member.clerkUserId
      );
    } catch (error) {
      console.warn(
        "Could not populate masked contact info for member:",
        error.message
      );
    }

    return member;
  } catch (error) {
    console.error("Error processing user.created webhook:", error);
    throw error;
  }
};

const userUpdated = async (userData) => {
  try {
    console.log("Processing user.updated webhook for user:", userData.id);

    const memberData = convertClerkUserToMemberData(userData);

    // Atomic upsert to avoid duplicate key races
    const member = await Member.findOneAndUpdate(
      { clerkUserId: userData.id },
      { $set: memberData },
      { new: true, upsert: true }
    );

    // Update masked contact info from webhook data (avoids API call)
    try {
      await Member.populateMaskedContactInfoFromWebhook(member, userData);
      console.log(
        "Updated masked contact info for member:",
        member.clerkUserId
      );
    } catch (error) {
      console.warn(
        "Could not update masked contact info for member:",
        error.message
      );
    }

    return member;
  } catch (error) {
    console.error("Error processing user.updated webhook:", error);
    throw error;
  }
};

const userDeleted = async (userData) => {
  try {
    console.log("Processing user.deleted webhook for user:", userData.id);

    const member = await Member.findByClerkUserId(userData.id);

    if (member) {
      // Remove the member entirely
      await Member.deleteOne({ clerkUserId: userData.id });
      console.log("Deleted member:", userData.id);
    } else {
      console.log("Member not found for deletion:", userData.id);
    }
  } catch (error) {
    console.error("Error processing user.deleted webhook:", error);
    throw error;
  }
};

// Organization event handlers
const organizationCreated = async (orgData) => {
  try {
    console.log("Processing organization.created webhook for org:", orgData.id);

    const organizationData = convertClerkOrgToOrgData(orgData);

    // Check if organization already exists
    let organization = await Organization.findByClerkId(orgData.id);

    if (!organization) {
      organization = new Organization(organizationData);
      await organization.save();
      console.log(
        "Created new organization:",
        organization.clerkOrganizationId
      );
      // Ensure this organization has at least one classroom template by copying the global default
      try {
        const createdBy = orgData.created_by || "system_webhook";
        await ClassroomTemplate.copyGlobalToOrganization(
          organization._id,
          createdBy
        );
      } catch (e) {
        console.error(
          "⚠️  Failed to copy global ClassroomTemplate to new organization:",
          e?.message || e
        );
      }

      // Seed default organization-level tags
      try {
        const Tag = require("../../tags/tags.model");
        const slugify = require("slugify");
        const DEFAULT_ORG_TAGS = [
          { title: "Lecture Slides", color: "#4f46e5", description: "Standard lecture slide decks" },
          { title: "Case Studies", color: "#0891b2", description: "Pizza shop scenario case studies" },
          { title: "Homework Handouts", color: "#16a34a", description: "Homework assignments and handouts" },
          { title: "Class Templates", color: "#ea580c", description: "Operational templates and guidelines" }
        ];

        const createdBy = orgData.created_by || "system_webhook";

        for (const defaultTag of DEFAULT_ORG_TAGS) {
          const slug = slugify(defaultTag.title, { lower: true, strict: true });
          await Tag.findOneAndUpdate(
            { organization: organization._id, slug, classroomId: null },
            {
              $set: {
                title: defaultTag.title,
                slug,
                description: defaultTag.description,
                color: defaultTag.color,
                type: "tag",
                createdBy,
                updatedBy: createdBy,
              }
            },
            { upsert: true }
          );
        }
        console.log(`Seeded default organization-level tags for org: ${organization.clerkOrganizationId}`);
      } catch (tagError) {
        console.error("⚠️ Failed to seed default organization-level tags:", tagError.message);
      }
    } else {
      console.log(
        "Organization already exists:",
        organization.clerkOrganizationId
      );
    }

    return organization;
  } catch (error) {
    console.error("Error processing organization.created webhook:", error);
    throw error;
  }
};

const organizationUpdated = async (orgData) => {
  try {
    console.log("Processing organization.updated webhook for org:", orgData.id);

    const organizationData = convertClerkOrgToOrgData(orgData);

    let organization = await Organization.findByClerkId(orgData.id);

    if (organization) {
      // Update existing organization
      Object.assign(organization, organizationData);
      await organization.save();
      console.log("Updated organization:", organization.clerkOrganizationId);
    } else {
      // Create new organization if it doesn't exist
      organization = new Organization(organizationData);
      await organization.save();
      console.log(
        "Created new organization from update:",
        organization.clerkOrganizationId
      );
    }

    return organization;
  } catch (error) {
    console.error("Error processing organization.updated webhook:", error);
    throw error;
  }
};

const organizationDeleted = async (orgData) => {
  try {
    console.log("Processing organization.deleted webhook for org:", orgData.id);

    // Remove organization
    await Organization.deleteOne({ clerkOrganizationId: orgData.id });

    // Remove all memberships for this organization from all members
    await Member.updateMany(
      { "organizationMemberships.organization.id": orgData.id },
      { $pull: { organizationMemberships: { "organization.id": orgData.id } } }
    );

    console.log("Deleted organization and all memberships:", orgData.id);
  } catch (error) {
    console.error("Error processing organization.deleted webhook:", error);
    throw error;
  }
};

// Utility function for waiting for organization to be available
const waitForOrganization = async (
  organizationId,
  { timeoutMs = 120000, intervalMs = 2000 } = {} // 2 minutes default, 2 second intervals
) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const doc = await Organization.findByClerkId(organizationId);
    if (doc) return doc;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
};

// Organization membership event handlers
const organizationMembershipCreated = async (membershipData) => {
  try {
    console.log(
      "Processing organizationMembership.created webhook for user:",
      membershipData.public_user_data.user_id
    );

    const clerkUserId = membershipData.public_user_data.user_id;
    const clerkOrganizationId = membershipData.organization.id;

    // Ensure member exists (atomic upsert to avoid races with user.* webhooks)
    const baseMemberData = {
      clerkUserId: clerkUserId,
      firstName: membershipData.public_user_data.first_name || "",
      lastName: membershipData.public_user_data.last_name || "",
      username: "",
      imageUrl: membershipData.public_user_data.image_url || "",
      hasImage: !!membershipData.public_user_data.image_url,
      primaryEmailAddressId: "webhook_email_id",
      emailAddresses: [
        {
          id: "webhook_email_id",
          verification: { status: "verified", strategy: "email_code" },
        },
      ],
      phoneNumbers: [],
      web3Wallets: [],
      externalAccounts: [],
      publicMetadata: {},
      privateMetadata: {},
      unsafeMetadata: {},
      passwordEnabled: false,
      twoFactorEnabled: false,
      totpEnabled: false,
      backupCodeEnabled: false,
      createOrganizationEnabled: false,
      createOrganizationsLimit: 0,
      deleteSelfEnabled: true,
      hasVerifiedEmailAddress: !!membershipData.public_user_data.email_address,
      hasVerifiedPhoneNumber: false,
      createdAt: new Date(membershipData.created_at),
    };

    const member = await Member.findOneAndUpdate(
      { clerkUserId: clerkUserId },
      { $setOnInsert: baseMemberData },
      { new: true, upsert: true }
    );

    // Try to find organization immediately
    let organization = await Organization.findByClerkId(clerkOrganizationId);

    // If organization not found, wait for it (webhook might be delayed)
    if (!organization) {
      console.log(
        "Organization not found immediately, waiting for webhook...",
        {
          clerkOrganizationId,
          timeoutMs: 120000, // 2 minutes
        }
      );

      organization = await waitForOrganization(clerkOrganizationId, {
        timeoutMs: 30000, // 30 seconds for webhook challenges
        intervalMs: 2000, // Check every 2 seconds
      });

      if (!organization) {
        console.log(
          "Organization not found after waiting, skipping membership creation:",
          {
            clerkOrganizationId,
          }
        );
        return;
      }

      console.log("Organization found after waiting:", {
        clerkOrganizationId,
        organizationId: organization._id.toString(),
      });
    }

    // member now exists (created or fetched)

    // Create Clerk membership object structure
    const clerkMembership = {
      id: membershipData.id,
      role: membershipData.role,
      publicMetadata: membershipData.public_metadata || {},
      createdAt: new Date(membershipData.created_at),
    };

    member.addOrganizationMembership(organization, clerkMembership);
    await member.save();

    console.log(
      "Added organization membership:",
      member.clerkUserId,
      organization._id.toString()
    );
    return member;
  } catch (error) {
    console.error(
      "Error processing organizationMembership.created webhook:",
      error
    );
    throw error;
  }
};

const organizationMembershipUpdated = async (membershipData) => {
  try {
    console.log(
      "Processing organizationMembership.updated webhook for user:",
      membershipData.public_user_data.user_id
    );

    const clerkUserId = membershipData.public_user_data.user_id;
    const clerkOrganizationId = membershipData.organization.id;

    const member = await Member.findByClerkUserId(clerkUserId);
    const organization = await Organization.findByClerkId(clerkOrganizationId);

    if (member && organization) {
      // Create Clerk membership object structure for update
      const clerkMembership = {
        id: membershipData.id,
        role: membershipData.role,
        publicMetadata: membershipData.public_metadata || {},
        createdAt: new Date(membershipData.created_at),
      };

      member.updateOrganizationMembership(organization, clerkMembership);
      await member.save();

      console.log("Updated organization membership:", {
        clerkUserId,
        clerkOrganizationId,
      });
    } else {
      console.log(
        "Member or organization not found for membership update:",
        clerkUserId
      );
    }

    return member;
  } catch (error) {
    console.error(
      "Error processing organizationMembership.updated webhook:",
      error
    );
    throw error;
  }
};

const organizationMembershipDeleted = async (membershipData) => {
  try {
    console.log(
      "Processing organizationMembership.deleted webhook for user:",
      membershipData
    );

    const clerkUserId = membershipData.public_user_data.user_id;
    const clerkOrganizationId = membershipData.organization.id;

    const member = await Member.findByClerkUserId(clerkUserId);
    const organization = await Organization.findByClerkId(clerkOrganizationId);

    if (member && organization) {
      member.removeOrganizationMembership(organization);
      await member.save();
      console.log("Removed organization membership:", {
        clerkUserId,
        clerkOrganizationId,
      });
    } else {
      console.log(
        "Member or organization not found for membership deletion:",
        clerkUserId
      );
    }

    return member;
  } catch (error) {
    console.error(
      "Error processing organizationMembership.deleted webhook:",
      error
    );
    throw error;
  }
};

function readBillingPlanKey(data) {
  return (
    data?.plan?.key ||
    data?.plan?.slug ||
    data?.plan_key ||
    data?.planId ||
    data?.plan_id ||
    data?.items?.[0]?.plan?.key ||
    data?.items?.[0]?.plan?.slug ||
    data?.metadata?.planKey ||
    data?.metadata?.plan_key ||
    "unknown"
  );
}

function readSubscriptionStatus(type, data) {
  if (type.includes("canceled") || type.includes("ended")) return "canceled";
  if (type.includes("past_due")) return "past_due";
  return data?.status || "active";
}

async function billingSubscriptionUpdated(type, data) {
  const planKey = readBillingPlanKey(data);
  const plan = getPlan(planKey);
  const status = readSubscriptionStatus(type, data);
  const clerkSubscriptionId =
    data?.id || data?.subscription_id || data?.subscriptionId;
  const clerkCustomerId = data?.customer_id || data?.customerId;
  const clerkOrganizationId =
    data?.organization_id ||
    data?.organizationId ||
    data?.org_id ||
    data?.metadata?.organizationId ||
    data?.metadata?.orgId;
  const clerkUserId =
    data?.user_id || data?.userId || data?.metadata?.userId || data?.customer?.user_id;

  let organization = null;
  if (clerkOrganizationId) {
    organization = await Organization.findByClerkId(clerkOrganizationId);
  }

  let member = null;
  if (clerkUserId) {
    member = await Member.findByClerkUserId(clerkUserId);
  }

  if (!organization && member?.organizationMemberships?.length) {
    organization = await Organization.findById(
      member.organizationMemberships[0].organizationId
    );
  }

  if (!organization) {
    console.log("Skipping billing subscription without organization context", {
      type,
      clerkSubscriptionId,
      planKey,
    });
    return null;
  }

  const purchaserScope = plan?.purchaserScope || (member ? "user" : "organization");
  if (!clerkSubscriptionId) {
    console.log("Skipping billing subscription without subscription id", {
      type,
      planKey,
    });
    return null;
  }

  const subscription = await BillingSubscription.findOneAndUpdate(
    { clerkSubscriptionId },
    {
      $set: {
        clerkSubscriptionId,
        clerkCustomerId,
        planKey,
        status,
        purchaserScope,
        purchaserUserId: member?._id,
        purchaserOrganizationId: organization._id,
        organization: organization._id,
        updatedBy: "clerk_billing_webhook",
        currentPeriodStart: data?.current_period_start
          ? new Date(data.current_period_start)
          : undefined,
        currentPeriodEnd: data?.current_period_end
          ? new Date(data.current_period_end)
          : undefined,
        canceledAt: data?.canceled_at ? new Date(data.canceled_at) : undefined,
        metadata: data?.metadata || {},
      },
      $setOnInsert: {
        createdBy: "clerk_billing_webhook",
      },
    },
    { new: true, upsert: true }
  );

  const seatCount = data?.metadata?.seatCount
    ? Number(data.metadata.seatCount)
    : plan?.seatCount ?? 1;

  await SeatPool.findOneAndUpdate(
    { billingSubscriptionId: subscription._id },
    {
      $set: {
        billingSubscriptionId: subscription._id,
        planKey,
        scope: plan?.seatPoolScope || (purchaserScope === "user" ? "user" : "organization"),
        purchaserUserId: member?._id,
        purchaserOrganizationId: organization._id,
        totalSeats: seatCount,
        status:
          status === "active" || status === "trialing"
            ? "active"
            : status === "past_due"
              ? "past_due"
              : "canceled",
        organization: organization._id,
        updatedBy: "clerk_billing_webhook",
        metadata: data?.metadata || {},
      },
      $setOnInsert: {
        createdBy: "clerk_billing_webhook",
      },
    },
    { new: true, upsert: true }
  );

  return subscription;
}

// Main webhook handler
const handleClerkWebhook = async (req, res) => {
  try {
    const { type, data } = req.evt;

    console.log("Received Clerk webhook:", type);

    switch (type) {
      // User events
      case "user.created":
        await userCreated(data);
        break;
      case "user.updated":
        await userUpdated(data);
        break;
      case "user.deleted":
        await userDeleted(data);
        break;

      // Organization events
      case "organization.created":
        await organizationCreated(data);
        break;
      case "organization.updated":
        await organizationUpdated(data);
        break;
      case "organization.deleted":
        await organizationDeleted(data);
        break;

      // Organization membership events
      case "organizationMembership.created":
        await organizationMembershipCreated(data);
        break;
      case "organizationMembership.updated":
        await organizationMembershipUpdated(data);
        break;
      case "organizationMembership.deleted":
        await organizationMembershipDeleted(data);
        break;

      case "subscription.created":
      case "subscription.updated":
      case "subscription.active":
      case "subscription.past_due":
      case "subscription.canceled":
      case "subscription.ended":
      case "commerce.subscription.created":
      case "commerce.subscription.updated":
      case "commerce.subscription.active":
      case "commerce.subscription.past_due":
      case "commerce.subscription.canceled":
        await billingSubscriptionUpdated(type, data);
        break;

      default:
        console.log("Unhandled webhook type:", type);
    }

    res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Error processing Clerk webhook:", error);
    res.status(500).json({
      success: false,
      message: "Error processing webhook",
      error: error.message,
    });
  }
};

module.exports = {
  handleClerkWebhook,
};
