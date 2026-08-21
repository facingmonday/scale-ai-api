const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const controller = require("./members.controller");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
} = require("../../test/helpers/db");
const {
  createOrganization,
  createClassroom,
  createMember,
  createEnrollment,
} = require("../../test/helpers/factories");
const Member = require("./member.model");
const Profile = require("../profile/profile.model");

test("members controller exports handlers", () => {
  assert.equal(typeof controller.getAllMembers, "function");
  assert.equal(typeof controller.getMemberById, "function");
});

test("member detail includes the active classroom enrollment student ID", async (t) => {
  await setupTestDb();
  const originalGetProfileFromClerk = Member.prototype.getProfileFromClerk;
  Member.prototype.getProfileFromClerk = async function () {
    return {
      id: this.clerkUserId,
      firstName: "Myles",
      lastName: "Williams",
      fullName: "Myles Williams",
      username: "myles",
      imageUrl: "https://images.example.com/myles.png",
      hasImage: true,
      email: "myles@example.com",
      emailAddresses: [
        {
          id: "email_detail",
          emailAddress: "myles@example.com",
          verification: { status: "verified", strategy: "email_code" },
        },
      ],
      phone: "",
      phoneNumbers: [],
      createdAt: 1,
      updatedAt: 2,
      lastSignInAt: 3,
      lastActiveAt: 4,
    };
  };
  t.after(async () => {
    Member.prototype.getProfileFromClerk = originalGetProfileFromClerk;
    await teardownTestDb();
  });
  await clearCollections();

  const org = await createOrganization();
  const classroom = await createClassroom(org._id);
  const member = await createMember({
    organizationMemberships: [
      {
        id: "orgmem_member_detail",
        organizationId: org._id,
        role: "org:member",
        organization: { id: org.clerkOrganizationId, name: org.name },
        createdAt: new Date(),
      },
    ],
  });
  await createEnrollment({
    classroomId: classroom._id,
    userId: member._id,
    organizationId: org._id,
    overrides: { studentId: "S-DETAIL" },
  });

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  await controller.getMemberById(
    {
      organization: org,
      activeClassroom: classroom,
      params: { id: member._id.toString() },
      query: {},
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.studentId, "S-DETAIL");
  assert.equal(res.body.enrollment.studentId, "S-DETAIL");
  assert.equal(
    res.body.enrollment.classroomId.toString(),
    classroom._id.toString(),
  );
  assert.equal(res.body.enrollment.role, "member");
  assert.equal(res.body.fullName, "Myles Williams");
  assert.equal(res.body.email, "myles@example.com");
  assert.equal(res.body.clerkProfile.emailAddresses.length, 1);
});

test("member detail falls back to the same-classroom profile student ID", async (t) => {
  await setupTestDb();
  const originalGetProfileFromClerk = Member.prototype.getProfileFromClerk;
  Member.prototype.getProfileFromClerk = async function () {
    return {
      id: this.clerkUserId,
      firstName: "Jason",
      lastName: "Price",
      fullName: "Jason Price",
      username: "",
      imageUrl: "",
      hasImage: false,
      email: "jason@example.com",
      emailAddresses: [],
      phone: "",
      phoneNumbers: [],
      createdAt: null,
      updatedAt: null,
      lastSignInAt: null,
      lastActiveAt: null,
    };
  };
  t.after(async () => {
    Member.prototype.getProfileFromClerk = originalGetProfileFromClerk;
    await teardownTestDb();
  });
  await clearCollections();

  const org = await createOrganization();
  const classroom = await createClassroom(org._id);
  const member = await createMember({
    organizationMemberships: [
      {
        id: "orgmem_profile_fallback",
        organizationId: org._id,
        role: "org:member",
        organization: { id: org.clerkOrganizationId, name: org.name },
        createdAt: new Date(),
      },
    ],
  });
  await createEnrollment({
    classroomId: classroom._id,
    userId: member._id,
    organizationId: org._id,
  });
  await Profile.create({
    classroomId: classroom._id,
    userId: member._id,
    studentId: "PROFILE-123",
    shopName: "Profile fallback",
    storeDescription: "Profile fallback description",
    storeLocation: "Profile fallback location",
    profileType: new mongoose.Types.ObjectId(),
    organization: org._id,
    createdBy: member.clerkUserId,
    updatedBy: member.clerkUserId,
  });

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  await controller.getMemberById(
    {
      organization: org,
      params: { id: member._id.toString() },
      query: { classroomId: classroom._id.toString() },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.studentId, "PROFILE-123");
  assert.equal(res.body.profileStudentId, "PROFILE-123");
  assert.equal(res.body.enrollment.studentId, "");
});
