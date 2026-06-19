const FolderModel = require("./folders.model");
const FileModel = require("../files/files.model");

exports.get = async function (req, res, next) {
  try {
    const classroomId = req.activeClassroom._id;
    const folders = await FolderModel.find({ classroomId })
      .sort({ name: 1 })
      .lean();

    res.status(200).json({ success: true, data: folders });
  } catch (error) {
    console.error("Error getting folders:", error);
    res.status(500).json({ error: "Error getting folders" });
  }
};

exports.create = async function (req, res) {
  try {
    const classroomId = req.activeClassroom._id;
    const { name, description, parent, path, type } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    const newFolder = new FolderModel({
      name,
      description,
      parent: parent || null,
      path: path || name,
      type: type || "file",
      classroomId,
      organization: req.organization?._id,
      createdBy: req.clerkUser.id,
      updatedBy: req.clerkUser.id,
    });

    await newFolder.save();
    res.status(201).json({ success: true, data: newFolder });
  } catch (error) {
    console.error("Error creating folder:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.remove = async function (req, res) {
  try {
    const { id } = req.params;
    const classroomId = req.activeClassroom._id;

    if (req.classroomRole !== "admin") {
      return res.status(403).json({ error: "Only instructors can delete folders" });
    }

    const folder = await FolderModel.findOneAndDelete({
      _id: id,
      classroomId,
    });

    if (!folder) {
      return res.status(404).json({ error: "Folder not found" });
    }

    // Set folder references in Files to null
    await FileModel.updateMany({ folder: id }, { $set: { folder: null } });

    res.status(200).json({ success: true, message: "Folder removed successfully" });
  } catch (error) {
    console.error("Error removing folder:", error);
    res.status(500).json({ error: error.message });
  }
};
