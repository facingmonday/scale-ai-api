const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const jsonBodyParser = require("../../middleware/jsonBodyParser");

function buildApp() {
  const app = express();
  app.use(jsonBodyParser);
  app.post("*", (req, res) => {
    res.json({ length: req.body.csv.length });
  });
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ error: error.type });
  });
  return app;
}

test("JSON body parser", async (t) => {
  const body = { csv: "x".repeat(150 * 1024) };

  await t.test("accepts roster imports larger than the default limit", async () => {
    const response = await request(buildApp())
      .post(
        "/v1/licensing/classrooms/6a242d346041299ec4191283/roster-import",
      )
      .send(body)
      .expect(200);

    assert.equal(response.body.length, body.csv.length);
  });

  await t.test("accepts large AI challenge prompts", async () => {
    const response = await request(buildApp())
      .post("/v1/admin/challenges/ai")
      .send(body)
      .expect(200);

    assert.equal(response.body.length, body.csv.length);
  });

  await t.test("keeps the default limit for other endpoints", async () => {
    const response = await request(buildApp())
      .post("/v1/licensing/summary")
      .send(body)
      .expect(413);

    assert.equal(response.body.error, "entity.too.large");
  });
});
