const test = require("node:test");
const assert = require("node:assert/strict");
const ClassroomSeatAllocation = require("./classroomSeatAllocation.model");

test("findActiveForClassroom is a static function", () => {
  assert.equal(typeof ClassroomSeatAllocation.findActiveForClassroom, "function");
});

test("classroom seat allocation schema has required fields", () => {
  const schema = ClassroomSeatAllocation.schema.obj;
  assert.ok(schema.classroomId);
  assert.ok(schema.seatPoolId);
  assert.ok(schema.seatsAllocated);
  assert.equal(schema.mode.enum.includes("open"), true);
  assert.equal(schema.status.enum.includes("active"), true);
});
