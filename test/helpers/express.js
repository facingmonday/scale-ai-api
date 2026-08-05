const express = require("express");
const bodyParser = require("body-parser");

function buildTestApp(router, options = {}) {
  const {
    auth = { userId: "user_test_clerk" },
    organization = null,
    member = null,
    clerkUser = null,
    user = member,
    role = "org:admin",
  } = options;

  const app = express();
  app.use(bodyParser.json());
  app.use((req, _res, next) => {
    req.auth = auth;
    req.clerkUser = clerkUser || { id: auth.userId, emailAddresses: [] };
    req.user = user;
    if (organization) req.organization = organization;
    if (member) req.member = member;
    req.role = role;
    next();
  });
  app.use(router);

  app.use((err, _req, res, _next) => {
    const status = err.statusCode || err.status || 500;
    res.status(status).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  });

  return app;
}

module.exports = { buildTestApp };
