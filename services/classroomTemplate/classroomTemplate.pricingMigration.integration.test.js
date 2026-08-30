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

  assert.equal(template.version, 3);
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

test("repairs canonical supply-chain leaderboard flags idempotently", async () => {
  const organizationId = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  await MetricDefinition.create(
    ClassroomTemplate.getPizzaShopMetricDefinitions().map((definition) => ({
      ...definition,
      displayIn: {
        ...definition.displayIn,
        leaderboard: definition.key === "netProfit",
      },
      organization: organizationId,
      classroomId,
      createdBy: "test-admin",
      updatedBy: "test-admin",
    }))
  );

  const result =
    await MetricDefinition.repairSupplyChainLeaderboardFlagsForOrganization(
      organizationId,
      "system-test"
    );
  assert.deepEqual(result, { classroomsRepaired: 1, metricsUpdated: 5 });

  const enabled = await MetricDefinition.find({
    organization: organizationId,
    classroomId,
    "displayIn.leaderboard": true,
  })
    .sort({ sortOrder: 1 })
    .select("key")
    .lean();
  assert.deepEqual(
    enabled.map(({ key }) => key),
    ["sales", "revenue", "costs", "waste", "netProfit", "cashAfter"]
  );
  assert.deepEqual(
    await MetricDefinition.repairSupplyChainLeaderboardFlagsForOrganization(
      organizationId,
      "system-test"
    ),
    { classroomsRepaired: 0, metricsUpdated: 0 }
  );
});

test("does not migrate a customized metric set", async () => {
  const organizationId = new mongoose.Types.ObjectId();
  const classroomId = new mongoose.Types.ObjectId();
  const customized = ClassroomTemplate.getPizzaShopMetricDefinitions()
    .filter(({ key }) => key !== "cashBefore")
    .map((definition) => ({
      ...definition,
      displayIn: { ...definition.displayIn, leaderboard: false },
      organization: organizationId,
      classroomId,
      createdBy: "test-admin",
      updatedBy: "test-admin",
    }));
  await MetricDefinition.create(customized);

  assert.deepEqual(
    await MetricDefinition.repairSupplyChainLeaderboardFlagsForOrganization(
      organizationId,
      "system-test"
    ),
    { classroomsRepaired: 0, metricsUpdated: 0 }
  );
  assert.equal(
    await MetricDefinition.countDocuments({
      organization: organizationId,
      classroomId,
      "displayIn.leaderboard": true,
    }),
    0
  );
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
