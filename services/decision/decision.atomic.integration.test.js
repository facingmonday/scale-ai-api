const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb, teardownTestDb, clearCollections, mongoose,
} = require("../../test/helpers/db");
const Decision = require("./decision.model");
const Challenge = require("../challenge/challenge.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");

const id = () => new mongoose.Types.ObjectId();

async function fixture() {
  const classroomId = id(), organizationId = id(), userId = id();
  const challenge = await Challenge.createScenario(
    classroomId, { title: "Atomic answers", automationMode: "MANUAL" },
    organizationId, "teacher",
  );
  await Challenge.updateOne({ _id: challenge._id }, { isPublished: true });
  const definition = {
    classroomId, organization: organizationId, dataType: "number",
    inputType: "slider", min: 0, max: 100, required: true, isActive: true,
    createdBy: "teacher", updatedBy: "teacher", defaultValue: 10,
  };
  await VariableDefinition.create([
    ...["inventory", "staff"].map((key) => ({
      ...definition, key, label: key, appliesTo: "decision", challengeId: null,
    })),
    { ...definition, key: "shipping", label: "Shipping", appliesTo: "challenge", challengeId: challenge._id },
  ]);
  const decision = await Decision.createSubmission(
    classroomId, challenge._id, userId, { inventory: 50, staff: 20 },
    organizationId, "original-actor", { challengeVariableAnswers: { shipping: 30 } },
  );
  await Decision.updateOne({ _id: decision._id }, {
    generation: {
      method: "FORWARDED_PREVIOUS", forwardedFromScenarioId: id(),
      forwardedFromSubmissionId: id(), meta: { absentPunishmentLevel: "high" },
    },
  });
  const scope = { organization: organizationId, classroomId, appliesTo: "decision", ownerId: decision._id };
  // Raw reads intentionally bypass the defaults/population plugin: compare every
  // stored row (including its ID/audit fields), not a possibly defaulted response.
  const snapshot = async () => ({
    decision: await Decision.collection.findOne({ _id: decision._id }),
    values: await VariableValue.collection.find(scope).sort({ variableKey: 1 }).toArray(),
  });
  const submit = (variables = { inventory: 72, staff: 42 }, options = { challengeVariableAnswers: { shipping: 65 } }, actor = "student-actor") =>
    Decision.updateSubmission(classroomId, challenge._id, userId, variables, organizationId, actor, options);
  return { decision, scope, snapshot, submit };
}

