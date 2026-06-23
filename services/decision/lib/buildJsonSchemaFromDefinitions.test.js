const test = require("node:test");
const assert = require("node:assert/strict");
const buildJsonSchemaFromDefinitions = require("./buildJsonSchemaFromDefinitions");

test("buildJsonSchemaFromDefinitions", async (t) => {
  await t.test("should construct properties and required fields correctly", () => {
    const definitions = [
      { key: "numVar", dataType: "number", min: 0, max: 10, description: "A number" },
      { key: "boolVar", dataType: "boolean", label: "A boolean" },
      { key: "selectVar", dataType: "select", options: ["opt1", "opt2"] },
      { key: "strVar", dataType: "string" },
    ];

    const schema = buildJsonSchemaFromDefinitions(definitions);

    assert.strictEqual(schema.type, "object");
    assert.strictEqual(schema.additionalProperties, false);
    assert.deepEqual(schema.required, ["numVar", "boolVar", "selectVar", "strVar"]);

    assert.deepEqual(schema.properties.numVar, {
      type: "number",
      description: "A number",
      minimum: 0,
      maximum: 10,
    });

    assert.deepEqual(schema.properties.boolVar, {
      type: "boolean",
      description: "A boolean",
    });

    assert.deepEqual(schema.properties.selectVar, {
      description: "selectVar",
      enum: ["opt1", "opt2"],
    });

    assert.deepEqual(schema.properties.strVar, {
      type: "string",
      description: "strVar",
    });
  });
});
