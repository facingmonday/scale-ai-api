const express = require("express");
const { requireAuth, checkRole } = require("../../middleware/auth");
const { gradebookAvailable } = require("../../lib/gradingSettings");
const controller = require("./grading.controller");
const router = express.Router({ mergeParams: true });

/**
 * @openapi
 * /v1/admin/class/{classroomId}/gradebook:
 *   get:
 *     tags: [Gradebook]
 *     summary: Teacher-only completion grades for a classroom
 *     description: New challenges only. Computes grades on demand without changing submissions. See the Teacher Gradebook guide for filters, score states and totals.
 *     parameters:
 *       - { in: path, name: classroomId, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 50 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: sort, schema: { type: string, enum: [name, earned, percentage] } }
 *       - { in: query, name: direction, schema: { type: string, enum: [asc, desc] } }
 *       - { in: query, name: challengeIds, schema: { type: string }, description: Comma-separated challenge IDs }
 *       - { in: query, name: includeRemoved, schema: { type: boolean, default: false } }
 *     responses:
 *       200: { description: Data contains columns, rows, totalStudents, page, limit, defaultChallengePoints and evaluatedAt. }
 *       403: { description: Teacher classroom access required. }
 *       404: { description: Classroom not found or gradebook disabled. }
 * /v1/admin/class/{classroomId}/gradebook/export:
 *   post:
 *     tags: [Gradebook]
 *     summary: Download gradebook or detailed scores as CSV
 *     parameters:
 *       - { in: path, name: classroomId, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               layout: { type: string, enum: [gradebook, detailed], default: gradebook }
 *               search: { type: string }
 *               challengeIds: { type: array, items: { type: string } }
 *               includeRemoved: { type: boolean, default: false }
 *               sort: { type: string, enum: [name, earned, percentage] }
 *               direction: { type: string, enum: [asc, desc] }
 *     responses:
 *       200: { description: Authenticated CSV download containing all matching students. }
 *       429: { description: Export concurrency limit reached. }
 * /v1/admin/class/{classroomId}/gradebook/settings:
 *   get:
 *     tags: [Gradebook]
 *     summary: Read the classroom default points (5 when unset)
 *     parameters:
 *       - { in: path, name: classroomId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Data contains defaultChallengePoints. }
 *   put:
 *     tags: [Gradebook]
 *     summary: Set default points for future challenges only
 *     parameters:
 *       - { in: path, name: classroomId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [defaultChallengePoints]
 *             properties:
 *               defaultChallengePoints: { type: number, minimum: 0, multipleOf: 0.01 }
 *     responses:
 *       200: { description: Default saved without changing existing challenge maxima. }
 * /v1/admin/class/{classroomId}/gradebook/challenges/{challengeId}/students/{studentId}/adjustment:
 *   put:
 *     tags: [Gradebook]
 *     summary: Assign points, excuse work, or restore automatic grading
 *     parameters:
 *       - { in: path, name: classroomId, required: true, schema: { type: string } }
 *       - { in: path, name: challengeId, required: true, schema: { type: string } }
 *       - { in: path, name: studentId, required: true, schema: { type: string }, description: SCALE member ID }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mode, reason, expectedRevision]
 *             properties:
 *               mode: { type: string, enum: [POINTS, EXCUSED, AUTOMATIC] }
 *               points: { type: number, minimum: 0, multipleOf: 0.01 }
 *               reason: { type: string, minLength: 1, maxLength: 2000 }
 *               expectedRevision: { type: integer, minimum: 0 }
 *     responses:
 *       200: { description: Adjustment saved with an atomic history entry. }
 *       409: { description: Revision conflict; refresh and review before retrying. }
 * /v1/admin/class/{classroomId}/gradebook/challenges/{challengeId}/exclusion:
 *   put:
 *     tags: [Gradebook]
 *     summary: Exclude or restore a challenge in classroom totals
 *     parameters:
 *       - { in: path, name: classroomId, required: true, schema: { type: string } }
 *       - { in: path, name: challengeId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [excluded, reason, expectedRevision]
 *             properties:
 *               excluded: { type: boolean }
 *               reason: { type: string, minLength: 1, maxLength: 2000 }
 *               expectedRevision: { type: integer, minimum: 0 }
 *     responses:
 *       200: { description: Exclusion saved; individual adjustments are retained. }
 *       409: { description: Revision conflict. }
 * /v1/admin/class/{classroomId}/gradebook/challenges/{challengeId}/students/{studentId}/history:
 *   get:
 *     tags: [Gradebook]
 *     summary: Read student adjustment history, newest first
 *     parameters:
 *       - { in: path, name: classroomId, required: true, schema: { type: string } }
 *       - { in: path, name: challengeId, required: true, schema: { type: string } }
 *       - { in: path, name: studentId, required: true, schema: { type: string } }
 *       - { in: query, name: before, schema: { type: integer, minimum: 1 } }
 *     responses:
 *       200: { description: Data contains revision, up to 100 changes, and nextBefore. }
 * /v1/admin/class/{classroomId}/gradebook/challenges/{challengeId}/history:
 *   get:
 *     tags: [Gradebook]
 *     summary: Read challenge exclusion history, newest first
 *     parameters:
 *       - { in: path, name: classroomId, required: true, schema: { type: string } }
 *       - { in: path, name: challengeId, required: true, schema: { type: string } }
 *       - { in: query, name: before, schema: { type: integer, minimum: 1 } }
 *     responses:
 *       200: { description: Data contains revision, up to 100 changes, and nextBefore. }
 */

router.use((_req, res, next) =>
  gradebookAvailable()
    ? next()
    : res.status(404).json({ error: "Gradebook is unavailable." }),
);
router.use(requireAuth(), checkRole("org:admin"));
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
router.get("/", controller.get);
router.get("/settings", controller.settings);
router.put("/settings", controller.updateSettings);
router.post("/export", controller.export);
router.put(
  "/challenges/:challengeId/students/:studentId/adjustment",
  controller.adjust,
);
router.get(
  "/challenges/:challengeId/students/:studentId/history",
  controller.history,
);
router.put("/challenges/:challengeId/exclusion", controller.exclude);
router.get("/challenges/:challengeId/history", controller.history);

module.exports = router;
