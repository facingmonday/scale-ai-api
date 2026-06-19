const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Classroom = require("../services/classroom/classroom.model");
const ClassroomTemplate = require("../services/classroomTemplate/classroomTemplate.model");
const MetricDefinition = require("../services/metricDefinition/metricDefinition.model");

async function connectDb() {
  if (mongoose.connection.readyState === 0) {
    let uri = process.env.MONGO_URL || process.env.MONGO_URI;
    if (!uri && process.env.MONGO_SCHEME) {
      uri = `${process.env.MONGO_SCHEME}://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOSTNAME}/${process.env.MONGO_DB}?authSource=admin`;
    }
    if (!uri) {
      uri = "mongodb://localhost:27017/scale-ai-api";
    }
    await mongoose.connect(uri);
  }
}

test("classroom template and metric definitions lifecycle integration", async (t) => {
  try {
    await connectDb();

    const organizationId = new mongoose.Types.ObjectId();
    const clerkUserId = "user_test_clerk_123";
    const ownershipId = new mongoose.Types.ObjectId();

    // 1. Create a classroom
    const classroom = new Classroom({
      name: "Test Template Metrics Class",
      billingMode: "student_paid",
      organization: organizationId,
      ownership: ownershipId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });
    await classroom.save();

    // 2. Create custom metric definitions for the classroom
    const metric1 = await MetricDefinition.create({
      classroomId: classroom._id,
      key: "test_metric_1",
      label: "Test Metric 1",
      dataType: "number",
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    const metric2 = await MetricDefinition.create({
      classroomId: classroom._id,
      key: "test_metric_2",
      label: "Test Metric 2",
      dataType: "string",
      organization: organizationId,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    // Verify they exist
    let countBefore = await MetricDefinition.countDocuments({ classroomId: classroom._id });
    assert.equal(countBefore, 2);

    // 3. Create a template containing these metrics
    const template = new ClassroomTemplate({
      organization: organizationId,
      key: `temp_${classroom._id}`,
      label: "Snapshot Template",
      isActive: true,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
      payload: {
        metricDefinitions: [
          {
            key: "templated_metric_a",
            label: "Templated Metric A",
            dataType: "number",
            isActive: true,
          },
          {
            key: "templated_metric_b",
            label: "Templated Metric B",
            dataType: "number",
            isActive: true,
          }
        ]
      }
    });
    await template.save();

    // 4. Restore classroom from template
    const restoreResult = await Classroom.adminRestoreTemplateForClassroom(
      classroom._id,
      organizationId,
      clerkUserId,
      { templateId: template._id }
    );

    // Assertions on restore stats
    assert.equal(restoreResult.metricDefinitionsDeleted, 2);

    // Verify the old custom metrics are deleted
    const oldMetrics = await MetricDefinition.find({
      classroomId: classroom._id,
      key: { $in: ["test_metric_1", "test_metric_2"] }
    });
    assert.equal(oldMetrics.length, 0);

    // Verify the new template metrics are created
    const newMetrics = await MetricDefinition.find({
      classroomId: classroom._id,
      key: { $in: ["templated_metric_a", "templated_metric_b"] }
    });
    assert.equal(newMetrics.length, 2);

    // 5. Delete the classroom
    const deleteStats = await Classroom.deleteClassroom(classroom._id, organizationId);
    assert.equal(deleteStats.classroomDeleted, true);
    assert.equal(deleteStats.metricDefinitionsDeleted, 2);

    // Verify metric definitions are deleted from DB
    const countAfterDelete = await MetricDefinition.countDocuments({ classroomId: classroom._id });
    assert.equal(countAfterDelete, 0);

    // Clean up template
    await ClassroomTemplate.deleteOne({ _id: template._id });

    await mongoose.connection.close();
    console.log("SUCCESS!");
  } catch (error) {
    console.error("TEST FAILED WITH ERROR:", error);
    try {
      await mongoose.connection.close();
    } catch (_) {}
    throw error;
  }
});
