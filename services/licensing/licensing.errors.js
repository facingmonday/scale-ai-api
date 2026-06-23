function makeLicensingError(message, statusCode, code, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function makeReservationError(message, statusCode, code, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

module.exports = {
  makeLicensingError,
  makeReservationError,
};
