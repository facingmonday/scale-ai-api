const test = require("node:test");
const assert = require("node:assert/strict");
const Profile = require("./profile.model");

test("profile model schema exists", () => {
  assert.ok(Profile.schema);
});
