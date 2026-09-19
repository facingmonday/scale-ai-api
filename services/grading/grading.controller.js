const mongoose = require("mongoose");
const { once } = require("node:events");
const Classroom = require("../classroom/classroom.model");
const {
  gradebookAvailable,
  defaultPoints,
  validatePoints,
} = require("../../lib/gradingSettings");
const service = require("./grading.service");
const { prepareExport } = require("./grading.csv");

const activeExports = new Set();

async function authorize(req) {
  if (!gradebookAvailable())
    throw service.fail("Gradebook is unavailable.", 404);
  const { classroomId } = req.params;
  const organizationId = req.organization?._id;
  if (
    !mongoose.isObjectIdOrHexString(classroomId) ||
    !mongoose.isObjectIdOrHexString(organizationId)
  )
    throw service.fail("A valid classroom ID is required.");
  const actor = req.clerkUser.id;
  const classroom = await Classroom.validateAdminAccess(
    classroomId,
    actor,
    organizationId,
  );
  return { classroomId, organizationId, actor, classroom };
}

function handleError(res, error) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  const status =
    error.statusCode ||
    (error.message === "Class not found"
      ? 404
      : error.message?.includes("Insufficient permissions")
        ? 403
        : ["ValidationError", "CastError"].includes(error.name)
          ? 400
          : 500);
  if (status >= 500)
    console.error("Gradebook request failed", {
      name: error.name,
      code: error.code,
    });
  res
    .status(status)
    .json({
      error:
        status >= 500
          ? "Gradebook is temporarily unavailable. Please try again."
          : error.message,
    });
}

function handler(action) {
  return async (req, res) => {
    try {
      const context = await authorize(req);
      const data = await action(req, context);
      res.json({ data });
    } catch (error) {
      handleError(res, error);
    }
  };
}

exports.get = handler((req, context) =>
  service.getGradebook({
    ...context,
    filters: service.parseFilters(req.query),
  }),
);
exports.adjust = handler((req, context) =>
  service.saveChange(
    {
      ...context,
      challengeId: req.params.challengeId,
      userId: req.params.studentId,
    },
    req.body || {},
  ),
);
exports.exclude = handler((req, context) =>
  service.saveChange(
    { ...context, challengeId: req.params.challengeId },
    req.body || {},
    "exclusion",
  ),
);
exports.history = handler((req, context) =>
  service.history(
    {
      ...context,
      challengeId: req.params.challengeId,
      userId: req.params.studentId,
      before:
        req.query.before === undefined ? undefined : Number(req.query.before),
    },
    req.params.studentId ? "adjustment" : "exclusion",
  ),
);
exports.settings = handler((_req, context) => ({
  defaultChallengePoints: defaultPoints(context.classroom),
}));
exports.updateSettings = handler(async (req, context) => {
  const points = validatePoints(
    req.body?.defaultChallengePoints,
    "defaultChallengePoints",
  );
  await Classroom.updateOne(
    { _id: context.classroomId, organization: context.organizationId },
    {
      $set: {
        "gradingSettings.defaultChallengePoints": points,
        updatedBy: context.actor,
      },
    },
    { runValidators: true, maxTimeMS: service.QUERY_MS },
  );
  return { defaultChallengePoints: points };
});

exports.export = async (req, res) => {
  const abort = new AbortController();
  const onClose = () => abort.abort();
  let exportKey;
  let timeout;
  try {
    const context = await authorize(req);
    const key = `${context.organizationId}:${context.actor}`;
    // Bound export work per API process; no worker queue or connection pool changes.
    if (activeExports.size >= 2 || activeExports.has(key))
      throw service.fail(
        "An export is already running. Please try again shortly.",
        429,
      );
    activeExports.add(key);
    exportKey = key;
    res.on("close", onClose);
    timeout = setTimeout(() => {
      abort.abort();
      res.destroy();
    }, 30000);
    const result = await prepareExport(
      {
        ...context,
        filters: service.parseFilters(req.body || {}),
        signal: abort.signal,
        deadline: Date.now() + 30000,
      },
      req.body?.layout || "gradebook",
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="gradebook-${context.classroomId}-${result.evaluatedAt.slice(0, 10)}.csv"`,
    );
    for await (const chunk of result.chunks) {
      if (abort.signal.aborted) break;
      if (!res.write(chunk)) await once(res, "drain", { signal: abort.signal });
    }
    if (!abort.signal.aborted) res.end();
  } catch (error) {
    if (!abort.signal.aborted) handleError(res, error);
  } finally {
    clearTimeout(timeout);
    if (exportKey) activeExports.delete(exportKey);
    res.off("close", onClose);
  }
};
