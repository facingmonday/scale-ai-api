/**
 * User Profile Service Routes
 * 
 * Provides endpoints for managing the authenticated user's profile and organizations.
 * Mounted at: /v1/me
 */
const express = require("express");
const router = express.Router();

const {
  requireAuth,
  requireMemberAuth,
  checkRole,
} = require("../../middleware/auth");

// All /me routes require authentication and current org context
router.use(requireMemberAuth());

router.get("/", require("./controllers/getMe.controller"));

router.post(
  "/organizations",
  require("./controllers/createMyOrganization.controller")
);

router.put(
  "/organizations/:id",
  requireAuth(),
  checkRole("org:admin"),
  require("./controllers/updateMyOrganization.controller")
);

// Update current member (placeholder behavior aligned with prior updateMember)
router.patch("/", require("./controllers/updateMe.controller"));

module.exports = router;
