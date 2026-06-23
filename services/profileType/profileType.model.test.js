const test = require("node:test");
const assert = require("node:assert/strict");

test("profileType model schema exists", () => {
  assert.ok(require("./profileType.model").schema);
});
