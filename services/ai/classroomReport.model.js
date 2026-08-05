const mongoose = require("mongoose");
const { FileSchema } = require("../files/files.model");

// Re-register the FileSchema under the "ClassroomReport" model name but bound to the "files" collection
module.exports = mongoose.models.ClassroomReport || mongoose.model("ClassroomReport", FileSchema, "files");
