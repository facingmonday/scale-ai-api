const STATUS_CODES = Object.freeze({
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO',
  DELETED: 'DELETED',
});

const STATUS_MESSAGES = Object.freeze({
  [STATUS_CODES.SUCCESS]: 'Success',
  [STATUS_CODES.ERROR]: 'Error',
  [STATUS_CODES.WARNING]: 'Warning',
  [STATUS_CODES.INFO]: 'Info',
  [STATUS_CODES.DELETED]: 'Resource deleted successfully',
});

module.exports = {
  STATUS_CODES,
  STATUS_MESSAGES,
};
