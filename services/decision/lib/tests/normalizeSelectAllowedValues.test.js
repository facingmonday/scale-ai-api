const test = require("node:test");
const assert = require("node:assert");
const normalizeSelectAllowedValues = require("../normalizeSelectAllowedValues");

test("normalizeSelectAllowedValues", async (t) => {
  await t.test("should handle empty or missing options", () => {
    assert.deepEqual(normalizeSelectAllowedValues({}), []);
    assert.deepEqual(normalizeSelectAllowedValues({ options: null }), []);
  });

  await t.test("should extract label/value objects from options", () => {
    const def = {
      options: [
        { value: "val1", label: "Label 1" },
        { value: 123, label: "Label 2" },
        { label: "Only Label" },
        "Raw String",
      ],
    };
    assert.deepEqual(normalizeSelectAllowedValues(def), ["val1", 123, "Only Label", "Raw String"]);
  });
});
