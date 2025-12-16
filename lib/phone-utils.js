const {
  parsePhoneNumber,
  isValidPhoneNumber,
  AsYouType,
} = require("libphonenumber-js");

/**
 * Phone number utility functions for validation and formatting
 */

/**
 * Validates and formats a phone number to E.164 format
 * @param {string|number} phoneNumber - The phone number to validate and format (various formats supported)
 * @param {string} defaultCountry - Default ISO country code (e.g., 'US')
 * @returns {Object} - { isValid: boolean, formatted: string, error: string }
 */
function validateAndFormatPhoneNumber(phoneNumber, defaultCountry = "US") {
  try {
    if (phoneNumber === null || phoneNumber === undefined) {
      return {
        isValid: false,
        formatted: null,
        error: "Phone number is required",
      };
    }

    // Normalize input to string
    let input = String(phoneNumber).trim();

    if (!input) {
      return {
        isValid: false,
        formatted: null,
        error: "Phone number is empty",
      };
    }

    // Remove common extension patterns at the end (e.g., x1234, ext. 55, extension 9)
    input = input.replace(/(ext|x|extension)[\s\.:]*\d+$/i, "");

    // Preserve leading '+' if present, drop all other non-digits
    const hasPlus = input[0] === "+";
    const digits = input.replace(/[^0-9]/g, "");
    let cleaned = hasPlus ? "+" + digits : digits;

    // If no '+', try country-aware normalization (US defaults)
    if (!hasPlus) {
      // US: 10 digits -> +1##########; 11 digits starting with 1 -> +1##########
      if (defaultCountry === "US") {
        if (/^\d{10}$/.test(cleaned)) cleaned = "+1" + cleaned;
        else if (/^1\d{10}$/.test(cleaned)) cleaned = "+" + cleaned;
      }

      // As a fallback, try country-aware validation without '+'
      if (!/^\+/.test(cleaned) && isValidPhoneNumber(cleaned, defaultCountry)) {
        const parsedFallback = parsePhoneNumber(cleaned, defaultCountry);
        return {
          isValid: true,
          formatted: parsedFallback.format("E.164"),
          error: null,
        };
      }
    }

    // Validate final cleaned value; if it starts with '+', pass no country
    const valid = hasPlus
      ? isValidPhoneNumber(cleaned)
      : isValidPhoneNumber(cleaned, defaultCountry);

    if (!valid) {
      return {
        isValid: false,
        formatted: null,
        error: `Invalid phone number format: ${phoneNumber}`,
      };
    }

    const parsed = hasPlus
      ? parsePhoneNumber(cleaned)
      : parsePhoneNumber(cleaned, defaultCountry);
    const formatted = parsed.format("E.164");
    return { isValid: true, formatted, error: null };
  } catch (error) {
    return {
      isValid: false,
      formatted: null,
      error: `Phone number validation error: ${error.message}`,
    };
  }
}

/**
 * Extracts and validates phone number from Expo Contact object
 * Prioritizes mobile numbers based on label, falls back to first valid number
 * @param {Object} contact - Expo Contact object
 * @param {string} defaultCountry - Default country code
 * @returns {Object} - { isValid: boolean, formatted: string, error: string, original: string }
 */
function extractAndValidatePhoneFromContact(contact, defaultCountry = "US") {
  // Collect candidate numbers from various possible fields
  const candidates = [];

  const pushCandidate = (value, label) => {
    if (value) candidates.push({ value, label: (label || "").toLowerCase() });
  };

  if (contact) {
    // Common direct fields sometimes present
    pushCandidate(contact.phone, "direct");
    pushCandidate(contact.mobile, "mobile");
  }

  if (Array.isArray(contact?.phoneNumbers)) {
    for (const phoneObj of contact.phoneNumbers) {
      pushCandidate(phoneObj?.digits, phoneObj?.label);
      pushCandidate(phoneObj?.number, phoneObj?.label);
      pushCandidate(phoneObj?.phone, phoneObj?.label);
      pushCandidate(phoneObj?.value, phoneObj?.label);

      // As a last resort, try to extract a digit sequence from any stringy field
      if (typeof phoneObj?.number === "string") {
        const match = phoneObj.number.match(/[+\d][\d\s\-().xext]+/i);
        if (match) pushCandidate(match[0], phoneObj?.label);
      }
    }
  }

  if (candidates.length === 0) {
    return {
      isValid: false,
      formatted: null,
      error: "No phone numbers found in contact",
      original: null,
    };
  }

  // Score labels to prefer mobile-like entries
  const labelScore = (label) => {
    if (!label) return 0;
    if (
      label.includes("mobile") ||
      label.includes("cell") ||
      label.includes("iphone")
    )
      return 2;
    if (label.includes("home") || label.includes("main")) return 1;
    return 0;
  };

  // Try to validate all, keep the best by label score then first success
  const validated = [];
  for (const c of candidates) {
    const result = validateAndFormatPhoneNumber(c.value, defaultCountry);
    if (result.isValid) {
      validated.push({
        ...result,
        original: c.value,
        _score: labelScore(c.label),
      });
    }
  }

  if (validated.length > 0) {
    validated.sort((a, b) => b._score - a._score);
    const best = validated[0];
    delete best._score;
    return best;
  }

  return {
    isValid: false,
    formatted: null,
    error: "No valid phone numbers found in contact",
    original: null,
  };
}

/**
 * Formats a phone number as you type (for UI input)
 * @param {string} phoneNumber - The phone number being typed
 * @param {string} defaultCountry - Default country code
 * @returns {string} - Formatted phone number
 */
function formatAsYouType(phoneNumber, defaultCountry = "US") {
  try {
    const asYouType = new AsYouType(defaultCountry);
    return asYouType.input(phoneNumber);
  } catch (error) {
    return phoneNumber; // Return original if formatting fails
  }
}

/**
 * Checks if two phone numbers are the same (normalized comparison)
 * @param {string} phone1 - First phone number
 * @param {string} phone2 - Second phone number
 * @param {string} defaultCountry - Default country code
 * @returns {boolean} - True if numbers are the same
 */
function arePhoneNumbersEqual(phone1, phone2, defaultCountry = "US") {
  try {
    const result1 = validateAndFormatPhoneNumber(phone1, defaultCountry);
    const result2 = validateAndFormatPhoneNumber(phone2, defaultCountry);

    if (!result1.isValid || !result2.isValid) {
      return false;
    }

    return result1.formatted === result2.formatted;
  } catch (error) {
    return false;
  }
}

module.exports = {
  validateAndFormatPhoneNumber,
  extractAndValidatePhoneFromContact,
  formatAsYouType,
  arePhoneNumbersEqual,
};
