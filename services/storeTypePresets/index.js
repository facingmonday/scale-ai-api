/**
 * StoreTypePresets Service Routes
 *
 * Read-only endpoint for retrieving all store type presets.
 * Mounted (via services/index.js) under /v1
 */
const express = require("express");
const router = express.Router();

const controller = require("./storeTypePresets.controller");
const { requireMemberAuth } = require("../../middleware/auth");

// Allow any authenticated user (student/member or admin) to fetch presets.
router.get("/store/type-presets", requireMemberAuth(), controller.getStoreTypePresets);

module.exports = router;


