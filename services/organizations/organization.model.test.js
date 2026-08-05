const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
} = require("../../test/helpers/db");
const { createOrganization } = require("../../test/helpers/factories");

const Organization = require("./organization.model");

test("organization model", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await t.test("findByClerkId returns organization", async () => {
    await clearCollections();
    const org = await createOrganization({ clerkOrganizationId: "org_lookup_test" });
    const found = await Organization.findByClerkId("org_lookup_test");
    assert.equal(String(found._id), String(org._id));
  });
});
