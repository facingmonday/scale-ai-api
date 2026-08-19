const test = require("node:test");
const assert = require("node:assert/strict");

test("new store student ID defaults", async (t) => {
  const { getInitialStoreStudentId } = await import(
    "../../apps/web/src/utils/storeProfileDefaults.ts"
  );

  await t.test("uses the enrollment student ID for a new store", () => {
    assert.equal(getInitialStoreStudentId(null, "S-100"), "S-100");
  });

  await t.test("is blank for an unmatched enrollment", () => {
    assert.equal(getInitialStoreStudentId(null, undefined), "");
  });

  await t.test("preserves an existing store value", () => {
    assert.equal(
      getInitialStoreStudentId({ studentId: "EDITED-ID" }, "ROSTER-ID"),
      "EDITED-ID",
    );
    assert.equal(getInitialStoreStudentId({ studentId: "" }, "ROSTER-ID"), "");
  });
});

test("API response unwrapping preserves an explicit null data value", async () => {
  const { unwrap } = await import(
    "../../apps/web/src/components/dashboard/utils.ts"
  );
  const { getInitialStoreStudentId } = await import(
    "../../apps/web/src/utils/storeProfileDefaults.ts"
  );

  const response = { data: null, memberStudentId: "S-100" };
  const profile = unwrap(response);

  assert.equal(profile, null);
  assert.equal(
    getInitialStoreStudentId(profile, response.memberStudentId),
    "S-100",
  );
});
