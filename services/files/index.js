const express = require("express");
const filesController = require("./files.controller");
const { upload } = require("../../lib/spaces");
const { requireAuth, checkRole } = require("../../middleware/auth");

const router = express.Router();

router.post(
  "/createFromUrl",
  requireAuth(),
  checkRole("org:admin"),
  filesController.createFromUrl
);
router.post(
  "/upload",
  requireAuth(),
  checkRole("org:admin"),
  upload("files").single("file"),
  filesController.uploadFile
);
router.get("/", requireAuth(), checkRole("org:admin"), filesController.get);
router.put(
  "/:id",
  requireAuth(),
  checkRole("org:admin"),
  filesController.update
);
router.delete(
  "/:id",
  requireAuth(),
  checkRole("org:admin"),
  filesController.remove
);
module.exports = router;
