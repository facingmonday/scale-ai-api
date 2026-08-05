const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupTestDb,
  teardownTestDb,
  clearCollections,
  mongoose,
} = require("../../test/helpers/db");

const Classroom = require("./classroom.model");
const ClassroomTemplate = require("../classroomTemplate/classroomTemplate.model");
const MetricDefinition = require("../metricDefinition/metricDefinition.model");

test("classroom template and metric definitions lifecycle integration", async (t) => {
  await setupTestDb();
  t.after(async () => {
    await teardownTestDb();
  });

  await clearCollections();
  const organizationId = new mongoose.Types.ObjectId();
  const clerkUserId = "user_test_clerk_123";
  const ownershipId = new mongoose.Types.ObjectId();

  const classroom = new Classroom({
    name: "Test Template Metrics Class",
    billingMode: "student_paid",
    organization: organizationId,
    ownership: ownershipId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });
  await classroom.save();

  await MetricDefinition.create({
    classroomId: classroom._id,
    key: "test_metric_1",
    label: "Test Metric 1",
    dataType: "number",
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });
  await MetricDefinition.create({
    classroomId: classroom._id,
    key: "test_metric_2",
    label: "Test Metric 2",
    dataType: "string",
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  const countBefore = await MetricDefinition.countDocuments({ classroomId: classroom._id });
  assert.equal(countBefore, 2);

  const template = new ClassroomTemplate({
    organization: organizationId,
    key: `temp_${classroom._id}`,
    label: "Snapshot Template",
    isActive: true,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
    payload: {
      metricDefinitions: [
        { key: "templated_metric_a", label: "Templated Metric A", dataType: "number", isActive: true },
        { key: "templated_metric_b", label: "Templated Metric B", dataType: "number", isActive: true },
      ],
    },
  });
  await template.save();

  const restoreResult = await Classroom.adminRestoreTemplateForClassroom(
    classroom._id,
    organizationId,
    clerkUserId,
    { templateId: template._id }
  );

  assert.equal(restoreResult.metricDefinitionsDeleted, 2);

  const oldMetrics = await MetricDefinition.find({
    classroomId: classroom._id,
    key: { $in: ["test_metric_1", "test_metric_2"] },
  });
  assert.equal(oldMetrics.length, 0);

  const newMetrics = await MetricDefinition.find({
    classroomId: classroom._id,
    key: { $in: ["templated_metric_a", "templated_metric_b"] },
  });
  assert.equal(newMetrics.length, 2);

  const deleteStats = await Classroom.deleteClassroom(classroom._id, organizationId);
  assert.equal(deleteStats.classroomDeleted, true);
  assert.equal(deleteStats.metricDefinitionsDeleted, 2);

  const countAfterDelete = await MetricDefinition.countDocuments({ classroomId: classroom._id });
  assert.equal(countAfterDelete, 0);
});
