const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./auth.controller");
const Classroom = require("../classroom/classroom.model");
const SeatPool = require("../licensing/seatPool.model");

test("auth controller exports handlers", () => {
  assert.equal(typeof controller.me, "function");
  assert.equal(typeof controller.setActiveClassroom, "function");
});

test("me exposes the active enrollment student ID", async () => {
  const originalVariableDefinitions =
    Classroom.getAllVariableDefinitionsForClassroom;
  const originalMetricDefinitions = Classroom.getAllMetricDefinitionsForClassroom;
  const originalBillingSummary = SeatPool.getBillingSummary;
  Classroom.getAllVariableDefinitionsForClassroom = async () => ({});
  Classroom.getAllMetricDefinitionsForClassroom = async () => [];
  SeatPool.getBillingSummary = async () => ({});

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

  try {
    await controller.me(
      {
        organization: { _id: "org_1" },
        activeClassroom: {
          _id: "classroom_1",
          toObject: () => ({ _id: "classroom_1", name: "Classroom" }),
        },
        classroomRole: "member",
        enrollment: { studentId: "S-100" },
        user: {
          _id: "member_1",
          getOrganizationMembership: () => ({ role: "org:member" }),
        },
      },
      res,
      (error) => {
        throw error;
      },
    );

    assert.equal(res.body.activeClassroom.studentId, "S-100");
  } finally {
    Classroom.getAllVariableDefinitionsForClassroom =
      originalVariableDefinitions;
    Classroom.getAllMetricDefinitionsForClassroom = originalMetricDefinitions;
    SeatPool.getBillingSummary = originalBillingSummary;
  }
});
