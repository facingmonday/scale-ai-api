const mongoose = require("mongoose");

const isValidBase64 = (string) => {
  try {
    return Buffer.from(string, "base64").toString("base64") === string;
  } catch (error) {
    return false;
  }
};

const stringToBoolean = (stringValue) => {
  switch (stringValue?.toLowerCase()?.trim()) {
    case "true":
    case "yes":
    case "1":
    case true:
      return true;

    case false:
    case "false":
    case "no":
    case "0":
    case null:
    case undefined:
      return false;

    default:
      return "Invalid Boolean String";
  }
};

const mongooseOperators = [
  "eq",
  "gt",
  "gte",
  "in",
  "lt",
  "lte",
  "ne",
  "nin",
  "regex",
  "elemMatch",
];

const stripHtml = (htmlString) => {
  const regex = /(<([^>]+)>)/gi;
  return htmlString.replace(regex, "");
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Builds MongoDB query and aggregation stages from query parameters
 * @param {Object|Array} queryParams - Query parameters with nested conditions
 * @param {Object} model - Mongoose model to query against
 * @param {Object} options - Additional options for aggregation
 * @returns {Object} Object containing query and aggregation stages
 */
const buildMongoQuery = function (defaultQueryParams, model, options = {}) {
  const queryParams = Array.isArray(defaultQueryParams)
    ? {
        conditions: defaultQueryParams,
        operator: "and",
      }
    : defaultQueryParams;

  // Separate basic filters from filters that need lookups
  const basicQuery = {};
  const lookupDependentQuery = {};

  const query = buildConditions(queryParams, model);

  // Separate filters based on whether they reference looked-up fields
  Object.entries(query).forEach(([key, value]) => {
    if (key.includes(".")) {
      // This is a nested field that might need a lookup
      lookupDependentQuery[key] = value;
    } else {
      basicQuery[key] = value;
    }
  });

  const aggregateStages = [];

  const lookupDependentMatch =
    Object.keys(lookupDependentQuery).length > 0
      ? [{ $match: lookupDependentQuery }]
      : [];

  // Add standard lookups for referenced fields
  const schema = model.schema;
  Object.keys(schema.paths).forEach((path) => {
    const schemaType = schema.paths[path];

    // Handle single reference fields
    if (schemaType.instance === "ObjectId" && schemaType.options.ref) {
      // Get the model name and properly pluralize it
      const modelName = schemaType.options.ref;
      const collectionName = mongoose.model(modelName).collection.name;

      aggregateStages.push({
        $lookup: {
          from: collectionName,
          localField: path,
          foreignField: "_id",
          as: path,
        },
      });

      // Add unwind stage for single references
      aggregateStages.push({
        $unwind: {
          path: `$${path}`,
          preserveNullAndEmptyArrays: true,
        },
      });
    }

    // Handle array of references
    if (
      Array.isArray(schemaType.options.type) &&
      schemaType.options.type[0].ref
    ) {
      const modelName = schemaType.options.type[0].ref;
      const collectionName = mongoose.model(modelName).collection.name;

      aggregateStages.push({
        $lookup: {
          from: collectionName,
          localField: path,
          foreignField: "_id",
          as: path,
        },
      });
    }
  });

  // Add custom lookups from options
  if (options.customLookups) {
    aggregateStages.push(...options.customLookups);
  }

  if (Object.keys(basicQuery).length > 0) {
    aggregateStages.push({ $match: basicQuery });
  }

  aggregateStages.push(...lookupDependentMatch);

  return {
    aggregateStages,
  };
};

/**
 * Recursively builds query conditions
 * @param {Object|Array} conditions - Query conditions
 * @param {Object} model - Mongoose model
 * @returns {Object} MongoDB query object
 */

function buildConditions(conditions, model) {
  if (!conditions) {
    return {};
  }

  // Handle nested conditions with explicit operator
  if (conditions.operator && Array.isArray(conditions.conditions)) {
    const operator = conditions.operator.toLowerCase();
    const mongoOperator = operator === "or" ? "$or" : "$and";

    const validConditions = conditions.conditions
      .map((condition) => {
        if (condition.operator && condition.conditions) {
          // This is a nested AND/OR
          return buildConditions(condition, model);
        } else if (condition.field && condition.operator) {
          // This is a leaf condition
          const result = {};
          const fieldType = getFieldType(model, condition.field);
          if (fieldType) {
            buildQueryCondition(
              result,
              condition.field,
              condition.operator,
              condition.value,
              fieldType
            );
            return result;
          }
        }
        return null;
      })
      .filter((condition) => condition && Object.keys(condition).length > 0);

    return validConditions.length > 0
      ? { [mongoOperator]: validConditions }
      : {};
  }

  // Handle single condition
  if (conditions.field && conditions.operator) {
    const result = {};
    const fieldType = getFieldType(model, conditions.field);

    if (fieldType) {
      buildQueryCondition(
        result,
        conditions.field,
        conditions.operator,
        conditions.value,
        fieldType
      );
      return result;
    }
  } else {
    console.log(conditions.conditions);
  }

  return {};
}

/**
 * Builds a query condition based on operator type
 * @private
 */
function buildQueryCondition(query, field, operator, value, fieldType) {
  if (value === null || value === undefined) {
    query[field] = { $exists: false };
    return;
  }

  const convertedValue = convertValueType(value, fieldType);

  // Special handling for array fields
  if (fieldType === "Array" || fieldType === "Mixed") {
    handleArrayField(query, field, operator, convertedValue, value);
    return;
  }

  if (operator === "elemMatch") {
    if (typeof value !== "object" || Array.isArray(value) || value === null) {
      console.error(`Invalid value for $elemMatch on field '${field}':`, value);
      // Set an empty object to prevent invalid query
      query[field] = { $elemMatch: {} };
      return;
    }

    const converted = {};
    for (const [k, v] of Object.entries(value)) {
      // Handle refId - convert string to ObjectId if it's a valid ObjectId string
      if (k === "refId") {
        if (mongoose.Types.ObjectId.isValid(v)) {
          converted[k] = new mongoose.Types.ObjectId(v);
        } else {
          console.error(`Invalid ObjectId for refId: ${v}`);
          converted[k] = v; // Keep original value if not valid
        }
      } else {
        const type = getFieldType(model, `${field}.${k}`);
        converted[k] = convertValueType(v, type || "Mixed");
      }
    }

    query[field] = { $elemMatch: converted };
    return;
  }

  // Handle Date fields
  if (fieldType === "Date") {
    handleDateField(query, field, operator, convertedValue);
    return;
  }

  // Handle Number fields and other types
  handleStandardField(query, field, operator, convertedValue, fieldType, value);
}

// New helper functions to break down the complexity
function handleArrayField(
  query,
  field,
  operator,
  convertedValue,
  originalValue
) {
  // if (field.includes('.')) {
  //   handleNestedArrayField(query, field, operator, convertedValue);
  //   return;
  // }

  if (operator === "elemMatch") {
    if (
      typeof originalValue !== "object" ||
      Array.isArray(originalValue) ||
      originalValue === null
    ) {
      console.error(
        `Invalid value for $elemMatch on field '${field}':`,
        originalValue
      );
      query[field] = { $elemMatch: {} };
      return;
    }

    const converted = {};
    for (const [k, v] of Object.entries(originalValue)) {
      // Handle refId - convert string to ObjectId if it's a valid ObjectId string
      if (k === "refId") {
        if (mongoose.Types.ObjectId.isValid(v)) {
          converted[k] = new mongoose.Types.ObjectId(v);
        } else {
          console.error(`Invalid ObjectId for refId: ${v}`);
          converted[k] = v; // Keep original value if not valid
        }
      } else {
        converted[k] = v;
      }
    }

    query[field] = { $elemMatch: converted };
    return;
  }

  const operatorMap = {
    in: () => ({
      $in: Array.isArray(convertedValue) ? convertedValue : [convertedValue],
    }),
    nin: () => ({
      $nin: Array.isArray(originalValue) ? originalValue : [originalValue],
    }),
    eq: () => (Array.isArray(originalValue) ? originalValue : [originalValue]),
    default: () => ({
      ["$" + operator]: Array.isArray(originalValue)
        ? originalValue
        : [originalValue],
    }),
  };

  query[field] = operatorMap[operator]
    ? operatorMap[operator]()
    : operatorMap.default();
}

function handleNestedArrayField(query, field, operator, convertedValue) {
  const [arrayField, nestedField] = field.split(".");
  const operatorMap = {
    in: {
      $elemMatch: {
        [nestedField]: Array.isArray(convertedValue)
          ? convertedValue[0]
          : convertedValue,
      },
    },
    nin: {
      $not: {
        $elemMatch: {
          [nestedField]: {
            $in: Array.isArray(convertedValue)
              ? convertedValue[0]
              : convertedValue,
          },
        },
      },
    },
    eq: {
      $elemMatch: {
        [nestedField]: convertedValue,
      },
    },
    default: {
      $elemMatch: {
        [nestedField]: { ["$" + operator]: convertedValue },
      },
    },
  };

  query[arrayField] = operatorMap[operator] || operatorMap.default;
}

function handleDateField(query, field, operator, convertedValue) {
  const getUTCDateBounds = (date) => {
    const startOfDay = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
    const endOfDay = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );
    return { startOfDay, endOfDay };
  };

  const { startOfDay, endOfDay } = getUTCDateBounds(convertedValue);

  const operatorMap = {
    eq: () => ({ $gte: startOfDay, $lte: endOfDay }),
    gte: () => ({ ["$" + operator]: startOfDay }),
    gt: () => ({ ["$" + operator]: startOfDay }),
    lte: () => ({ ["$" + operator]: endOfDay }),
    lt: () => ({ ["$" + operator]: endOfDay }),
    default: () => ({ ["$" + operator]: convertedValue }),
  };

  query[field] = operatorMap[operator]
    ? operatorMap[operator]()
    : operatorMap.default();
}

