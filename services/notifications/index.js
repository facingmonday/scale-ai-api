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

router.get("/", requireAuth(), checkRole("org:admin"), controller.get);
router.get(
  "/web",
  requireAuth(),
  checkRole("org:admin"),
  controller.getWebNotifications
);
router.get(
  "/unread-count",
  requireAuth(),
  checkRole("org:admin"),
  controller.getUnreadCount
);
router.post("/", requireAuth(), checkRole("org:admin"), controller.create);
// Update all notifications status (Read, Deleted, etc.)
router.put(
  "/status",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateAllWebNotificationsStatus
);
// Update a single notification status (Read, Deleted, etc.)
router.put(
  "/:id",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateNotificationStatus
);

module.exports = router;
