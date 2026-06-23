const test = require("node:test");
const assert = require("node:assert/strict");
require("../../models");

const mongoose = require("mongoose");
const ChatMessage = mongoose.model("ChatMessage");
const ClassroomReport = mongoose.model("ClassroomReport");
const tools = require("./tools");
const controller = require("./ai.controller");

test("ChatMessage model has correct schema properties", () => {
  const schema = ChatMessage.schema.obj;
  assert.ok(schema.classroomId);
  assert.ok(schema.userId);
  assert.ok(schema.role);
  assert.ok(schema.content);
});

test("ClassroomReport model has correct schema properties", () => {
  const schema = ClassroomReport.schema.obj;
  assert.ok(schema.classroomId);
  assert.ok(schema.challengeId);
  assert.ok(schema.reportType);
  assert.ok(schema.payload);
});

test("AI tools exports correct set of tools", () => {
  assert.equal(typeof tools.getStudentProfile, "object");
  assert.equal(typeof tools.getStudentSubmissions, "object");
  assert.equal(typeof tools.getStudentLedgerEntries, "object");
  assert.equal(typeof tools.getScenarioDetails, "object");
  assert.equal(typeof tools.getClassroomSummary, "object");
  assert.equal(typeof tools.getClassRoster, "object");
});

test("AI controller exports handler functions", () => {
  assert.equal(typeof controller.chat, "function");
  assert.equal(typeof controller.getChatHistory, "function");
});
