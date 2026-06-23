const test = require("node:test");
const assert = require("node:assert/strict");
require("../../models");
const mongoose = require("mongoose");

test("classroomReport model schema exists", () => {
  const ClassroomReport = mongoose.model("ClassroomReport");
  assert.ok(ClassroomReport.schema.obj.classroomId);
});
