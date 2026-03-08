const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const simulationOutputDefinitionSchema = new mongoose.Schema({
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
    index: true,
  },
  key: {
    type: String,
    required: true,
    trim: true,
  },
  label: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  dataType: {
    type: String,
    enum: ["number", "string", "object", "array"],
    required: true,
  },
  required: {
    type: Boolean,
    default: false,
  },
  group: {
    type: String,
    default: null,
    trim: true,
  },
  schemaHint: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}).add(baseSchema);

simulationOutputDefinitionSchema.index(
  { organization: 1, classroomId: 1, key: 1 },
  { unique: true, sparse: true }
);
simulationOutputDefinitionSchema.index({ classroomId: 1, isActive: 1 });
simulationOutputDefinitionSchema.index({ organization: 1, classroomId: 1 });

/**
 * Get all active simulation output definitions for a classroom.
 * @param {string} classroomId
 * @param {Object} [options]
 * @param {boolean} [options.includeInactive]
 * @returns {Promise<Array>}
 */
simulationOutputDefinitionSchema.statics.getDefinitionsForClassroom =
  async function (classroomId, options = {}) {
    if (!classroomId) throw new Error("classroomId is required");
    const query = { classroomId, isActive: true };
    if (options.includeInactive) delete query.isActive;
    return this.find(query).sort({ displayOrder: 1, group: 1, label: 1 });
  };

/**
 * Create a simulation output definition (with uniqueness check).
 * @param {string} classroomId
 * @param {Object} payload
 * @param {string} organizationId
 * @param {string} clerkUserId
 * @returns {Promise<Object>}
 */
simulationOutputDefinitionSchema.statics.createDefinition = async function (
  classroomId,
  payload,
  organizationId,
  clerkUserId
) {
  if (!classroomId) throw new Error("classroomId is required");

  const existing = await this.findOne({
    organization: organizationId,
    classroomId,
    key: payload.key,
  });
  if (existing) {
    throw new Error(
      `Simulation output definition with key "${payload.key}" already exists for this classroom`
    );
  }

  const doc = new this({
    classroomId,
    key: payload.key,
    label: payload.label,
    description: payload.description || "",
    dataType: payload.dataType,
    required: payload.required !== undefined ? payload.required : false,
    group: payload.group || null,
    schemaHint: payload.schemaHint || null,
    displayOrder:
      payload.displayOrder !== undefined ? payload.displayOrder : 0,
    isActive: true,
    organization: organizationId,
    createdBy: clerkUserId,
    updatedBy: clerkUserId,
  });

  await doc.save();
  return doc;
};

/**
 * Soft delete
 */
simulationOutputDefinitionSchema.methods.softDelete = async function () {
  this.isActive = false;
  this.updatedBy = this.updatedBy || this.createdBy;
  await this.save();
  return this;
};

/**
 * Restore
 */
simulationOutputDefinitionSchema.methods.restore = async function (
  clerkUserId
) {
  this.isActive = true;
  this.updatedBy = clerkUserId;
  await this.save();
  return this;
};

const SimulationOutputDefinition = mongoose.model(
  "SimulationOutputDefinition",
  simulationOutputDefinitionSchema
);

module.exports = SimulationOutputDefinition;
