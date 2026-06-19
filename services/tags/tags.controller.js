const TagsModel = require("./tags.model");
const FileModel = require("../files/files.model");
const slugify = require("slugify");

exports.get = async function (req, res, next) {
  try {
    const classroomId = req.activeClassroom._id;
    const tags = await TagsModel.find({ classroomId })
      .sort({ title: 1 })
      .lean();

    res.status(200).json({ success: true, data: tags });
  } catch (error) {
    console.error("Error getting tags:", error);
    res.status(500).json({ error: "Error getting tags" });
  }
};

exports.create = async function (req, res) {
  try {
    const classroomId = req.activeClassroom._id;
    const { title, description, color, type } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Tag title is required" });
    }

    const slug = slugify(title, { lower: true, strict: true });

    const existingTag = await TagsModel.findOne({ classroomId, slug });
    if (existingTag) {
      return res.status(400).json({ error: "Tag with this name already exists in this classroom" });
    }

    const newTag = new TagsModel({
      title,
      slug,
      description,
      color: color || "#808080",
      type: type || "tag",
      classroomId,
      organization: req.organization?._id,
      createdBy: req.clerkUser.id,
      updatedBy: req.clerkUser.id,
    });

    await newTag.save();
    res.status(201).json({ success: true, data: newTag });
  } catch (error) {
    console.error("Error creating tag:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.remove = async function (req, res) {
  try {
    const { id } = req.params;
    const classroomId = req.activeClassroom._id;

    if (req.classroomRole !== "admin") {
      return res.status(403).json({ error: "Only instructors can delete tags" });
    }

    const tag = await TagsModel.findOneAndDelete({
      _id: id,
      classroomId,
    });

    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    // Cascade remove tag reference from Files
    await FileModel.updateMany({ tags: id }, { $pull: { tags: id } });

    res.status(200).json({ success: true, message: "Tag removed successfully" });
  } catch (error) {
    console.error("Error removing tag:", error);
    res.status(500).json({ error: error.message });
  }
};
