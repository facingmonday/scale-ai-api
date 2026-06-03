const test = require("node:test");
const assert = require("node:assert");
const fillMissingWithDefaults = require("../fillMissingWithDefaults");

test("fillMissingWithDefaults", async (t) => {
  await t.test("should keep existing values", () => {
    const definitions = [{ key: "numVar", dataType: "number" }];
    const values = { numVar: 42 };
    assert.deepEqual(fillMissingWithDefaults(definitions, values), { numVar: 42 });
  });

  await t.test("should fall back to defaultValue if set", () => {
    const definitions = [{ key: "numVar", dataType: "number", defaultValue: 99 }];
    assert.deepEqual(fillMissingWithDefaults(definitions, {}), { numVar: 99 });
  });

  await t.test("should apply type fallback if no defaultValue", () => {
    const definitions = [
      { key: "numVar", dataType: "number" },
      { key: "boolVar", dataType: "boolean" },
      { key: "selectVar", dataType: "select", options: ["hello"] },
      { key: "strVar", dataType: "string" },
    ];
    assert.deepEqual(fillMissingWithDefaults(definitions, {}), {
      numVar: 0,
      boolVar: false,
      selectVar: "hello",
      strVar: "",
    });
  });
});
