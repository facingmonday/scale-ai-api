const express = require("express");
const controller = require("./folders.controller");
const router = express.Router();

const { requireAuth, checkRole } = require("../../middleware/auth");

router.get("/", requireAuth(), checkRole("org:admin"), controller.get);
router.get("/:id", requireAuth(), checkRole("org:admin"), controller.show);
router.post("/", requireAuth(), checkRole("org:admin"), controller.create);
router.put("/:id", requireAuth(), checkRole("org:admin"), controller.update);
router.patch("/:id", requireAuth(), checkRole("org:admin"), controller.update);
router.delete(
  "/:id",
  requireAuth(),
  checkRole("org:admin"),
  controller.destroy
);

module.exports = router;
