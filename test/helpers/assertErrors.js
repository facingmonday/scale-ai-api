const assert = require("node:assert/strict");

function assertThrowsWithCode(fn, expectedCode, { statusCode } = {}) {
  assert.throws(fn, (err) => {
    assert.equal(err.code, expectedCode);
    if (statusCode !== undefined) {
      assert.equal(err.statusCode, statusCode);
    }
    return true;
  });
}

async function assertRejectsWithCode(promise, expectedCode, { statusCode } = {}) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, expectedCode);
    if (statusCode !== undefined) {
      assert.equal(err.statusCode, statusCode);
    }
    return true;
  });
}

function assertAppError(err, { message, code, statusCode, details } = {}) {
  if (message !== undefined) assert.equal(err.message, message);
  if (code !== undefined) assert.equal(err.code, code);
  if (statusCode !== undefined) assert.equal(err.statusCode, statusCode);
  if (details !== undefined) assert.deepEqual(err.details, details);
}

module.exports = {
  assertThrowsWithCode,
  assertRejectsWithCode,
  assertAppError,
};
