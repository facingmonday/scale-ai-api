const { clerkClient } = require("@clerk/express");
const { slugify } = require("../../utils/utils.controller");

module.exports = async function createOrg(req, res) {
  try {
    const { organizationName, publicMetadata } = req.body;
    const userId = req.user.clerkUserId;

    if (!userId)
      return res.status(401).json({ error: "Authentication required" });

    if (!organizationName)
      return res.status(400).json({ error: "Organization name is required" });

    const organizationSlug = slugify(organizationName);

    const org = await clerkClient.organizations.createOrganization({
      name: organizationName,
      createdBy: userId,
      slug: organizationSlug,
      publicMetadata: publicMetadata,
    });

    return res.status(201).json({
      success: true,
      message: "Organization created successfully",
      data: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        publicMetadata: org.publicMetadata,
        privateMetadata: org.privateMetadata,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating organization:", error);
    if (error?.errors?.length) {
      const e = error.errors[0];
      return res.status(400).json({
        error: "Failed to create organization",
        message: e.message,
        code: e.code,
      });
    }
    return res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};
