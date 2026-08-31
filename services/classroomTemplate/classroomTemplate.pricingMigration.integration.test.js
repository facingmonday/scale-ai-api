const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const ClassroomTemplate = require("./classroomTemplate.model");
const ProfileType = require("../profileType/profileType.model");
const Profile = require("../profile/profile.model");
const VariableValue = require("../variableDefinition/variableValue.model");
const MetricDefinition = require("../metricDefinition/metricDefinition.model");

before(async () => {
  await setupTestDb();
});

after(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearCollections();
});

function buildUniformTemplatePrices(variableKey = "avg-selling-price-per-unit") {
  const defaults =
    ClassroomTemplate.getDefaultStoreTypeValuesByStoreTypeKey();
  return Object.fromEntries(
    Object.entries(defaults).map(([profileTypeKey, values]) => {
      const staleValues = { ...values };
      delete staleValues["avg-selling-price-per-unit"];
      delete staleValues["average-selling-price-per-unit"];
      staleValues[variableKey] = 16;
      return [profileTypeKey, staleValues];
    })
  );
}

async function createProfileTypesWithPrices({
  organizationId,
  classroomId,
  priceForType = () => 16,
  variableKey = "average-selling-price-per-unit",
}) {
  const defaults =
    ClassroomTemplate.getDefaultStoreTypeValuesByStoreTypeKey();
  const profileTypes = [];

  for (const profileTypeKey of Object.keys(defaults)) {
    const profileType = await ProfileType.create({
      organization: organizationId,
      classroomId,
      key: profileTypeKey,
      label: profileTypeKey,
      createdBy: "test-admin",
      updatedBy: "test-admin",
    });
    await VariableValue.create({
      organization: organizationId,
      classroomId,
      appliesTo: "profileType",
      ownerId: profileType._id,
      variableKey,
      value: priceForType(profileTypeKey),
      createdBy: "test-admin",
      updatedBy: "test-admin",
    });
    profileTypes.push(profileType);
  }

  return profileTypes;
}

test("repairs uniform legacy classroom and profile selling prices", async () => {
  const organizationId = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  const profileTypes = await createProfileTypesWithPrices({
    organizationId,
    classroomId,
  });
  const fineDining = profileTypes.find(
    (profileType) => profileType.key === "fine_dining"
  );
  const profile = await Profile.create({
    organization: organizationId,
    classroomId,
    userId: new mongoose.Types.ObjectId(),
    studentId: "student-1",
    shopName: "Legacy Fine Dining",
    storeDescription: "Test profile",
    storeLocation: "Test location",
    profileType: fineDining._id,
    createdBy: "test-admin",
    updatedBy: "test-admin",
  });
  await VariableValue.create({
    organization: organizationId,
    classroomId,
    appliesTo: "profile",
    ownerId: profile._id,
    variableKey: "average-selling-price-per-unit",
    value: 16,
    createdBy: "test-admin",
    updatedBy: "test-admin",
  });

  const result =
    await ClassroomTemplate.repairLegacySellingPricesForOrganization(
      organizationId,
      "system-test"
    );

  assert.deepEqual(result, {
    classroomsRepaired: 1,
    profileTypeValuesRepaired: 11,
    profileValuesRepaired: 1,
  });

  const repairedTypePrice = await VariableValue.findOne({
    organization: organizationId,
    appliesTo: "profileType",
    ownerId: fineDining._id,
    variableKey: "average-selling-price-per-unit",
  }).lean();
  const repairedProfilePrice = await VariableValue.findOne({
    organization: organizationId,
    appliesTo: "profile",
    ownerId: profile._id,
    variableKey: "average-selling-price-per-unit",
  }).lean();
  assert.equal(repairedTypePrice.value, 48);
  assert.equal(repairedProfilePrice.value, 48);

  const secondRun =
    await ClassroomTemplate.repairLegacySellingPricesForOrganization(
      organizationId,
      "system-test"
    );
  assert.deepEqual(secondRun, {
    classroomsRepaired: 0,
    profileTypeValuesRepaired: 0,
    profileValuesRepaired: 0,
  });
});

