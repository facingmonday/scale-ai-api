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

    // Load variables from database
    const variables = await VariableValueModel.find({
      [foreignKeyField]: this._id,
    });

    if (!variables || variables.length === 0) {
      const emptyArray = [];
      variablesCache.set(this, emptyArray);
      return emptyArray;
    }

    // Get classroomId from document (all models using this plugin have classroomId)
    const classroomId = this.classroomId;
    if (!classroomId) {
      const emptyArray = [];
      variablesCache.set(this, emptyArray);
      return emptyArray;
    }

    // Get all unique variable keys
    const variableKeys = [...new Set(variables.map((v) => v.variableKey))];

    // Fetch variable definitions in one query
    const definitions = await VariableDefinition.find({
      classroomId,
      appliesTo,
      key: { $in: variableKeys },
      isActive: true,
    });

    // Create a map of definitions by key for quick lookup
    const definitionsByKey = {};
    definitions.forEach((def) => {
      definitionsByKey[def.key] = def.toObject();
    });

    // Build array of objects with full definition and value
    const variablesArray = variables.map((v) => {
      const definition = definitionsByKey[v.variableKey];
      if (!definition) {
        // If definition not found, return just the key and value
        return {
          key: v.variableKey,
          value: v.value,
        };
      }
      return {
        ...definition,
        value: v.value,
      };
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

    // Fetch all variables in one query (more efficient than N+1)
    const allVariables = await VariableValueModel.find({
      [foreignKeyField]: { $in: docIds },
    });

    if (!allVariables || allVariables.length === 0) {
      // Cache empty arrays for all documents
      documents.forEach((doc) => {
        variablesCache.set(doc, []);
      });
      return documents;
    }

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

    // Get all unique variable keys
    const variableKeys = [...new Set(allVariables.map((v) => v.variableKey))];

    // Fetch variable definitions in one query
    const definitions = await VariableDefinition.find({
      classroomId: { $in: classroomIds },
      appliesTo,
      key: { $in: variableKeys },
      isActive: true,
    });

    // Create a map of definitions by classroomId and key for quick lookup
    const definitionsByClassroomAndKey = {};
    definitions.forEach((def) => {
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
        variablesByDocId[docId] = [];
      }
      variablesByDocId[docId].push({
        variableKey: v.variableKey,
        value: v.value,
      });
    });

    // Build arrays with full definitions and cache them
    documents.forEach((doc) => {
      const docId = doc._id.toString();
      const docVariables = variablesByDocId[docId] || [];
      const classroomIdStr = doc.classroomId?.toString();

      if (!classroomIdStr || !definitionsByClassroomAndKey[classroomIdStr]) {
        variablesCache.set(doc, []);
        return;
      }

      const definitionsForClassroom =
        definitionsByClassroomAndKey[classroomIdStr];
      const variablesArray = docVariables.map((v) => {
        const definition = definitionsForClassroom[v.variableKey];
        if (!definition) {
          // If definition not found, return just the key and value
          return {
            key: v.variableKey,
            value: v.value,
          };
        }
        return {
          ...definition,
          value: v.value,
        };
      });

      variablesCache.set(doc, variablesArray);
    });

    return documents;
  };
};
