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

/**
 * @openapi
 * /v1/admin/classroom-templates:
 *   get:
 *     summary: List classroom templates
 *     description: Fetch all templates configured in the organization. Requires org:admin role.
 *     tags:
 *       - Classroom Templates
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of templates.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ClassroomTemplate'
 */
router.get(
  "/admin/classroom-templates",
  requireAuth(),
  checkRole("org:admin"),
  controller.listTemplates
);

/**
 * @openapi
 * /v1/admin/classroom-templates/{templateId}:
 *   get:
 *     summary: Get classroom template by ID
 *     description: Retrieve detailed configurations for a specific template. Requires org:admin role.
 *     tags:
 *       - Classroom Templates
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClassroomTemplate'
 */
router.get(
  "/admin/classroom-templates/:templateId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getTemplate
);

/**
 * @openapi
 * /v1/admin/classroom-templates/{templateId}/variable-definitions:
 *   post:
 *     summary: Add variable definition to template
 *     description: Registers a variable schema inside the template. Requires org:admin role.
 *     tags:
 *       - Classroom Templates
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Variable added.
 */
router.post(
  "/admin/classroom-templates/:templateId/variable-definitions",
  requireAuth(),
  checkRole("org:admin"),
  controller.addVariableDefinition
);

// Create a new org-owned template from a classroom snapshot
/**
 * @openapi
 * /v1/admin/classroom-templates/from-classroom:
 *   post:
 *     summary: Create template from classroom snapshot
 *     description: Take a snapshot of a classroom and save it as a new template. Requires org:admin role.
 *     tags:
 *       - Classroom Templates
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Template created from snapshot.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClassroomTemplate'
 *   put:
 *     summary: Overwrite default template from classroom snapshot
 *     description: Reset/overwrite the default template layout from a classroom state. Requires org:admin role.
 *     tags:
 *       - Classroom Templates
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Default template updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClassroomTemplate'
 */
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
/**
 * @openapi
 * /v1/admin/classroom-templates/{templateId}/from-classroom:
 *   put:
 *     summary: Overwrite specific template from classroom snapshot
 *     description: Overwrite an existing template from classroom variables/metrics. Requires org:admin role.
 *     tags:
 *       - Classroom Templates
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClassroomTemplate'
 */
router.put(
  "/admin/classroom-templates/:templateId/from-classroom",
  requireAuth(),
  checkRole("org:admin"),
  controller.importFromClass
);

/**
 * @openapi
 * /v1/admin/classroom-templates/{templateId}/import-from-class:
 *   post:
 *     summary: Import from classroom (alternative endpoint)
 *     description: Copy classroom configurations to this template. Requires org:admin role.
 *     tags:
 *       - Classroom Templates
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Imported successfully.
 *   put:
 *     summary: Import from classroom (alternative put method)
 *     description: Overwrite/import classroom settings to template. Requires org:admin role.
 *     tags:
 *       - Classroom Templates
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: templateId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Overwritten successfully.
 */
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
