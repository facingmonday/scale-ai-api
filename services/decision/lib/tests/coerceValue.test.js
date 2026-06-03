const test = require("node:test");
const assert = require("node:assert");
const coerceValue = require("../coerceValue");

test("coerceValue", async (t) => {
  await t.test("should return null/undefined values as-is", () => {
    assert.strictEqual(coerceValue({ dataType: "number" }, null), null);
    assert.strictEqual(coerceValue({ dataType: "number" }, undefined), undefined);
  });

  await t.test("should coerce number strings to numbers", () => {
    assert.strictEqual(coerceValue({ dataType: "number" }, "123"), 123);
    assert.strictEqual(coerceValue({ dataType: "number" }, 45.6), 45.6);
  });

  await t.test("should return non-finite/invalid number strings as-is", () => {
    assert.strictEqual(coerceValue({ dataType: "number" }, "abc"), "abc");
  });

  await t.test("should coerce boolean strings to booleans", () => {
    assert.strictEqual(coerceValue({ dataType: "boolean" }, "true"), true);
    assert.strictEqual(coerceValue({ dataType: "boolean" }, "false"), false);
    assert.strictEqual(coerceValue({ dataType: "boolean" }, true), true);
  });

  await t.test("should coerce values to string", () => {
    assert.strictEqual(coerceValue({ dataType: "string" }, 123), "123");
    assert.strictEqual(coerceValue({ dataType: "string" }, "hello"), "hello");
  });
});
