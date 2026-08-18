const express = require("express");

const rosterImportJsonParser = express.json({ limit: "5mb" });
const challengeAiJsonParser = express.json({ limit: "1mb" });
const defaultJsonParser = express.json();

const ROSTER_IMPORT_PATH =
  /^\/v1\/licensing\/classrooms\/[^/]+\/roster-import\/?$/;
const CHALLENGE_AI_PATH = /^\/v1\/admin\/challenges\/ai\/?$/;

function jsonBodyParser(req, res, next) {
  let parser = defaultJsonParser;
  if (req.method === "POST" && ROSTER_IMPORT_PATH.test(req.path)) {
    parser = rosterImportJsonParser;
  } else if (req.method === "POST" && CHALLENGE_AI_PATH.test(req.path)) {
    parser = challengeAiJsonParser;
  }

  return parser(req, res, next);
}

module.exports = jsonBodyParser;
