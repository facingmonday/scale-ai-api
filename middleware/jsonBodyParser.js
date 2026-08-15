const express = require("express");

const rosterImportJsonParser = express.json({ limit: "5mb" });
const defaultJsonParser = express.json();

const ROSTER_IMPORT_PATH =
  /^\/v1\/licensing\/classrooms\/[^/]+\/roster-import\/?$/;

function jsonBodyParser(req, res, next) {
  const parser =
    req.method === "POST" && ROSTER_IMPORT_PATH.test(req.path)
      ? rosterImportJsonParser
      : defaultJsonParser;

  return parser(req, res, next);
}

module.exports = jsonBodyParser;
