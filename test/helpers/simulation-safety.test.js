const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertSafeSimulationEnvironment,
  assertSimulationRoster,
  isLocalWebOrigin,
  isSyntheticSimulationUser,
  parseStudentCount,
} = require("../../apps/admin/simulation-safety");

test("student count is capped on the server", () => {
  assert.equal(parseStudentCount("1"), 1);
  assert.equal(parseStudentCount("100"), 100);
  assert.throws(() => parseStudentCount("101"), /between 1 and 100/);
  assert.throws(() => parseStudentCount("2.5"), /between 1 and 100/);
  assert.throws(() => parseStudentCount("not-a-number"), /between 1 and 100/);
});

test("simulation runner refuses production and remote databases by default", () => {
  assert.throws(
    () =>
      assertSafeSimulationEnvironment({
        NODE_ENV: "production",
        MONGO_URL: "mongodb://localhost/test",
      }),
    /disabled/,
  );
  assert.throws(
    () =>
      assertSafeSimulationEnvironment({
        NODE_ENV: "development",
        MONGO_URL: "mongodb://database.example/test",
      }),
    /refuses remote MongoDB/,
  );
  assert.doesNotThrow(() =>
    assertSafeSimulationEnvironment({
      NODE_ENV: "development",
      MONGO_URL: "mongodb://localhost/test",
    }),
  );
});

test("remote test databases require an explicit opt-in", () => {
  assert.doesNotThrow(() =>
    assertSafeSimulationEnvironment({
      NODE_ENV: "development",
      MONGO_URL: "mongodb://database.example/test",
      SIMULATION_RUNNER_ALLOW_REMOTE_DATABASE: "true",
    }),
  );
});

test("only local browser origins are accepted", () => {
  assert.equal(isLocalWebOrigin(undefined), true);
  assert.equal(isLocalWebOrigin("http://localhost:5174"), true);
  assert.equal(isLocalWebOrigin("http://127.0.0.1:5174"), true);
  assert.equal(isLocalWebOrigin("https://malicious.example"), false);
});

test("simulation identities require an explicit marker or legacy sim prefix", () => {
  assert.equal(isSyntheticSimulationUser({ isSimulationUser: true }), true);
  assert.equal(isSyntheticSimulationUser({ clerkUserId: "sim_demo_s001" }), true);
  assert.equal(isSyntheticSimulationUser({ clerkUserId: "user_real" }), false);
});

test("an existing classroom roster is rejected if it contains a real user", () => {
  assert.throws(
    () =>
      assertSimulationRoster(
        [
          { clerkUserId: "sim_demo_s001", isSimulationUser: true },
          { clerkUserId: "user_real" },
        ],
        2,
      ),
    /contains non-simulation students/,
  );
  assert.throws(
    () =>
      assertSimulationRoster(
        [{ clerkUserId: "sim_demo_s001", isSimulationUser: true }],
        2,
      ),
    /1 students, but 2 were requested/,
  );
});