function handleStandardField(
  query,
  field,
  operator,
  convertedValue,
  fieldType,
  originalValue
) {
  const operatorMap = {
    search: () => ({ $regex: convertedValue, $options: "i" }),
    eq: () => convertedValue,
    in: () => ({
      $in: (Array.isArray(originalValue) ? originalValue : [originalValue]).map(
        (v) => convertValueType(v, fieldType)
      ),
    }),
    nin: () => ({
      $nin: (Array.isArray(originalValue)
        ? originalValue
        : [originalValue]
      ).map((v) => convertValueType(v, fieldType)),
    }),
    exists: () => ({
      $exists: originalValue === "true" || originalValue === true,
    }),
    default: () => ({ ["$" + operator]: convertedValue }),
  };

  query[field] = operatorMap[operator]
    ? operatorMap[operator]()
    : operatorMap.default();
}

/**
 * Gets the field type from a Mongoose model schema
 * @param {Object} model - Mongoose model
 * @param {String} field - Field path (supports dot notation for nested fields)
 * @returns {String} Field type
 */
function getFieldType(model, field) {
  const schema = model.schema;

  // First try to get the field directly (handles cases like "recurrenceRule.dayOfMonth")
  let directField = schema.paths?.[field];
  if (directField) {
    if (directField.type) {
      return directField.type.name || "Mixed";
    }
    return directField.instance || "Mixed";
  }

  // If direct lookup fails, then try nested path traversal
  const fieldPath = field.split(".");
  let currentSchema = schema;

  for (const pathPart of fieldPath) {
    if (!currentSchema) return null;

    if (currentSchema.instance) {
      return currentSchema.instance;
    }
    // Try different ways to get the schema type
    let schemaType = currentSchema.paths?.[pathPart];

    // If not found in paths, check if it's a nested schema
    if (!schemaType && currentSchema.obj) {
      let nestedField = currentSchema.obj[pathPart];

      // Handle nested objects
      if (nestedField && typeof nestedField === "object") {
        if (nestedField.type) {
          schemaType = nestedField;
        } else {
          // This is a nested object without explicit type
          currentSchema = nestedField;
          continue;
        }
      }
    }

    // If still not found, try tree
    if (!schemaType && currentSchema.tree) {
      schemaType = currentSchema.tree[pathPart];
    }

    if (!schemaType) return null;

    // Handle the found schemaType
    if (schemaType.type) {
      if (Array.isArray(schemaType.type)) {
        const arrayType = schemaType.type[0];
        return (
          arrayType.name ||
          (typeof arrayType === "function" ? arrayType.name : "Mixed")
        );
      }
      return schemaType.type.name || "Mixed";
    } else if (schemaType.instance) {
      return schemaType.instance;
    } else if (Array.isArray(schemaType)) {
      const arrayType = schemaType[0];
      return (
        arrayType.name ||
        (typeof arrayType === "function" ? arrayType.name : "Mixed")
      );
    }

    currentSchema = schemaType;
  }

  // Determine final type
  if (currentSchema.type) {
    if (Array.isArray(currentSchema.type)) {
      const arrayType = currentSchema.type[0];
      return (
        arrayType.name ||
        (typeof arrayType === "function" ? arrayType.name : "Mixed")
      );
    }
    return currentSchema.type.name || "Mixed";
  }

  // Default to Mixed if we can't determine the type
  return "Mixed";
}

/**
 * Converts a value to the appropriate type based on the field type
 * @param {*} value - Value to convert
 * @param {String} fieldType - Mongoose field type
 * @returns {*} Converted value
 */
function convertValueType(value, fieldType) {
  if (value === null || value === undefined) return value;

  switch (fieldType) {
    case "ObjectID":
    case "ObjectId":
      return mongoose.Types.ObjectId.isValid(value)
        ? new mongoose.Types.ObjectId(value)
        : value;
    case "Number":
      return Number(value);
    case "Date":
      return new Date(value);
    case "Boolean":
      return value === "true" || value === true;
    case "Array":
      // Handle array values that come in as objects with indexed keys
      if (typeof value === "object" && !Array.isArray(value)) {
        return Object.values(value);
      }
      return Array.isArray(value) ? value : [value];
    default:
      return value;
  }
}

module.exports = {
  isValidBase64,
  stripHtml,
  delay,
  buildMongoQuery,
};
