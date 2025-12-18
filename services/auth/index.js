const express = require("express");
const controller = require("./auth.controller");

const { requireAuth, checkRole } = require("../../middleware/auth");

const router = express.Router();

router.get("/me", requireAuth(), controller.me);
router.post("/active-classroom", requireAuth(), controller.setActiveClassroom);

module.exports = router;
