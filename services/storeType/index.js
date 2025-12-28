/**
 * StoreType Service Routes
 *
 * Provides endpoints for managing store types (presets).
 * Store types are organization-specific and define default variable values for store types.
 * Admin routes require org:admin role.
 * Mounted at: /v1/admin/store-types
 */
const express = require("express");
const controller = require("./storeType.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Student routes - require authenticated member
router.get(
  "/student/store-types",
  requireMemberAuth(),
  controller.getStoreTypesForStudent
);

// Admin routes - require org:admin role
router.post(
  "/admin/store-types",
  requireAuth(),
  checkRole("org:admin"),
  controller.createStoreType
);

router.put(
  "/admin/store-types/:storeTypeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateStoreType
);

router.get(
  "/admin/store-types",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStoreTypes
);

router.get(
  "/admin/store-types/:storeTypeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStoreType
);

router.delete(
  "/admin/store-types/:storeTypeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteStoreType
);

router.post(
  "/admin/store-types/seed",
  requireAuth(),
  checkRole("org:admin"),
  controller.seedDefaultStoreTypes
);

module.exports = router;
