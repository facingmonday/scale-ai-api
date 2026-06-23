const { uniqueSuffix } = require("./db");
const mongoose = require("mongoose");

const Organization = require("../../services/organizations/organization.model");
const Classroom = require("../../services/classroom/classroom.model");
const Member = require("../../services/members/member.model");
const Enrollment = require("../../services/enrollment/enrollment.model");
const SeatPool = require("../../services/licensing/seatPool.model");
const SeatClaim = require("../../services/licensing/seatClaim.model");
const { PLAN_KEYS } = require("../../services/licensing/planCatalog");

async function createOrganization(overrides = {}) {
  const suffix = uniqueSuffix();
  const clerkUserId = overrides.createdBy || `test_${suffix}`;
  return Organization.create({
    clerkOrganizationId: `org_${suffix}`,
    name: `Test Org ${suffix}`,
    slug: `test-org-${suffix}`,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
    ...overrides,
  });
}

async function createClassroom(organizationId, overrides = {}) {
  const suffix = uniqueSuffix();
  const clerkUserId = overrides.createdBy || `test_${suffix}`;
  return Classroom.create({
    name: `Test Classroom ${suffix}`,
    organization: organizationId,
    ownership: new mongoose.Types.ObjectId(),
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
    ...overrides,
  });
}

async function createMember(overrides = {}) {
  const suffix = uniqueSuffix();
  const clerkUserId = overrides.clerkUserId || `member_${suffix}`;
  return Member.create({
    clerkUserId,
    email: overrides.email || `member-${suffix}@example.com`,
    firstName: overrides.firstName || "Test",
    lastName: overrides.lastName || "Member",
    organizationMemberships: overrides.organizationMemberships || [],
    createdAt: new Date(),
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
    ...overrides,
  });
}

async function createEnrollment({ classroomId, userId, organizationId, overrides = {} }) {
  const clerkUserId = overrides.createdBy || `test_${uniqueSuffix()}`;
  return Enrollment.create({
    classroomId,
    userId,
    role: "member",
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
    ...overrides,
  });
}

async function createSeatPool(organizationId, overrides = {}) {
  const clerkUserId = overrides.createdBy || `test_${uniqueSuffix()}`;
  return SeatPool.create({
    planKey: PLAN_KEYS.ORG_SEATS,
    scope: "organization",
    purchaserOrganizationId: organizationId,
    totalSeats: 10,
    usedSeats: 0,
    status: "active",
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
    ...overrides,
  });
}

async function createSeatClaim({
  classroomId,
  userId,
  organizationId,
  overrides = {},
}) {
  const clerkUserId = overrides.createdBy || `test_${uniqueSuffix()}`;
  return SeatClaim.create({
    classroomId,
    userId,
    source: "org_prepaid",
    status: "active",
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
    ...overrides,
  });
}

module.exports = {
  createOrganization,
  createClassroom,
  createMember,
  createEnrollment,
  createSeatPool,
  createSeatClaim,
};
