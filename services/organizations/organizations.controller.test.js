const test = require("node:test");
const assert = require("node:assert/strict");
const controller = require("./organizations.controller");

test("organizations controller exports handlers", () => {
  assert.equal(typeof controller.getAllOrganizations, "function");
});
