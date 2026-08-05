const test = require("node:test");
const assert = require("node:assert/strict");
const clampNumber = require("./clampNumber");

test("clampNumber", async (t) => {
  await t.test("should pass through non-number types", () => {
    assert.strictEqual(clampNumber({ dataType: "string" }, "abc"), "abc");
  });

  await t.test("should clamp numeric values within min and max", () => {
    assert.strictEqual(clampNumber({ dataType: "number", min: 10, max: 20 }, 15), 15);
    assert.strictEqual(clampNumber({ dataType: "number", min: 10, max: 20 }, 5), 10);
    assert.strictEqual(clampNumber({ dataType: "number", min: 10, max: 20 }, 25), 20);
  });

  await t.test("should clamp with only min or only max set", () => {
    assert.strictEqual(clampNumber({ dataType: "number", min: 10 }, 5), 10);
    assert.strictEqual(clampNumber({ dataType: "number", max: 20 }, 25), 20);
  });

  await t.test("should handle numeric string inputs", () => {
    assert.strictEqual(clampNumber({ dataType: "number", min: 10 }, "5"), 10);
  });
});
