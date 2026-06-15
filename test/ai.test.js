const test = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config();
const mongoose = require("mongoose");

// Load all models
require("../models");

const ChatMessage = mongoose.model("ChatMessage");
const ClassroomReport = mongoose.model("ClassroomReport");
const tools = require("../services/ai/tools");
const controller = require("../services/ai/ai.controller");

test("AI ChatMessage model has correct schema properties", () => {
  const schema = ChatMessage.schema.obj;
  assert.ok(schema.classroomId, "classroomId should exist");
  assert.ok(schema.userId, "userId should exist");
  assert.ok(schema.role, "role should exist");
  assert.ok(schema.content, "content should exist");
});

test("AI ClassroomReport model has correct schema properties", () => {
  const schema = ClassroomReport.schema.obj;
  assert.ok(schema.classroomId, "classroomId should exist");
  assert.ok(schema.challengeId, "challengeId should exist");
  assert.ok(schema.reportType, "reportType should exist");
  assert.ok(schema.payload, "payload should exist");
});

test("AI Tools exports correct set of tools", () => {
  assert.ok(tools.getStudentProfile, "getStudentProfile tool should exist");
  assert.ok(tools.getStudentSubmissions, "getStudentSubmissions tool should exist");
  assert.ok(tools.getStudentLedgerEntries, "getStudentLedgerEntries tool should exist");
  assert.ok(tools.getScenarioDetails, "getScenarioDetails tool should exist");
  assert.ok(tools.getClassroomSummary, "getClassroomSummary tool should exist");
  assert.ok(tools.getClassRoster, "getClassRoster tool should exist");
});

test("AI Controller exports handler functions", () => {
  assert.equal(typeof controller.chat, "function", "chat handler should be exported");
  assert.equal(typeof controller.getChatHistory, "function", "getChatHistory handler should be exported");
});
