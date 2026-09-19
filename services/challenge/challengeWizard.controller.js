const mongoose = require("mongoose");
const Classroom = require("../classroom/classroom.model");
const service = require("./lib/challengeWizardService");

function handler(action) {
  return async (req, res) => {
    const abort = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) abort.abort();
    };
    res.on("close", onClose);
    try {
      const { classroomId } = req.body || {};
      if (
        typeof classroomId !== "string" ||
        !mongoose.isValidObjectId(classroomId)
      )
        return res
          .status(400)
          .json({ error: "A valid classroomId is required" });
      const organizationId = req.organization._id;
      const clerkUserId = req.clerkUser.id;
      const classroom = await Classroom.validateAdminAccess(
        classroomId,
        clerkUserId,
        organizationId,
      );
      const data = await service[action](
        { classroom, classroomId, organizationId, clerkUserId },
        req.body,
        abort.signal,
      );
      if (action === "create") {
        const AutomationTask = require("../ai/automationTask.model");
        AutomationTask.trigger("AFTER_CHALLENGE_CREATED", {
          classroomId,
          challengeId: data._id,
          organizationId,
          clerkUserId,
        }).catch((error) =>
          console.error(
            "Error triggering AFTER_CHALLENGE_CREATED tasks:",
            error,
          ),
        );
      }
      if (!res.destroyed)
        res
          .status(action === "create" ? 201 : 200)
          .json({ success: true, data });
    } catch (error) {
      if (abort.signal.aborted || res.destroyed) return;
      const status =
        error.statusCode ||
        (error.message === "Class not found"
          ? 404
          : error.message.includes("Insufficient permissions")
            ? 403
            : ["ValidationError", "CastError"].includes(error.name)
              ? 400
              : 500);
      res
        .status(status)
        .json({
          error:
            status === 500
              ? "Unable to complete the wizard request. Please try again."
              : error.message,
          code: error.code,
          proposal: error.proposal,
        });
    } finally {
      res.off("close", onClose);
    }
  };
}
module.exports = {
  suggestions: handler("suggestions"),
  schedule: handler("getSchedule"),
  create: handler("create"),
};
