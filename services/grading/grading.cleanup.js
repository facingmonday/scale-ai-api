// Cleanup is called only after a parent was successfully deleted. Its failure
// must never change the result of the original classroom/challenge operation.
async function cleanup(scope) {
  const { GradeAdjustment, GradeExclusion } = require("./grading.model");
  await Promise.all(
    [GradeAdjustment, GradeExclusion].map((Model) =>
      Model.deleteMany(scope).maxTimeMS(5000),
    ),
  );
}

function afterDeletion(scope) {
  setImmediate(() =>
    cleanup(scope).catch((error) => {
      console.error("Grading cleanup needs repair", {
        name: error.name,
        code: error.code,
      });
    }),
  );
}

module.exports = { cleanup, afterDeletion };
