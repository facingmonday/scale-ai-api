const express = require("express");
const controller = require("./folders.controller");
const router = express.Router();
const { requireAuth, requireActiveClassroom } = require("../../middleware/auth");

const requireTeacher = (req, res, next) => {
  if (req.classroomRole !== "admin") {
    return res.status(403).json({ error: "Only instructors are authorized" });
  }
  next();
};

router.get("/", requireAuth(), requireActiveClassroom(), controller.get);
router.post("/", requireAuth(), requireActiveClassroom(), requireTeacher, controller.create);
router.delete("/:id", requireAuth(), requireActiveClassroom(), requireTeacher, controller.remove);

module.exports = router;
