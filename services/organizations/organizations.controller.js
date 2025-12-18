const { clerkClient } = require("@clerk/express");
const Organization = require("./organization.model");
const Member = require("../members/member.model");

/**
 * Get all organizations
 */
exports.getAllOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.find({})
      .select("-privateMetadata -stripeAccountId -__v")
      .lean();

    // Format the response to only include public data
    const publicOrganizations = organizations.map((org) => ({
      _id: org._id,
      id: org.clerkOrganizationId,
      name: org.name,
      slug: org.slug,
      imageUrl: org.imageUrl,
      maxAllowedMemberships: org.maxAllowedMemberships,
      publicMetadata: org.publicMetadata,
      createdAt: org.clerkCreatedAt,
      updatedAt: org.clerkUpdatedAt,
    }));

    return res.status(200).json({
      success: true,
      data: publicOrganizations,
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch organizations",
    });
  }
};

/**
 * Join an organization
 */
exports.joinOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.clerkUser?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Find the organization in the database
    const organization = await Organization.findByClerkId(organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    try {
      // Create membership in Clerk
      const membershipPayload = {
        organizationId,
        userId,
        role: "org:member", // Default role for new members
      };

      const clerkMembership =
        await clerkClient.organizations.createOrganizationMembership(
          membershipPayload
        );

      // The webhook will handle updating the member document in the database
      // Return only public organization data
      return res.status(200).json({
        success: true,
        message: "Successfully joined organization",
        data: {
          _id: organization._id,
          organizationId: organization.clerkOrganizationId,
          organizationName: organization.name,
          organizationSlug: organization.slug,
          organizationImageUrl: organization.imageUrl,
          role: clerkMembership.role,
        },
      });
    } catch (clerkError) {
      // Check if user is already a member
      const isAlreadyMember =
        (clerkError.status === 422 &&
          clerkError.errors?.[0]?.code === "form_membership_exists") ||
        (clerkError.status === 400 &&
          clerkError.errors?.[0]?.code === "already_a_member_in_organization");

      if (isAlreadyMember) {
        return res.status(409).json({
          success: false,
          message: "You are already a member of this organization",
        });
      }

      // Re-throw other Clerk errors to be handled by outer catch
      throw clerkError;
    }
  } catch (error) {
    console.error("Error joining organization:", {
      message: error?.message,
      status: error?.status,
      code: error?.errors?.[0]?.code,
      data: error?.errors,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to join organization",
    });
  }
};

exports.createOrganization = async (req, res) => {
  try {
    const { name, slug, imageUrl } = req.body;
    const userId = req.clerkUser?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Organization name is required" });
    }

    // Generate slug if not provided
    const organizationSlug = slug || name.toLowerCase().replace(/\s+/g, "-");

    // Check if organization already exists in database by slug
    const existingOrgBySlug = await Organization.findBySlug(organizationSlug);
    if (existingOrgBySlug) {
      return res.status(409).json({
        success: false,
        message: "Organization with this slug already exists",
      });
    }

    // Check if organization already exists in database by name
    const existingOrgByName = await Organization.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existingOrgByName) {
      return res.status(409).json({
        success: false,
        message: "Organization with this name already exists",
      });
    }

    // 1) Create the organization in Clerk
    const clerkOrganization =
      await clerkClient.organizations.createOrganization({
        name,
        createdBy: userId,
        imageUrl,
        slug: organizationSlug,
        maxAllowedMemberships: 0, //Zero means no seat cap
      });

    //You have to set the current organization client side with clerks.setActive({ organization: organizationId });

    // Poll every second until the member is found (with a sensible timeout)
    const waitForOrganization = async (
      organizationId,
      { timeoutMs = 30000, intervalMs = 1000 } = {}
    ) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const doc = await Organization.findByClerkId(organizationId);
        if (doc) return doc;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      return null;
    };

    const organization = await waitForOrganization(clerkOrganization.id);

    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    return res.status(201).json({
      success: true,
      message: "Organization created successfully",
      data: {
        id: clerkOrganization.id,
        name: clerkOrganization.name,
        slug: clerkOrganization.slug,
        imageUrl: clerkOrganization.imageUrl,
        maxAllowedMemberships: clerkOrganization.maxAllowedMemberships,
        publicMetadata: clerkOrganization.publicMetadata,
        privateMetadata: clerkOrganization.privateMetadata,
        createdAt: clerkOrganization.createdAt,
        updatedAt: clerkOrganization.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating organization:", {
      message: error?.message,
      code: error?.errors?.[0]?.code,
      data: error?.errors,
    });

    return res
      .status(500)
      .json({ success: false, message: "Failed to create organization" });
  }
};
