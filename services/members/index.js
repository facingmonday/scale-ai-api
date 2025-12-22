/**
 * Members Service Routes
 * 
 * Provides endpoints for managing organization members (users).
 * All routes require org:admin role.
 * Mounted at: /v1/members
 */
const express = require("express");
const membersController = require("./members.controller");
const { requireAuth, checkRole } = require("../../middleware/auth");

const router = express.Router();

router.use(requireAuth());
router.use(checkRole("org:admin"));

// Member management routes
router.post("/", membersController.createMember);
router.get("/", membersController.getAllMembers);
router.get("/search", membersController.searchMembers);
router.get("/stats", membersController.getMemberStats);
router.put(
  "/:id/organization-membership",
  membersController.updateOrganizationMembership
);
router.get("/:id", membersController.getMemberById);
router.put("/:id", membersController.updateMember);

router.delete("/:id", membersController.removeMember);

// Add existing Clerk user to organization
router.post("/add-existing", membersController.addExistingUser);

// Export members as CSV
router.post("/export", membersController.exportMembers);

module.exports = router;
