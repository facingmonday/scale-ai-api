const mongoose = require("mongoose");
/**
 * @openapi
 * components:
 *   schemas:
 *     Organization:
 *       type: object
 *       required:
 *         - clerkOrganizationId
 *         - name
 *         - slug
 *       properties:
 *         _id:
 *           type: string
 *         clerkOrganizationId:
 *           type: string
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         imageUrl:
 *           type: string
 *         maxAllowedMemberships:
 *           type: number
 *         adminDeleteEnabled:
 *           type: boolean
 *         stripeAccountId:
 *           type: string
 *         publicMetadata:
 *           type: object
 *         privateMetadata:
 *           type: object
 *         clerkCreatedAt:
 *           type: string
 *           format: date-time
 *         clerkUpdatedAt:
 *           type: string
 *           format: date-time
 */
const organizationSchema = new mongoose.Schema(
  {
    // Clerk organization data
    clerkOrganizationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    imageUrl: String,

    // Organization settings
    maxAllowedMemberships: {
      type: Number,
      default: 1000,
    },
    adminDeleteEnabled: {
      type: Boolean,
      default: true,
    },

    // Stripe integration
    stripeAccountId: String,

    // Metadata
    publicMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    privateMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Clerk timestamps
    clerkCreatedAt: Date,
    clerkUpdatedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Static methods
organizationSchema.statics.findByClerkId = function (clerkOrganizationId) {
  return this.findOne({ clerkOrganizationId });
};

organizationSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug });
};

organizationSchema.statics.ensureByClerkId = async function (clerkOrganizationId) {
  const { clerkClient } = require("@clerk/express");

  let organization = await this.findByClerkId(clerkOrganizationId);
  if (organization) return organization;

  const clerkOrg = await clerkClient.organizations.getOrganization({
    organizationId: clerkOrganizationId,
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

  organization = await this.findOneAndUpdate(
    { clerkOrganizationId: clerkOrg.id },
    { $set: organizationData },
    { new: true, upsert: true },
  );

  return organization;
};

organizationSchema.statics.calculateApplicationFeeAmount = function (
  organization,
  totalAmount
) {
  const applicationFeePercentage =
    organization?.privateMetadata?.applicationFeePercentage || 0.03;
  return parseInt(totalAmount * applicationFeePercentage);
};

// Virtual for member count (you'd need to aggregate from Member model)
organizationSchema.virtual("memberCount", {
  ref: "Member",
  localField: "clerkOrganizationId",
  foreignField: "organizations.organizationId",
  count: true,
});

const Organization = mongoose.model("Organization", organizationSchema);

module.exports = Organization;
