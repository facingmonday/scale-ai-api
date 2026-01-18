/**
 * Numeric utilities.
 *
 * Keep these small + pure. These helpers are used in multiple places where we
 * need stable rounding to prevent float drift in persisted values.
 */

/**
 * Round a value to 2 decimal places (e.g., currency cents precision).
 * If the input is not a finite number, returns the original value unchanged.
 * @param {*} n
 * @returns {*}
 */
function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return n;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/**
 * Round a value to the nearest integer.
 * If the input is not a finite number, returns the original value unchanged.
 * @param {*} n
 * @returns {*}
 */
function roundInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return n;
  return Math.round(x);
}

module.exports = {
  round2,
  roundInt,
};

