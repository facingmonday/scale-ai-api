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

router.post(
  "/admin/classroom-templates/:templateId/import-from-class",
  requireAuth(),
  checkRole("org:admin"),
  controller.importFromClass
);

module.exports = router;


