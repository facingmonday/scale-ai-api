const express = require("express");
const { requireMemberAuth } = require("../../middleware/auth");
const organizationsController = require("./organizations.controller");
const router = express.Router();

// Get all organizations
router.get(
  "/",
  requireMemberAuth(),
  organizationsController.getAllOrganizations
);

// Create a new organization
router.post(
  "/",
  requireMemberAuth(),
  organizationsController.createOrganization
);

// Join an organization
router.post(
  "/:organizationId/join",
  requireMemberAuth(),
  organizationsController.joinOrganization
);

module.exports = router;
