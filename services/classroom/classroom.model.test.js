const test = require("node:test");
const assert = require("node:assert/strict");

const Classroom = require("./classroom.model");

test("classroom model exports access statics", () => {
  assert.equal(typeof Classroom.validateAdminAccess, "function");
  assert.equal(typeof Classroom.validateStudentAccess, "function");
  assert.equal(typeof Classroom.canCreateClassroom, "function");
  assert.equal(typeof Classroom.getClassroomSeatSummary, "function");
});
