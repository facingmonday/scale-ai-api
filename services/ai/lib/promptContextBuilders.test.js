const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BasePromptContextBuilder,
  PromptContextBuilderFactory,
} = require("./promptContextBuilders");

test("promptContextBuilders exports builder classes", () => {
  assert.equal(typeof BasePromptContextBuilder, "function");
  assert.equal(typeof PromptContextBuilderFactory, "function");
});
