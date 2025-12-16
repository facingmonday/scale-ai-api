const { clerkClient } = require("@clerk/express");
const axios = require("axios");
const { slugify } = require("../../utils/utils.controller");
const Organization = require("../../organizations/organization.model");

module.exports = async function updateOrg(req, res) {
  try {
    const { organizationName, imageUrl } = req.body;
    const userId = req.user.clerkUserId;
    const organizationId = req.params.id; // Get organization ID from route parameter

    if (!userId)
      return res.status(401).json({ error: "Authentication required" });

    if (!organizationId)
      return res.status(400).json({ error: "Organization ID is required" });

    // Find the organization in our database
    const organization = await Organization.findOne({
      clerkOrganizationId: organizationId,
    });

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Verify user is an admin of this specific organization
    try {
      const memberships =
        await clerkClient.organizations.getOrganizationMembershipList({
          userId: userId,
          organizationId: organizationId,
        });

      if (!memberships || !memberships.data || memberships.data.length === 0) {
        return res
          .status(403)
          .json({ error: "User is not a member of this organization" });
      }

      const membership = memberships.data.find(
        (m) => m.publicUserData.userId === userId
      );

      if (!membership) {
        return res
          .status(403)
          .json({ error: "User is not a member of this organization" });
      }

      if (membership.role !== "org:admin") {
        return res
          .status(403)
          .json({ error: "User must be an admin to update this organization" });
      }
    } catch (authError) {
      console.error("Error verifying organization membership:", authError);
      return res
        .status(500)
        .json({ error: "Error verifying organization permissions" });
    }

    // Update organization name if provided
    if (organizationName) {
      const organizationSlug = slugify(organizationName);
      await clerkClient.organizations.updateOrganization(organizationId, {
        name: organizationName,
        slug: organizationSlug,
      });
    }

    if (imageUrl) {
      try {
        const resp = await axios.get(imageUrl, { responseType: "arraybuffer" });
        const fileBuffer = Buffer.from(resp.data);

        const contentType = resp.headers["content-type"] || "image/jpeg";

        const file = new File([fileBuffer], "organization-logo", {
          type: contentType,
        });

        await clerkClient.organizations.updateOrganizationLogo(organizationId, {
          file: file,
          uploaderUserId: userId, // optional
        });
      } catch (e) {
        console.warn("Logo upload failed:", e?.message || e);
        return res.status(400).json({ error: "Logo upload failed" });
      }
    }

    const updated = await clerkClient.organizations.getOrganization({
      organizationId: organizationId,
    });

    return res.status(200).json({
      success: true,
      message: "Organization updated successfully",
      data: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        publicMetadata: updated.publicMetadata,
        privateMetadata: updated.privateMetadata,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    if (error?.errors?.length) {
      const e = error.errors[0];
      return res.status(400).json({
        error: "Failed to update organization",
        message: e.message,
        code: e.code,
      });
    }
    return res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};
