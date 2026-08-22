const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
} = require("../../test/helpers/db");
const controller = require("./enrollment.controller");
const Classroom = require("../classroom/classroom.model");
const Enrollment = require("./enrollment.model");
const Profile = require("../profile/profile.model");
const {
  createOrganization,
  createClassroom,
  createMember,
  createEnrollment,
} = require("../../test/helpers/factories");

function mockRes() {
  return {
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
}

test("enrollment controller exports handlers", () => {
  assert.equal(typeof controller.joinClass, "function");
  assert.equal(typeof controller.getClassRoster, "function");
  assert.equal(typeof controller.leaveClass, "function");
  assert.equal(typeof controller.transferStudent, "function");
  assert.equal(typeof controller.removeStudent, "function");
  assert.equal(typeof controller.updateStudentEnrollment, "function");
  assert.equal(typeof controller.exportRoster, "function");
});

test("joinClass returns 404 when class not found", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  const mongoose = require("mongoose");
  const res = mockRes();

  await controller.joinClass(
    {
      params: { classroomId: new mongoose.Types.ObjectId().toString() },
      body: {},
      clerkUser: { id: "user_missing" },
    },
    res
  );

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "Class not found");
});

test("updateStudentEnrollment synchronizes the scoped enrollment and profile", async (t) => {
  await setupTestDb();
  const originalValidateAdminAccess = Classroom.validateAdminAccess;
  Classroom.validateAdminAccess = async () => true;
  t.after(async () => {
    Classroom.validateAdminAccess = originalValidateAdminAccess;
    await teardownTestDb();
  });
  await clearCollections();

  const org = await createOrganization();
  const otherOrg = await createOrganization();
  const classroom = await createClassroom(org._id);
  const member = await createMember();
  const enrollment = await createEnrollment({
    classroomId: classroom._id,
    userId: member._id,
    organizationId: org._id,
  });
  const profile = await Profile.create({
    classroomId: classroom._id,
    userId: member._id,
    studentId: "S-OLD",
    shopName: "Existing profile",
    storeDescription: "Existing profile description",
    storeLocation: "Existing profile location",
    profileType: new mongoose.Types.ObjectId(),
    organization: org._id,
    createdBy: member.clerkUserId,
    updatedBy: member.clerkUserId,
  });
  const res = mockRes();

  await controller.updateStudentEnrollment(
    {
      params: {
        classroomId: classroom._id.toString(),
        userId: member._id.toString(),
      },
      body: { studentId: "  S-EDITED  " },
      organization: org,
      clerkUser: { id: "teacher_edit" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.studentId, "S-EDITED");
  assert.equal(res.body.data.profileUpdated, true);
  assert.equal(res.body.data.profileStudentId, "S-EDITED");

  const updated = await Enrollment.findById(enrollment._id);
  assert.equal(updated.studentId, "S-EDITED");
  assert.equal(updated.updatedBy, "teacher_edit");
  const updatedProfile = await Profile.findById(profile._id).lean();
  assert.equal(updatedProfile.studentId, "S-EDITED");
  assert.equal(updatedProfile.updatedBy, "teacher_edit");

  const blankRes = mockRes();
  await controller.updateStudentEnrollment(
    {
      params: {
        classroomId: classroom._id.toString(),
        userId: member._id.toString(),
      },
      body: { studentId: "" },
      organization: org,
      clerkUser: { id: "teacher_edit" },
    },
    blankRes,
  );
  assert.equal(blankRes.statusCode, 400);

  const crossOrgRes = mockRes();
  await controller.updateStudentEnrollment(
    {
      params: {
        classroomId: classroom._id.toString(),
        userId: member._id.toString(),
      },
      body: { studentId: "WRONG-ORG" },
      organization: otherOrg,
      clerkUser: { id: "teacher_other" },
    },
    crossOrgRes,
  );

  assert.equal(crossOrgRes.statusCode, 404);
  const unchanged = await Enrollment.findById(enrollment._id);
  assert.equal(unchanged.studentId, "S-EDITED");
  const unchangedProfile = await Profile.findById(profile._id).lean();
  assert.equal(unchangedProfile.studentId, "S-EDITED");
});
