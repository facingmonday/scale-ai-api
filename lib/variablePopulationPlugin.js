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
 *   variableValueModel: StoreVariableValue,
 *   foreignKeyField: 'storeId', // The field name in VariableValue model that references this model
 *   appliesTo: 'store' // The appliesTo value for VariableDefinition ('store', 'scenario', or 'submission')
 * });
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
  if (
    !options ||
    !options.variableValueModel ||
    !options.foreignKeyField ||
    !options.appliesTo
  ) {
    throw new Error(
      "variablePopulationPlugin requires options: { variableValueModel, foreignKeyField, appliesTo }"
    );
  }

  const VariableValueModel = options.variableValueModel;
  const foreignKeyField = options.foreignKeyField;
  const appliesTo = options.appliesTo;

  // Cache to store loaded variables on document instances
  // Key: document instance, Value: variables array
  const variablesCache = new WeakMap();

  /**
   * Load variables for this document and cache them
   * @returns {Promise<Array>} Variables array with full definitions
   */
  schema.methods._loadVariables = async function () {
    // Check cache first
    if (variablesCache.has(this)) {
      return variablesCache.get(this);
    }

    // Get classroomId from document (all models using this plugin have classroomId)
    const classroomId = this.classroomId;
    if (!classroomId) {
      const emptyArray = [];
      variablesCache.set(this, emptyArray);
      return emptyArray;
    }

    // Load ALL variable definitions for this classroom/appliesTo combination
    // This ensures we show all available definitions even if they don't have values yet
    const definitions = await VariableDefinition.find({
      classroomId,
      appliesTo,
      isActive: true,
    });

    // Load variable values from database
    const variables = await VariableValueModel.find({
      [foreignKeyField]: this._id,
    });

    // Create a map of values by key for quick lookup
    const valuesByKey = {};
    variables.forEach((v) => {
      valuesByKey[v.variableKey] = v.value;
    });

    // Build array of objects with full definition and value (or null if no value)
    const variablesArray = definitions.map((def) => {
      const definitionObj = def.toObject();
      return {
        ...definitionObj,
        value: valuesByKey[def.key] !== undefined ? valuesByKey[def.key] : null,
      };
    });

    // Also include any variable values that don't have definitions (orphaned values)
    const definitionKeys = new Set(definitions.map((d) => d.key));
    variables.forEach((v) => {
      if (!definitionKeys.has(v.variableKey)) {
        variablesArray.push({
          key: v.variableKey,
          value: v.value,
        });
      }
    });

    // Cache the variables
    variablesCache.set(this, variablesArray);

    return variablesArray;
  };

  /**
   * Get cached variables (synchronous)
   * @returns {Array} Variables array (empty if not loaded yet)
   */
  schema.methods._getCachedVariables = function () {
    return variablesCache.get(this) || [];
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

      // Include cached variables (array format)
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
        ret.variables = [];
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
          : [];
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
        ret.variables = [];
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
          : [];
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
    const classroomIds = [
      ...new Set(
        documents.map((doc) => doc.classroomId?.toString()).filter(Boolean)
      ),
    ];

    if (classroomIds.length === 0) {
      // No classroomIds, cache empty arrays
      documents.forEach((doc) => {
        variablesCache.set(doc, []);
      });
      return documents;
    }

    // Fetch ALL variable definitions for all classrooms/appliesTo combination
    // This ensures we show all available definitions even if they don't have values yet
    const allDefinitions = await VariableDefinition.find({
      classroomId: { $in: classroomIds },
      appliesTo,
      isActive: true,
    });

    // Fetch all variables in one query (more efficient than N+1)
    const allVariables = await VariableValueModel.find({
      [foreignKeyField]: { $in: docIds },
    });

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
    const variablesByDocId = {};
    allVariables.forEach((v) => {
      const docId = v[foreignKeyField].toString();
      if (!variablesByDocId[docId]) {
        variablesByDocId[docId] = {};
      }
      variablesByDocId[docId][v.variableKey] = v.value;
    });

    // Build arrays with full definitions and cache them
    documents.forEach((doc) => {
      const docId = doc._id.toString();
      const docValues = variablesByDocId[docId] || {};
      const classroomIdStr = doc.classroomId?.toString();

      if (!classroomIdStr || !definitionsByClassroomAndKey[classroomIdStr]) {
        variablesCache.set(doc, []);
        return;
      }

      const definitionsForClassroom =
        definitionsByClassroomAndKey[classroomIdStr];
      const definitionKeys = Object.keys(definitionsForClassroom);

      // Build array with all definitions, including values where they exist
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
            key: key,
            value: docValues[key],
          });
        }
      });

      variablesCache.set(doc, variablesArray);
    });

    return documents;
  };
};
