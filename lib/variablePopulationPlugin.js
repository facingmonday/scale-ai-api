/**
 * Mongoose plugin that automatically includes variables in toObject() and toJSON()
 *
 * This plugin:
 * 1. Uses post-init hook to eagerly load variables when document is initialized
 * 2. Caches variables on the document instance
 * 3. Overrides toObject() and toJSON() to automatically include variables
 * 4. Uses Mongoose's transform option to ensure variables are included in serialization
 *
 * Usage:
 * const variablePopulationPlugin = require('../../lib/variablePopulationPlugin');
 * schema.plugin(variablePopulationPlugin, {
 *   variableValueModel: VariableValue,
 *   appliesTo: 'store' // The appliesTo value for VariableDefinition ('store', 'scenario', or 'submission')
 * });
 *
 * Legacy mode (deprecated): if you still use a per-model collection with a custom FK field,
 * pass foreignKeyField (e.g. 'storeId') and omit appliesTo in the value query.
 *
 * Then variables are automatically included when you call:
 * - document.toObject()
 * - document.toJSON()
 * - JSON.stringify(document)
 * - res.json(document) // Express automatically calls toJSON()
 */
const mongoose = require("mongoose");
const VariableDefinition = require("../services/variableDefinition/variableDefinition.model");

module.exports = function variablePopulationPlugin(schema, options) {
  if (!options || !options.variableValueModel || !options.appliesTo) {
    throw new Error(
      "variablePopulationPlugin requires options: { variableValueModel, appliesTo } and optionally { foreignKeyField } for legacy per-model collections"
    );
  }

  const VariableValueModel = options.variableValueModel;
  const foreignKeyField = options.foreignKeyField; // optional (legacy)
  const appliesTo = options.appliesTo;
  // outputFormat:
  // - "definitionArray" (default): [{ ...VariableDefinition, value }]
  // - "valueMap": { [variableKey]: value|null }
  const outputFormat = options.outputFormat || "definitionArray";
  const isUnifiedModel = !foreignKeyField || options.isUnifiedModel === true;
  const ownerField = isUnifiedModel ? "ownerId" : foreignKeyField;

  // Cache to store loaded variables on document instances
  // Key: document instance, Value: variables (array or object map depending on outputFormat)
  const variablesCache = new WeakMap();

  function getEmptySerializedVariables() {
    return outputFormat === "valueMap" ? {} : [];
  }

  /**
   * Load variables for this document and cache them
   * @returns {Promise<Array|Object>} Variables (array or map) depending on outputFormat
   */
  schema.methods._loadVariables = async function () {
    // Check cache first
    if (variablesCache.has(this)) {
      return variablesCache.get(this);
    }

    // Get classroomId from document (all models using this plugin have classroomId)
    // Handle both populated (object) and unpopulated (ObjectId) classroomId
    const classroomIdRaw = this.classroomId;
    if (!classroomIdRaw) {
      const empty = getEmptySerializedVariables();
      variablesCache.set(this, empty);
      return empty;
    }

    // Extract actual ObjectId - handle both populated and unpopulated cases
    const classroomId = classroomIdRaw._id || classroomIdRaw;

    // Fetch ALL variable definitions for this classroom/appliesTo
    // (ensures we include variables even if no values exist yet)
    const definitions = await VariableDefinition.find({
      classroomId,
      appliesTo,
      isActive: true,
    });

    // Fetch variable values for this document
    const valuesQuery = isUnifiedModel
      ? { appliesTo, [ownerField]: this._id }
      : { [ownerField]: this._id };
    const variables = await VariableValueModel.find(valuesQuery);

    // Create a map of values by key for quick lookup
    const valuesByKey = {};
    (variables || []).forEach((v) => {
      valuesByKey[v.variableKey] = v.value;
    });

    if (outputFormat === "valueMap") {
      const variablesMap = {};

      // Include all definition keys, even if they don't have values yet
      definitions.forEach((def) => {
        variablesMap[def.key] =
          valuesByKey[def.key] !== undefined ? valuesByKey[def.key] : null;
      });

      // Also include any variable values that don't have definitions (orphaned values)
      (variables || []).forEach((v) => {
        if (variablesMap[v.variableKey] === undefined) {
          variablesMap[v.variableKey] = v.value;
        }
      });

      variablesCache.set(this, variablesMap);
      return variablesMap;
    }

    // Default: array of objects with full definition + value
    const variablesArray = definitions.map((def) => {
      const definitionObj = def.toObject();
      return {
        ...definitionObj,
        value: valuesByKey[def.key] !== undefined ? valuesByKey[def.key] : null,
      };
    });

    // Also include any variable values that don't have definitions (orphaned values)
    const definitionKeys = new Set(definitions.map((d) => d.key));
    (variables || []).forEach((v) => {
      if (!definitionKeys.has(v.variableKey)) {
        variablesArray.push({
          key: v.variableKey,
          value: v.value,
        });
      }
    });

    variablesCache.set(this, variablesArray);
    return variablesArray;
  };

  /**
   * Get cached variables (synchronous)
   * @returns {Array|Object} Variables (empty if not loaded yet)
   */
  schema.methods._getCachedVariables = function () {
    return variablesCache.get(this) || getEmptySerializedVariables();
  };

  // Post-init hook: Load variables when document is initialized
  schema.post("init", async function () {
    // Only load if document has an _id (is saved)
    if (this._id) {
      await this._loadVariables();
    }
  });

  // Override toObject() to include variables
  const originalToObject =
    schema.methods.toObject || mongoose.Document.prototype.toObject;
  schema.method(
    "toObject",
    function (options) {
      const obj = originalToObject.call(this, options);

      // Include cached variables (array or map depending on outputFormat)
      const cachedVars = this._getCachedVariables();
      obj.variables = cachedVars;

      return obj;
    },
    { suppressWarning: true }
  );

  // Override toJSON() to include variables (toJSON() calls toObject() by default, but we'll be explicit)
  schema.method(
    "toJSON",
    function (options) {
      return this.toObject(options);
    },
    { suppressWarning: true }
  );

  // Add schema-level transform to ensure variables are included
  if (!schema.options.toObject) {
    schema.options.toObject = {};
  }
  if (!schema.options.toObject.transform) {
    schema.options.toObject.transform = function (doc, ret, options) {
      // Variables are already included by toObject() override, but we ensure they're there
      if (!ret.variables) {
        ret.variables = getEmptySerializedVariables();
      }
      return ret;
    };
  } else {
    // If transform already exists, wrap it
    const originalTransform = schema.options.toObject.transform;
    schema.options.toObject.transform = function (doc, ret, options) {
      const result = originalTransform(doc, ret, options);
      if (!result.variables) {
        result.variables = doc._getCachedVariables
          ? doc._getCachedVariables()
          : getEmptySerializedVariables();
      }
      return result;
    };
  }

  // Same for toJSON
  if (!schema.options.toJSON) {
    schema.options.toJSON = {};
  }
  if (!schema.options.toJSON.transform) {
    schema.options.toJSON.transform = function (doc, ret, options) {
      if (!ret.variables) {
        ret.variables = getEmptySerializedVariables();
      }
      return ret;
    };
  } else {
    const originalTransform = schema.options.toJSON.transform;
    schema.options.toJSON.transform = function (doc, ret, options) {
      const result = originalTransform(doc, ret, options);
      if (!result.variables) {
        result.variables = doc._getCachedVariables
          ? doc._getCachedVariables()
          : getEmptySerializedVariables();
      }
      return result;
    };
  }

  /**
   * Static helper to populate variables for multiple documents efficiently
   * @param {Array} documents - Array of Mongoose documents
   * @returns {Promise<Array>} Array of documents with variables loaded
   */
  schema.statics.populateVariablesForMany = async function (documents) {
    if (!documents || documents.length === 0) {
      return documents;
    }

    // Get all document IDs
    const docIds = documents.map((doc) => doc._id);

    // Get unique classroomIds from documents
    // Handle both populated (object) and unpopulated (ObjectId) classroomId
    const classroomIds = [
      ...new Set(
        documents
          .map((doc) => {
            const classroomId = doc.classroomId;
            if (!classroomId) return null;
            // If populated, extract _id; otherwise use the ObjectId directly
            return classroomId._id
              ? classroomId._id.toString()
              : classroomId.toString();
          })
          .filter(Boolean)
      ),
    ];

    if (classroomIds.length === 0) {
      // No classroomIds, cache empty arrays
      documents.forEach((doc) => {
        variablesCache.set(doc, getEmptySerializedVariables());
      });
      return documents;
    }

    // Fetch ALL variable definitions for all classrooms/appliesTo
    // (ensures we include variables even if no values exist yet)
    const allDefinitions = await VariableDefinition.find({
      classroomId: { $in: classroomIds },
      appliesTo,
      isActive: true,
    });

    // Fetch all variables in one query (more efficient than N+1)
    const valuesQuery = isUnifiedModel
      ? { appliesTo, [ownerField]: { $in: docIds } }
      : { [ownerField]: { $in: docIds } };
    const allVariables = await VariableValueModel.find(valuesQuery);

    // Create a map of definitions by classroomId and key for quick lookup
    const definitionsByClassroomAndKey = {};
    allDefinitions.forEach((def) => {
      const classroomIdStr = def.classroomId.toString();
      if (!definitionsByClassroomAndKey[classroomIdStr]) {
        definitionsByClassroomAndKey[classroomIdStr] = {};
      }
      definitionsByClassroomAndKey[classroomIdStr][def.key] = def.toObject();
    });

    // Group variables by document ID
    const valuesByDocId = {};
    (allVariables || []).forEach((v) => {
      const docId = v[ownerField].toString();
      if (!valuesByDocId[docId]) {
        valuesByDocId[docId] = {};
      }
      valuesByDocId[docId][v.variableKey] = v.value;
    });

    // Build arrays with full definitions and cache them
    documents.forEach((doc) => {
      const docId = doc._id.toString();
      const docValues = valuesByDocId[docId] || {};

      // Handle both populated (object) and unpopulated (ObjectId) classroomId
      const classroomIdRaw = doc.classroomId;
      if (!classroomIdRaw) {
        variablesCache.set(doc, getEmptySerializedVariables());
        return;
      }
      const classroomIdStr = (classroomIdRaw._id || classroomIdRaw).toString();

      if (!classroomIdStr || !definitionsByClassroomAndKey[classroomIdStr]) {
        variablesCache.set(doc, getEmptySerializedVariables());
        return;
      }

      const definitionsForClassroom =
        definitionsByClassroomAndKey[classroomIdStr];

      const definitionKeys = Object.keys(definitionsForClassroom);

      if (outputFormat === "valueMap") {
        const variablesMap = {};

        definitionKeys.forEach((key) => {
          variablesMap[key] =
            docValues[key] !== undefined ? docValues[key] : null;
        });

        // Also include any variable values that don't have definitions (orphaned values)
        Object.keys(docValues).forEach((key) => {
          if (variablesMap[key] === undefined) {
            variablesMap[key] = docValues[key];
          }
        });

        variablesCache.set(doc, variablesMap);
        return;
      }

      // Default: build array with all definitions, including values where they exist
      const variablesArray = definitionKeys.map((key) => {
        const definition = definitionsForClassroom[key];
        return {
          ...definition,
          value: docValues[key] !== undefined ? docValues[key] : null,
        };
      });

      // Also include any variable values that don't have definitions (orphaned values)
      Object.keys(docValues).forEach((key) => {
        if (!definitionsForClassroom[key]) {
          variablesArray.push({
            key,
            value: docValues[key],
          });
        }
      });

      variablesCache.set(doc, variablesArray);
    });

    return documents;
  };
};
