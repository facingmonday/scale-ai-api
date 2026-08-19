const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./profile.controller");
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

test("profile load returns the enrollment student ID before profile creation", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });
  await clearCollections();

  const org = await createOrganization();
  const classroom = await createClassroom(org._id);
  const member = await createMember();
  await createEnrollment({
    classroomId: classroom._id,
    userId: member._id,
    organizationId: org._id,
    overrides: { studentId: "S-FORM" },
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

  await controller.getStore(
    {
      query: { classroomId: classroom._id.toString() },
      user: member,
      organization: org,
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data, null);
  assert.equal(res.body.memberStudentId, "S-FORM");
});
