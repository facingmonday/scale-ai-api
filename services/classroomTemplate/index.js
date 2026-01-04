/**
 * ClassroomTemplate Service Routes
 *
 * Org-owned classroom templates used to seed new classrooms.
 *
 * Mounted at: /v1/admin/classroom-templates
 */
const express = require("express");
const router = express.Router();

const controller = require("./classroomTemplate.controller");
const { requireAuth, checkRole } = require("../../middleware/auth");

router.get(
  "/admin/classroom-templates",
  requireAuth(),
  checkRole("org:admin"),
  controller.listTemplates
);

router.get(
  "/admin/classroom-templates/:templateId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getTemplate
);

router.post(
  "/admin/classroom-templates/:templateId/variable-definitions",
  requireAuth(),
  checkRole("org:admin"),
  controller.addVariableDefinition
);

// Create a new org-owned template from a classroom snapshot
router.post(
  "/admin/classroom-templates/from-classroom",
  requireAuth(),
  checkRole("org:admin"),
  controller.createFromClassroom
);

// Overwrite an org template from a classroom snapshot (no templateId required; defaults to default_supply_chain_101)
router.put(
  "/admin/classroom-templates/from-classroom",
  requireAuth(),
  checkRole("org:admin"),
  controller.overwriteFromClassroom
);

// Overwrite a specific template from a classroom snapshot (templateId required)
router.put(
  "/admin/classroom-templates/:templateId/from-classroom",
  requireAuth(),
  checkRole("org:admin"),
  controller.importFromClass
);

router.post(
  "/admin/classroom-templates/:templateId/import-from-class",
  requireAuth(),
  checkRole("org:admin"),
  controller.importFromClass
);

// Backward-compatible alias (same behavior as POST import-from-class)
router.put(
  "/admin/classroom-templates/:templateId/import-from-class",
  requireAuth(),
  checkRole("org:admin"),
  controller.importFromClass
);

module.exports = router;
