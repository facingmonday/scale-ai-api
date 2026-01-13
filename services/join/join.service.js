const { clerkClient } = require("@clerk/express");
const Organization = require("../organizations/organization.model");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("../enrollment/enrollment.model");

async function ensureOrganizationByClerkId(clerkOrganizationId) {
  let organization = await Organization.findByClerkId(clerkOrganizationId);
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

  organization = await Organization.findOneAndUpdate(
    { clerkOrganizationId: clerkOrg.id },
    { $set: organizationData },
    { new: true, upsert: true }
  );

  return organization;
}

async function getOrCreateClerkOrgMembership(clerkOrganizationId, clerkUserId) {
  const memberships =
    await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: clerkOrganizationId,
      userId: clerkUserId,
    });

  const existing = memberships?.data?.find(
    (m) => m.publicUserData?.userId === clerkUserId
  );
  if (existing) return existing;

  try {
    return await clerkClient.organizations.createOrganizationMembership({
      organizationId: clerkOrganizationId,
      userId: clerkUserId,
      role: "org:member",
    });
  } catch (clerkError) {
    const isAlreadyMember =
      (clerkError.status === 422 &&
        clerkError.errors?.[0]?.code === "form_membership_exists") ||
      (clerkError.status === 400 &&
        clerkError.errors?.[0]?.code === "already_a_member_in_organization");

    if (!isAlreadyMember) throw clerkError;

    const membershipsRetry =
      await clerkClient.organizations.getOrganizationMembershipList({
        organizationId: clerkOrganizationId,
        userId: clerkUserId,
      });

    const existingRetry = membershipsRetry?.data?.find(
      (m) => m.publicUserData?.userId === clerkUserId
    );

    if (!existingRetry) {
      throw new Error(
        "Could not verify organization membership after Clerk reported membership exists"
      );
    }

    return existingRetry;
  }
}

async function syncMemberOrgMembership(member, organization, clerkMembership) {
  if (!member || !organization || !clerkMembership) return;

  const membershipData = {
    id: clerkMembership.id,
    role: clerkMembership.role,
    publicMetadata: clerkMembership.publicMetadata || {},
    createdAt: new Date(clerkMembership.createdAt),
    updatedAt: new Date(clerkMembership.updatedAt),
  };

  const existing = member.getOrganizationMembership(organization);
  if (existing) {
    member.updateOrganizationMembership(organization, membershipData);
  } else {
    member.addOrganizationMembership(organization, membershipData);
  }

  await member.save();
}

async function ensureEnrollment({
  classroomId,
  memberId,
  role,
  organizationId,
  clerkUserId,
}) {
  // Idempotent enrollment: return existing if present; restore if soft-deleted; otherwise create.
  let enrollment = await Enrollment.findOne({
    classroomId,
    userId: memberId,
  });

  if (enrollment && !enrollment.isRemoved) {
    return enrollment;
  }

  if (enrollment && enrollment.isRemoved) {
    enrollment.restore();
    enrollment.role = role;
    enrollment.organization = organizationId;
    enrollment.updatedBy = clerkUserId;
    await enrollment.save();
    return enrollment;
  }

  enrollment = new Enrollment({
    classroomId,
    userId: memberId,
    role,
    joinedAt: new Date(),
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await enrollment.save();
  return enrollment;
}

/**
 * Ensures the final state is valid (auth/org/classroom/membership/enrollment) and returns it.
 */
async function ensureJoin({ orgId, classroomId, clerkUserId, member }) {
  const [organization, classroom] = await Promise.all([
    ensureOrganizationByClerkId(orgId),
    Classroom.findById(classroomId),
  ]);

  if (!classroom) {
    const err = new Error("Classroom not found");
    err.statusCode = 404;
    throw err;
  }

  if (!classroom.isActive) {
    const err = new Error("Classroom is not active");
    err.statusCode = 400;
    throw err;
  }

  if (classroom.organization.toString() !== organization._id.toString()) {
    const err = new Error(
      "Invalid join request: classroom does not belong to organization"
    );
    err.statusCode = 400;
    throw err;
  }

  const clerkMembership = await getOrCreateClerkOrgMembership(orgId, clerkUserId);
  await syncMemberOrgMembership(member, organization, clerkMembership);

  // Determine classroom role:
  // - org:admin => classroom admin
  // - classroom owner => classroom admin
  // - otherwise member
  const isOrgAdmin = clerkMembership?.role === "org:admin";
  const isOwner =
    classroom.ownership?.toString?.() &&
    member?._id?.toString?.() &&
    classroom.ownership.toString() === member._id.toString();
  const role = isOrgAdmin || isOwner ? "admin" : "member";
  const enrollment = await ensureEnrollment({
    classroomId: classroom._id,
    memberId: member._id,
    role,
    organizationId: organization._id,
    clerkUserId,
  });

  return { organization, classroom, enrollment };
}

module.exports = {
  ensureJoin,
};


