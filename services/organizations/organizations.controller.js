const { clerkClient } = require("@clerk/express");
const Organization = require("./organization.model");

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
