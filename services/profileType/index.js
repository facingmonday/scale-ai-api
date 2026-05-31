/**
 * ProfileType Service Routes
 *
 * Provides endpoints for managing profile types.
 * Profile types are organization-specific and define default variable values for profile types.
 * Admin routes require org:admin role.
 * Mounted at: /v1/admin/profile-types
 */
const express = require("express");
const controller = require("./profileType.controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Student routes - require authenticated member
router.get(
  "/student/profile-types",
  requireMemberAuth(),
  controller.getStoreTypesForStudent
);

// Admin routes - require org:admin role
router.post(
  "/admin/profile-types",
  requireAuth(),
  checkRole("org:admin"),
  controller.createStoreType
);

router.put(
  "/admin/profile-types/:storeTypeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.updateStoreType
);

router.get(
  "/admin/profile-types",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStoreTypes
);

router.get(
  "/admin/profile-types/:storeTypeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.getStoreType
);

router.delete(
  "/admin/profile-types/:storeTypeId",
  requireAuth(),
  checkRole("org:admin"),
  controller.deleteStoreType
);

module.exports = router;
