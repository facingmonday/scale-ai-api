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
 *   foreignKeyField: 'storeId' // The field name in VariableValue model that references this model
 * });
 *
 * Then variables are automatically included when you call:
 * - document.toObject()
 * - document.toJSON()
 * - JSON.stringify(document)
 * - res.json(document) // Express automatically calls toJSON()
 */
module.exports = function variablePopulationPlugin(schema, options) {
  if (!options || !options.variableValueModel || !options.foreignKeyField) {
    throw new Error(
      "variablePopulationPlugin requires options: { variableValueModel, foreignKeyField }"
    );
  }

  const VariableValueModel = options.variableValueModel;
  const foreignKeyField = options.foreignKeyField;

  // Cache to store loaded variables on document instances
  // Key: document instance, Value: variables object
  const variablesCache = new WeakMap();

  /**
   * Load variables for this document and cache them
   * @returns {Promise<Object>} Variables object
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

    // Convert to object
    const variablesObj = {};
    variables.forEach((v) => {
      variablesObj[v.variableKey] = v.value;
    });

    // Cache the variables
    variablesCache.set(this, variablesObj);

    return variablesObj;
  };

  /**
   * Get cached variables (synchronous)
   * @returns {Object} Variables object (empty if not loaded yet)
   */
  schema.methods._getCachedVariables = function () {
    return variablesCache.get(this) || {};
  };

  // Post-init hook: Load variables when document is initialized
  schema.post("init", async function () {
    // Only load if document has an _id (is saved)
    if (this._id) {
      await this._loadVariables();
    }
  });

  // Override toObject() to include variables
  const originalToObject = schema.methods.toObject;
  schema.methods.toObject = function (options) {
    const obj = originalToObject.call(this, options);

    // Include cached variables
    const cachedVars = this._getCachedVariables();
    obj.variables = cachedVars;

    return obj;
  };

  // Override toJSON() to include variables (toJSON() calls toObject() by default, but we'll be explicit)
  schema.methods.toJSON = function (options) {
    return this.toObject(options);
  };

  // Add schema-level transform to ensure variables are included
  if (!schema.options.toObject) {
    schema.options.toObject = {};
  }
  if (!schema.options.toObject.transform) {
    schema.options.toObject.transform = function (doc, ret, options) {
      // Variables are already included by toObject() override, but we ensure they're there
      if (!ret.variables) {
        ret.variables = {};
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
          : {};
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
        ret.variables = {};
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
          : {};
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

    // Group variables by document ID and cache them
    const variablesByDocId = {};
    allVariables.forEach((v) => {
      const docId = v[foreignKeyField].toString();
      if (!variablesByDocId[docId]) {
        variablesByDocId[docId] = {};
      }
      variablesByDocId[docId][v.variableKey] = v.value;
    });

    // Cache variables on each document
    documents.forEach((doc) => {
      const docId = doc._id.toString();
      variablesCache.set(doc, variablesByDocId[docId] || {});
    });

    return documents;
  };
};
