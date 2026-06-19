const express = require("express");
const controller = require("./files.controller");
const router = express.Router();
const { requireAuth, requireActiveClassroom } = require("../../middleware/auth");
const { upload } = require("../../lib/spaces");

router.get("/", requireAuth(), requireActiveClassroom(), controller.get);
router.post(
  "/upload",
  requireAuth(),
  requireActiveClassroom(),
  upload("vault").single("file"),
  controller.uploadFile
);
router.put("/:id", requireAuth(), requireActiveClassroom(), controller.update);
router.delete("/:id", requireAuth(), requireActiveClassroom(), controller.remove);

module.exports = router;
