const express = require("express");
const controller = require("./auth.controller");

const { requireAuth, checkRole } = require('../../middleware/auth');

const router = express.Router();

router.get("/me", requireAuth(), checkRole('org:admin'), controller.me);

module.exports = router;