const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const controller = require("./licensing.controller");
const { PLAN_CATALOG } = require("./planCatalog");

test("licensing controller", async (t) => {
  await t.test("getPlans returns plan catalog", async () => {
    const app = express();
    app.get("/plans", controller.getPlans);

    const res = await request(app).get("/plans");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, PLAN_CATALOG);
  });
});
