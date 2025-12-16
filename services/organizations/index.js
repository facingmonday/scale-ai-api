const express = require("express");
const { requireMemberAuth } = require("../../middleware/auth");
const organizationsController = require("./organizations.controller");
const router = express.Router();

router.post(
  "/",
  requireMemberAuth(),
  organizationsController.createOrganization
);

module.exports = router;