test("preserves a classroom with customized selling prices", async () => {
  const organizationId = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  const profileTypes = await createProfileTypesWithPrices({
    organizationId,
    classroomId,
    priceForType: (profileTypeKey) =>
      profileTypeKey === "fine_dining" ? 55 : 16,
    variableKey: "avg-selling-price-per-unit",
  });

  const result =
    await ClassroomTemplate.repairLegacySellingPricesForOrganization(
      organizationId,
      "system-test"
    );

  assert.deepEqual(result, {
    classroomsRepaired: 0,
    profileTypeValuesRepaired: 0,
    profileValuesRepaired: 0,
  });
  const fineDining = profileTypes.find(
    (profileType) => profileType.key === "fine_dining"
  );
  const fineDiningPrice = await VariableValue.findOne({
    organization: organizationId,
    appliesTo: "profileType",
    ownerId: fineDining._id,
    variableKey: "avg-selling-price-per-unit",
  }).lean();
  assert.equal(fineDiningPrice.value, 55);
});

test("refreshes the developer-managed global template from source defaults", async () => {
  await ClassroomTemplate.create({
    organization: null,
    key: ClassroomTemplate.GLOBAL_DEFAULT_KEY,
    label: "Stale global template",
    version: 1,
    isActive: true,
    payload: {
      profileTypes: [{ key: "fine_dining", label: "Fine Dining" }],
      storeTypeValuesByStoreTypeKey: buildUniformTemplatePrices(),
      prompts: [{ role: "system", content: "Custom existing prompt" }],
      metricDefinitions: [],
    },
    createdBy: "system-test",
    updatedBy: "system-test",
  });

  const template = await ClassroomTemplate.ensureGlobalDefaultTemplate();

  assert.equal(template.version, 4);
  assert.equal(
    template.payload.storeTypeValuesByStoreTypeKey.fine_dining[
      "avg-selling-price-per-unit"
    ],
    48
  );
  assert.equal(
    template.payload.storeTypeValuesByStoreTypeKey.fine_dining[
      "starting-units-refrigerated"
    ],
    60
  );
});

test("backfills canonical supply-chain leaderboard configuration idempotently", async () => {
  const organizationId = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  await MetricDefinition.collection.insertMany(
    ClassroomTemplate.getPizzaShopMetricDefinitions().map((definition) => {
      const {
        leaderboardSortDirection,
        isPrimaryLeaderboardMetric,
        ...legacyDefinition
      } = definition;
      return {
        ...legacyDefinition,
        displayIn: {
          ...legacyDefinition.displayIn,
          leaderboard: definition.key === "netProfit",
        },
        organization: organizationId,
        classroomId,
        isActive: true,
        createdBy: "test-admin",
        updatedBy: "test-admin",
      };
    })
  );

  const result =
    await MetricDefinition.backfillLeaderboardConfigurationForOrganization(
      organizationId,
      "system-test"
    );
  assert.deepEqual(result, { metricsUpdated: 14, primariesAssigned: 1 });

  const definitions = await MetricDefinition.find({
    organization: organizationId,
    classroomId,
  })
    .sort({ sortOrder: 1 })
    .select(
      "key displayIn leaderboardSortDirection isPrimaryLeaderboardMetric"
    )
    .lean();
  assert.deepEqual(
    definitions
      .filter((definition) => definition.displayIn.leaderboard)
      .map(({ key }) => key),
    ["netProfit"]
  );
  assert.equal(
    definitions.find((definition) => definition.key === "costs")
      .leaderboardSortDirection,
    "asc"
  );
  assert.equal(
    definitions.find((definition) => definition.key === "waste")
      .leaderboardSortDirection,
    "asc"
  );
  assert.ok(
    definitions
      .filter((definition) => !["costs", "waste"].includes(definition.key))
      .every(
        (definition) => definition.leaderboardSortDirection === "desc"
      )
  );
  assert.deepEqual(
    definitions
      .filter((definition) => definition.isPrimaryLeaderboardMetric)
      .map(({ key }) => key),
    ["netProfit"]
  );
  assert.deepEqual(
    await MetricDefinition.backfillLeaderboardConfigurationForOrganization(
      organizationId,
      "system-test"
    ),
    { metricsUpdated: 0, primariesAssigned: 0 }
  );
});

