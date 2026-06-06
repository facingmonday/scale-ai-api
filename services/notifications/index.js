/**
 * Notifications Service Routes
 * 
 * Provides endpoints for managing notifications.
 * All routes require org:admin role.
 * Mounted at: /v1/notifications
 */
const express = require("express");
const controller = require("./notifications.controller");
const { upload } = require("../../lib/spaces");

const router = express.Router();
const { requireAuth, checkRole } = require("../../middleware/auth");

/**
 * @openapi
 * /v1/notifications:
 *   get:
 *     summary: Get notifications
 *     description: Fetch notifications history. Requires org:admin role.
 *     tags:
 *       - Notifications
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications.
 */
router.get("/", requireAuth(), checkRole("org:admin"), controller.get);

/**
 * @openapi
 * /v1/notifications/web:
 *   get:
 *     summary: Get web notifications
 *     description: Fetch web UI specific notifications list. Requires org:admin role.
 *     tags:
 *       - Notifications
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Web notifications list.
 */
router.get(
  "/web",
  requireAuth(),
  checkRole("org:admin"),
  controller.getWebNotifications
);

/**
 * @openapi
 * /v1/notifications/unread-count:
 *   get:
 *     summary: Get unread count
 *     description: Retrieve the total count of unread web notifications. Requires org:admin role.
 *     tags:
 *       - Notifications
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count object.
 */
router.get(
  "/unread-count",
  requireAuth(),
  checkRole("org:admin"),
  controller.getUnreadCount
);

/**
 * @openapi
 * /v1/notifications:
 *   post:
 *     summary: Create custom notification
 *     description: Trigger/create a custom notification delivery. Requires org:admin role.
 *     tags:
 *       - Notifications
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Notification created.
 */
router.post("/", requireAuth(), checkRole("org:admin"), controller.create);

// Update all notifications status (Read, Deleted, etc.)
/**
 * @openapi
 * /v1/notifications/status:
 *   put:
 *     summary: Mark all notifications read
 *     description: Update status of all web notifications (e.g. read, deleted). Requires org:admin role.
 *     tags:
 *       - Notifications
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Updated successfully.
 */
router.put(
  "/status",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateAllWebNotificationsStatus
);

// Update a single notification status (Read, Deleted, etc.)
/**
 * @openapi
 * /v1/notifications/{id}:
 *   put:
 *     summary: Update single notification status
 *     description: Update status for a specific notification by ID. Requires org:admin role.
 *     tags:
 *       - Notifications
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification updated.
 */
router.put(
  "/:id",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateNotificationStatus
);

module.exports = router;
