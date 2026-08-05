const test = require("node:test");
const assert = require("node:assert/strict");
require("../../models");
const mongoose = require("mongoose");

test("chat model schema exists", () => {
  const ChatMessage = mongoose.model("ChatMessage");
  assert.ok(ChatMessage.schema.obj.classroomId);
});