test("preserves administrator-authored leaderboard configuration", async () => {
  const organizationId = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  await MetricDefinition.create([
    {
      key: "quality",
      label: "Quality",
      dataType: "number",
      format: "percent",
      aggregation: "avg",
      displayIn: { leaderboard: true },
      leaderboardSortDirection: "asc",
      isPrimaryLeaderboardMetric: true,
      sortOrder: 20,
      organization: organizationId,
      classroomId,
      createdBy: "test-admin",
      updatedBy: "test-admin",
    },
    {
      key: "throughput",
      label: "Throughput",
      dataType: "number",
      aggregation: "max",
      displayIn: { leaderboard: true },
      leaderboardSortDirection: "desc",
      isPrimaryLeaderboardMetric: false,
      sortOrder: 10,
      organization: organizationId,
      classroomId,
      createdBy: "test-admin",
      updatedBy: "test-admin",
    },
  ]);

  assert.deepEqual(
    await MetricDefinition.backfillLeaderboardConfigurationForOrganization(
      organizationId,
      "system-test"
    ),
    { metricsUpdated: 0, primariesAssigned: 0 }
  );
  const definitions = await MetricDefinition.find({
    organization: organizationId,
    classroomId,
  })
    .sort({ sortOrder: 1 })
    .lean();
  assert.deepEqual(
    definitions.map((definition) => [
      definition.key,
      definition.aggregation,
      definition.leaderboardSortDirection,
      definition.isPrimaryLeaderboardMetric,
    ]),
    [
      ["throughput", "max", "desc", false],
      ["quality", "avg", "asc", true],
    ]
  );
});

test("promotes the next enabled metric when the primary is disabled", async () => {
  const organizationId = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  await MetricDefinition.create([
    {
      key: "first",
      label: "First",
      dataType: "number",
      displayIn: { leaderboard: true },
      sortOrder: 10,
      organization: organizationId,
      classroomId,
      createdBy: "test-admin",
      updatedBy: "test-admin",
    },
    {
      key: "second",
      label: "Second",
      dataType: "number",
      displayIn: { leaderboard: true },
      sortOrder: 20,
      organization: organizationId,
      classroomId,
      createdBy: "test-admin",
      updatedBy: "test-admin",
    },
  ]);

  await MetricDefinition.ensurePrimaryLeaderboardMetric(
    classroomId,
    organizationId,
    "second",
    "test-admin"
  );
  await MetricDefinition.updateOne(
    { organization: organizationId, classroomId, key: "second" },
    { $set: { isActive: false } }
  );
  await MetricDefinition.ensurePrimaryLeaderboardMetric(
    classroomId,
    organizationId,
    undefined,
    "test-admin"
  );

  const primaries = await MetricDefinition.find({
    organization: organizationId,
    classroomId,
    isPrimaryLeaderboardMetric: true,
  })
    .select("key")
    .lean();
  assert.deepEqual(primaries.map(({ key }) => key), ["first"]);
});

test("repairs a stale organization template without replacing unrelated values", async () => {
  const globalTemplate = await ClassroomTemplate.ensureGlobalDefaultTemplate();
  const organizationId = new mongoose.Types.ObjectId();
  const staleValues = buildUniformTemplatePrices(
    "average-selling-price-per-unit"
  );
  staleValues.fine_dining["professor-custom-variable"] = 123;
  await ClassroomTemplate.create({
    organization: organizationId,
    key: ClassroomTemplate.GLOBAL_DEFAULT_KEY,
    label: "Organization template",
    version: 1,
    isActive: true,
    sourceTemplateId: globalTemplate._id,
    payload: {
      profileTypes: globalTemplate.payload.profileTypes,
      variableDefinitionsByAppliesTo:
        globalTemplate.payload.variableDefinitionsByAppliesTo,
      storeTypeValuesByStoreTypeKey: staleValues,
      prompts: globalTemplate.payload.prompts,
      metricDefinitions: globalTemplate.payload.metricDefinitions,
    },
    createdBy: "test-admin",
    updatedBy: "test-admin",
  });

  await ClassroomTemplate.copyGlobalToOrganization(
    organizationId,
    "system-test"
  );

  const repaired = await ClassroomTemplate.findOne({
    organization: organizationId,
    key: ClassroomTemplate.GLOBAL_DEFAULT_KEY,
  }).lean();
  assert.equal(
    repaired.payload.storeTypeValuesByStoreTypeKey.fine_dining[
      "average-selling-price-per-unit"
    ],
    48
  );
  assert.equal(
    repaired.payload.storeTypeValuesByStoreTypeKey.fine_dining[
      "professor-custom-variable"
    ],
    123
  );
});
