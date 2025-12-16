/**
 * Currency Utilities for handling cents <-> dollars conversion
 *
 * All monetary values in the database are stored in cents (smallest currency unit)
 * These utilities help convert for display and API compatibility
 */

/**
 * Convert cents to dollars for display
 * @param {number} cents - Amount in cents
 * @returns {number} Amount in dollars (decimal)
 * @example centsToDollars(1000) // returns 10.00
 */
function centsToDollars(cents) {
  if (typeof cents !== "number" || isNaN(cents)) {
    return 0;
  }
  return cents / 100;
}

/**
 * Convert dollars to cents for storage
 * @param {number} dollars - Amount in dollars
 * @returns {number} Amount in cents (integer)
 * @example dollarsToCents(10.00) // returns 1000
 */
function dollarsToCents(dollars) {
  if (typeof dollars !== "number" || isNaN(dollars)) {
    return 0;
  }
  return Math.round(dollars * 100);
}

/**
 * Format cents as currency string
 * @param {number} cents - Amount in cents
 * @param {string} currency - Currency code (default: 'USD')
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted currency string
 * @example formatCentsAsCurrency(1000) // returns "$10.00"
 */
function formatCentsAsCurrency(cents, currency = "USD", locale = "en-US") {
  const dollars = centsToDollars(cents);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
  }).format(dollars);
}

/**
 * Convert an object's monetary fields from cents to dollars
 * Useful for API responses to maintain backward compatibility
 * @param {Object} obj - Object containing monetary fields
 * @param {Array<string>} fields - Array of field names to convert
 * @returns {Object} New object with specified fields converted to dollars
 */
function convertCentsToDollarsInObject(obj, fields) {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const converted = { ...obj };

  fields.forEach((field) => {
    if (converted[field] !== undefined && converted[field] !== null) {
      converted[field] = centsToDollars(converted[field]);
    }
  });

  return converted;
}

/**
 * Convert an object's monetary fields from dollars to cents
 * Useful for processing API inputs
 * @param {Object} obj - Object containing monetary fields
 * @param {Array<string>} fields - Array of field names to convert
 * @returns {Object} New object with specified fields converted to cents
 */
function convertDollarsToCentsInObject(obj, fields) {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const converted = { ...obj };

  fields.forEach((field) => {
    if (converted[field] !== undefined && converted[field] !== null) {
      converted[field] = dollarsToCents(converted[field]);
    }
  });

  return converted;
}

/**
 * Middleware to convert response monetary fields from cents to dollars
 * @param {Array<string>} fields - Fields to convert
 * @returns {Function} Express middleware function
 */
function convertResponseCentsToDollars(
  fields = [
    "price",
    "amount",
    "total",
    "subTotal",
    "tax",
    "applicationFeeAmount",
  ]
) {
  return (req, res, next) => {
    const originalJson = res.json;

    res.json = function (data) {
      if (data && typeof data === "object") {
        // Handle arrays
        if (Array.isArray(data)) {
          data = data.map((item) =>
            convertCentsToDollarsInObject(item, fields)
          );
        } else {
          // Handle single objects
          data = convertCentsToDollarsInObject(data, fields);
        }
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Validate that a monetary value is properly formatted
 * @param {number} cents - Value in cents to validate
 * @returns {boolean} True if valid
 */
function isValidCentsAmount(cents) {
  return (
    typeof cents === "number" &&
    !isNaN(cents) &&
    cents >= 0 &&
    Number.isInteger(cents)
  );
}

/**
 * Common monetary field names used throughout the application
 */
const MONETARY_FIELDS = {
  CART: ["subTotal", "tax", "total", "applicationFeeAmount"],
  TICKET_TYPE: ["price"],
  TICKET_TYPE_OPTION: ["price"],
  ORDER: ["price"],
  PAYMENT: ["amount"],
};

module.exports = {
  centsToDollars,
  dollarsToCents,
  formatCentsAsCurrency,
  convertCentsToDollarsInObject,
  convertDollarsToCentsInObject,
  convertResponseCentsToDollars,
  isValidCentsAmount,
  MONETARY_FIELDS,
};
