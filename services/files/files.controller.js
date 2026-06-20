const FileModel = require("./files.model");
const { deleteFile } = require("../../lib/spaces");

exports.get = async function (req, res, next) {
  try {
    const classroomId = req.activeClassroom._id;
    const query = {
      $or: [
        { classroomId },
        { classroomId: null, organization: req.organization?._id }
      ]
    };

    // Apply visibility filter based on student/teacher role
    if (req.classroomRole !== "admin") {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { visibility: "everyone" },
          { visibility: "student", userId: req.user._id },
          { createdBy: req.clerkUser.id },
        ],
      });
    }

    // Apply optional query filters (tag, folder, search text)
    const { tag, folder, search } = req.query;
    if (tag && tag !== "all") {
      query.tags = tag;
    }
    if (folder) {
      if (folder === "root") {
        query.folder = null;
      } else {
        query.folder = folder;
      }
    }
    if (search && search.trim() !== "") {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$and = query.$and || [];
      query.$and.push({
        $or: [{ title: searchRegex }, { name: searchRegex }],
      });
    }

    const files = await FileModel.find(query)
      .populate("tags")
      .populate("folder")
      .populate("userId", "firstName lastName")
      .sort({ createdDate: -1 })
      .lean();

    res.status(200).json({ success: true, data: files });
  } catch (error) {
    console.error("Error getting files:", error);
    res.status(500).json({ error: "Error getting files" });
  }
};

exports.uploadFile = async function (req, res) {
  try {
    const classroomId = req.activeClassroom._id;
    const { title, tags, visibility, userId, folder, targetLevel } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }

    const getFileType = (mimetype) => {
      if (mimetype.startsWith("image/")) return "image";
      if (mimetype.startsWith("video/")) return "video";
      if (mimetype.startsWith("audio/")) return "audio";
      if (
        mimetype.startsWith("application/pdf") ||
        mimetype.startsWith("application/msword") ||
        mimetype.startsWith("application/vnd.openxmlformats-officedocument")
      )
        return "document";
      return "other";
    };

    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch (e) {
        parsedTags = String(tags)
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }

    const file = new FileModel({
      name: req.file.originalname,
      title: title || req.file.originalname,
      type: getFileType(req.file.mimetype),
      url: req.file.location,
      mimeType: req.file.mimetype,
      fileSize: req.file.size || 0,
      bucket: req.fileData?.bucket || req.file.bucket || process.env.SPACES_BUCKET,
      key: req.fileData?.key || req.file.key,
      folder: targetLevel === "organization" ? null : (folder && folder !== "root" ? folder : null),
      tags: targetLevel === "organization" ? [] : parsedTags,
      visibility: visibility || "everyone",
      userId: visibility === "student" && userId ? userId : null,
      classroomId: targetLevel === "organization" ? null : classroomId,
      organization: req.organization?._id,
      createdBy: req.clerkUser.id,
      updatedBy: req.clerkUser.id,
    });

    await file.save();
    res.status(201).json({ success: true, data: file });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.update = async function (req, res) {
  try {
    const { id } = req.params;
    const classroomId = req.activeClassroom._id;
    const { title, tags, visibility, userId, folder } = req.body;

    const file = await FileModel.findOne({ _id: id, classroomId });
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (title !== undefined) file.title = title;
    if (folder !== undefined) {
      file.folder = folder && folder !== "root" ? folder : null;
    }
    if (tags !== undefined) {
      try {
        file.tags = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch (e) {
        file.tags = String(tags)
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }
    if (visibility !== undefined) {
      file.visibility = visibility;
      file.userId = visibility === "student" && userId ? userId : null;
    }
    file.updatedBy = req.clerkUser.id;
    file.updatedDate = new Date();

    await file.save();
    res.status(200).json({ success: true, data: file });
  } catch (error) {
    console.error("Error updating file:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.remove = async function (req, res) {
  try {
    const { id } = req.params;
    const classroomId = req.activeClassroom._id;
    const file = await FileModel.findOne({ _id: id, classroomId });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Permission check: only admin or creator
    const isTeacher = req.classroomRole === "admin";
    const isCreator = file.createdBy === req.clerkUser.id;

    if (!isTeacher && !isCreator) {
      return res.status(403).json({ error: "Unauthorized to delete this file" });
    }

    if (file.key) {
      try {
        const bucket = file.bucket || process.env.SPACES_BUCKET;
        await deleteFile(bucket, file.key);
      } catch (err) {
        console.warn("Failed to delete physical file from spaces:", err.message);
      }
    }

    await FileModel.deleteOne({ _id: id });
    res.status(200).json({ success: true, message: "File removed successfully" });
  } catch (error) {
    console.error("Error removing file:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.copy = async function (req, res) {
  try {
    const { id } = req.params;
    const { targetClassroomId } = req.body;
    const sourceClassroomId = req.activeClassroom._id;

    if (!targetClassroomId) {
      return res.status(400).json({ error: "targetClassroomId is required" });
    }

    // Find source file (allow classroom files or org files from the same organization)
    const file = await FileModel.findOne({
      _id: id,
      $or: [
        { classroomId: sourceClassroomId },
        { classroomId: null, organization: req.organization?._id }
      ]
    });

    if (!file) {
      return res.status(404).json({ error: "Source file not found" });
    }

    // Validate that target classroom exists and user has admin permissions
    const ClassroomModel = require("../classroom/classroom.model");
    try {
      await ClassroomModel.validateAdminAccess(
        targetClassroomId,
        req.clerkUser.id,
        req.organization?._id
      );
    } catch (err) {
      return res.status(403).json({ error: "Unauthorized access to target classroom" });
    }

    // Duplicate file document to target classroom (place at root, clear tags)
    const newFile = new FileModel({
      name: file.name,
      title: file.title,
      type: file.type,
      url: file.url,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      bucket: file.bucket,
      key: file.key,
      folder: null,
      tags: [],
      visibility: file.visibility === "student" ? "teachers" : file.visibility,
      userId: null,
      classroomId: targetClassroomId,
      organization: req.organization?._id,
      createdBy: req.clerkUser.id,
      updatedBy: req.clerkUser.id,
    });

    await newFile.save();
    res.status(201).json({ success: true, data: newFile });
  } catch (error) {
    console.error("Error copying file:", error);
    res.status(500).json({ error: error.message });
  }
};