test.describe("atomic answer replacement on a replica set", () => {
  test.before(async () => {
    await setupTestDb({ replicaSet: true });
    await Promise.all([Decision.init(), VariableValue.init(), VariableDefinition.init()]);
  });
  test.after(teardownTestDb);
  test.beforeEach(clearCollections);

  test("commits all values and metadata, removes obsolete rows, and permits repeat updates", async () => {
    const f = await fixture();
    const before = await f.snapshot();
    await VariableValue.create({ ...f.scope, variableKey: "obsolete", value: 9, createdBy: "teacher", updatedBy: "teacher" });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await f.submit();
      const stored = await f.snapshot();
      assert.deepEqual(result.variables, { inventory: 72, staff: 42 });
      assert.deepEqual(stored.values.map((v) => [v.variableKey, v.value]), [["inventory", 72], ["staff", 42]]);
      assert.deepEqual(stored.decision.challengeVariableAnswers, { shipping: 65 });
      assert.deepEqual(stored.decision.generation, {
        method: "MANUAL", forwardedFromScenarioId: null, forwardedFromSubmissionId: null, meta: null,
      });
      assert.equal(stored.decision.updatedBy, "student-actor");
      assert.equal(stored.decision.createdBy, before.decision.createdBy);
      assert.deepEqual(stored.decision.submittedAt, before.decision.submittedAt);
    }
  });

  test("empty replacements commit metadata and remove values without an insert", async () => {
    const f = await fixture();
    await VariableDefinition.updateMany({ classroomId: f.scope.classroomId, appliesTo: "decision" }, { isActive: false });
    const result = await f.submit({});
    assert.deepEqual(result.variables, {});
    const stored = await f.snapshot();
    assert.deepEqual(stored.values, []);
    assert.equal(stored.decision.generation.method, "MANUAL");
    assert.deepEqual(stored.decision.challengeVariableAnswers, { shipping: 65 });
  });

  test("deletion failure leaves original rows and metadata unchanged", async (t) => {
    const f = await fixture();
    const before = await f.snapshot();
    t.mock.method(VariableValue.collection, "deleteMany", async () => {
      throw new Error("Injected deletion failure");
    });
    await assert.rejects(f.submit(), /Injected deletion failure/);
    assert.deepEqual(await f.snapshot(), before);
  });

  test("database rejection of all inserts preserves answers instead of exposing defaults", async () => {
    const f = await fixture();
    const before = await f.snapshot();
    await mongoose.connection.db.command({
      collMod: VariableValue.collection.name,
      validator: { updatedBy: { $ne: "student-actor" } },
      validationLevel: "strict", validationAction: "error",
    });
    try {
      await assert.rejects(f.submit(), { code: 121 });
      assert.deepEqual(await f.snapshot(), before);
      const read = await Decision.findById(f.decision._id);
      await Decision.populateVariablesForMany([read]);
      assert.deepEqual(read.toObject().variables, { inventory: 50, staff: 20 });
    } finally {
      await mongoose.connection.db.command({ collMod: VariableValue.collection.name, validator: {} });
    }
  });

  test("partial database insert failure restores every original row and all metadata", async (t) => {
    const f = await fixture();
    const before = await f.snapshot();
    const insertMany = VariableValue.collection.insertMany.bind(VariableValue.collection);
    t.mock.method(VariableValue.collection, "insertMany", async (docs, options) => {
      // Real ordered MongoDB insert: valid rows precede a duplicate unique key.
      return insertMany([...docs, { ...docs[0], _id: id() }], options);
    });
    await assert.rejects(f.submit(), { code: 11000 });
    assert.deepEqual(await f.snapshot(), before);
    const read = await Decision.findById(f.decision._id);
    await Decision.populateVariablesForMany([read]);
    assert.deepEqual(read.toObject().variables, { inventory: 50, staff: 20 });
  });

  test("database rejection of metadata save rolls back replacement values", async () => {
    const f = await fixture();
    const before = await f.snapshot();
    // Reject the actual update at MongoDB, after delete/insert have succeeded.
    await mongoose.connection.db.command({
      collMod: Decision.collection.name,
      validator: { updatedBy: { $ne: "student-actor" } },
      validationLevel: "strict", validationAction: "error",
    });
    try {
      await assert.rejects(f.submit(), { code: 121 });
      assert.deepEqual(await f.snapshot(), before);
    } finally {
      await mongoose.connection.db.command({ collMod: Decision.collection.name, validator: {} });
    }
  });

  test("failure after metadata save rolls back both collections", async (t) => {
    const f = await fixture();
    const before = await f.snapshot();
    const save = Decision.prototype.save;
    t.mock.method(Decision.prototype, "save", async function (options) {
      await save.call(this, options);
      throw new Error("Interrupted before commit");
    });
    await assert.rejects(f.submit(), /Interrupted before commit/);
    assert.deepEqual(await f.snapshot(), before);
  });

  test("outside readers see original answers while replacements are uncommitted", async (t) => {
    const f = await fixture();
    const before = await f.snapshot();
    const insertMany = VariableValue.insertMany.bind(VariableValue);
    t.mock.method(VariableValue, "insertMany", async (docs, options) => {
      assert.deepEqual(await f.snapshot(), before); // deletion is invisible
      const inserted = await insertMany(docs, options);
      assert.deepEqual(await f.snapshot(), before); // insertion is invisible
      return inserted;
    });
    await f.submit();
    assert.notDeepEqual(await f.snapshot(), before);
  });

  test("transient failure retries the complete transaction without duplicate rows", async (t) => {
    const f = await fixture();
    const save = Decision.prototype.save;
    let attempts = 0;
    t.mock.method(Decision.prototype, "save", async function (options) {
      const result = await save.call(this, options);
      if (++attempts === 1) {
        const error = new mongoose.mongo.MongoServerError({ message: "Injected transient failure", code: 112 });
        error.addErrorLabel("TransientTransactionError");
        throw error;
      }
      return result;
    });
    await f.submit();
    assert.equal(attempts, 2);
    const stored = await f.snapshot();
    assert.deepEqual(stored.values.map((v) => v.value), [72, 42]);
    assert.equal(stored.decision.generation.method, "MANUAL");
  });

  test("concurrent update retries against current answers instead of restoring stale metadata", { timeout: 20000 }, async (t) => {
    const f = await fixture();
    const deleteMany = VariableValue.deleteMany.bind(VariableValue);
    let releaseSecond;
    const firstCommitted = new Promise((resolve) => { releaseSecond = resolve; });
    let secondRead;
    const secondReachedDelete = new Promise((resolve) => { secondRead = resolve; });
    let firstRead;
    const firstReachedDelete = new Promise((resolve) => { firstRead = resolve; });
    let deletes = 0;
    t.mock.method(VariableValue, "deleteMany", async (...args) => {
      const attempt = ++deletes;
      if (attempt === 1) {
        firstRead();
        await secondReachedDelete;
      }
      if (attempt === 2) {
        secondRead();
        await firstCommitted;
      }
      return deleteMany(...args);
    });
    const first = f.submit({ inventory: 61, staff: 31 }, { challengeVariableAnswers: { shipping: 71 } }, "first-student");
    await firstReachedDelete;
    const second = f.submit({ inventory: 82, staff: 52 }, {}, "second-student");
    try {
      await first;
    } finally {
      releaseSecond();
    }
    await second;
    assert.ok(deletes >= 3, "MongoDB must retry the conflicting transaction");
    const stored = await f.snapshot();
    assert.deepEqual(stored.values.map((v) => v.value), [82, 52]);
    assert.deepEqual(stored.decision.challengeVariableAnswers, { shipping: 71 });
    assert.equal(stored.decision.updatedBy, "second-student");
  });
});

test.describe("standalone MongoDB", () => {
  test.before(() => setupTestDb());
  test.after(teardownTestDb);

  test("unsupported transactions fail without altering any answers or metadata", async () => {
    const f = await fixture();
    const before = await f.snapshot();
    await assert.rejects(f.submit(), { code: 20 });
    assert.deepEqual(await f.snapshot(), before);
  });
});
