const axios = require("axios");
const AWS = require("aws-sdk");
const FileModel = require("./files.model");
const { buildMongoQuery } = require("../../lib/utils");
const { deleteFile } = require("../../lib/spaces");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const spacesEndpoint = new AWS.Endpoint("nyc3.digitaloceanspaces.com");
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_API_KEY,
  secretAccessKey: process.env.SPACES_API_SECRET,
});

/**
 * Get appropriate file extension from mime type
 * @param {string} mimeType - The mime type of the file
 * @returns {string} The file extension including the dot (e.g., '.jpg')
 */
function getExtensionFromMimeType(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    case "image/bmp":
      return ".bmp";
    case "image/tiff":
      return ".tiff";
    case "video/mp4":
      return ".mp4";
    case "video/webm":
      return ".webm";
    case "audio/mpeg":
      return ".mp3";
    case "audio/wav":
      return ".wav";
    case "audio/ogg":
      return ".ogg";
    case "application/pdf":
      return ".pdf";
    case "application/msword":
      return ".doc";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return ".docx";
    case "application/vnd.ms-excel":
      return ".xls";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return ".xlsx";
    default:
      // For generic types, use basic extensions
      if (mimeType.startsWith("image/")) {
        return ".jpg";
      }
      if (mimeType.startsWith("video/")) {
        return ".mp4";
      }
      if (mimeType.startsWith("audio/")) {
        return ".mp3";
      }
      // Default fallback
      return ".dat";
  }
}

/**
 * Ensure filename has an appropriate extension based on mime type
 * @param {string} filename - The original filename
 * @param {string} mimeType - The mime type of the file
 * @returns {string} Filename with appropriate extension
 */
function ensureFileExtension(filename, mimeType) {
  // Get the extension from the filename
  const ext = path.extname(filename);
  // If no extension or extension doesn't match mime type, add appropriate extension
  if (!ext) {
    return `${filename}${getExtensionFromMimeType(mimeType)}`;
  }
  return filename;
}

exports.get = async function (req, res, next) {
  try {
    const {
      page = 0,
      pageSize = 10,
      sort = { start: "desc" },
      includeDrafts = false,
      query: searchParamsArray = [],
    } = req.query;

    const organizationId = req.organization._id;

    // Build the query and get aggregation stages
    const { aggregateStages } = buildMongoQuery(searchParamsArray, FileModel);

    const pageNum = parseInt(page) + 1;
    const size = parseInt(pageSize);
    const skip = (pageNum - 1) * size;
    const sortField = Object.keys(sort)[0] || "createdDate";
    const sortDirection = sort[sortField] || "desc";

    const pipeline = [
      { $match: { organization: organizationId } },
      ...aggregateStages,
      { $sort: { [sortField]: sortDirection === "desc" ? -1 : 1 } },
      { $skip: skip },
      { $limit: size },
    ];

    const countPipeline = [
      { $match: { organization: organizationId } },
      ...aggregateStages,
      { $count: "total" },
    ];

    const [files, totalFiles] = await Promise.all([
      FileModel.aggregate(pipeline),
      FileModel.aggregate(countPipeline),
    ]);

    const total = totalFiles.length > 0 ? totalFiles[0].total : 0;

    res.status(200).json({
      page: pageNum,
      limit: size,
      search: searchParamsArray,
      total,
      sortField,
      sortDirection,
      data: files,
    });
  } catch (error) {
    console.error("Error getting files:", error);
    res.status(500).send("Error getting files");
  }
};

exports.createFromUrl = async function (req, res) {
  try {
    const folderId = req.body.folderId;
    // Set the responseType to 'arraybuffer' to handle binary data correctly
    const fileSource = await axios.get(req.body.url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
      },
    });
    const type = fileSource.headers["content-type"];
    const organizationId = req.organization._id;

    let fileName = uuidv4();
    // Ensure the filename has an appropriate extension
    fileName = ensureFileExtension(fileName, type);

    const uploadParams = {
      Bucket: process.env.SPACES_BUCKET,
      Key: `${organizationId}/${fileName}`,
      Body: fileSource.data,
      ContentType: type,
      ACL: "public-read",
    };
    const uploadResponse = await s3.upload(uploadParams).promise();
    const fileUrl = uploadResponse.Location;

    const newFile = new FileModel({
      url: fileUrl,
      name: req.body.name || fileName,
      organization: organizationId,
      type: type,
      createdBy: req.user.id,
      updatedBy: req.user.id,
      folder: folderId,
      bucket: process.env.SPACES_BUCKET,
      key: `${organizationId}/${fileName}`,
    });
    const savedFile = await newFile.save();
    res.json(savedFile);
  } catch (error) {
    console.error("Error creating file from url:", error);
    res.status(500).json({
      message: error.message,
      error: error,
    });
  }
};

exports.uploadFile = async function (req, res) {
  try {
    const fileUrl = req.file.location;
    const organizationId = req.organization._id;

    // Determine file type from mimetype
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

    // Check if the key needs an extension
    let fileKey = req.fileData.key;
    if (req.file.mimetype && !path.extname(fileKey)) {
      // Add extension based on mimetype
      const extension = getExtensionFromMimeType(req.file.mimetype);
      fileKey = `${fileKey}${extension}`;

      // Update the file in S3 with the new key if needed
      if (fileKey !== req.fileData.key) {
        try {
          await s3
            .copyObject({
              Bucket: req.fileData.bucket,
              CopySource: `${req.fileData.bucket}/${req.fileData.key}`,
              Key: fileKey,
              ACL: "public-read",
              ContentType: req.file.mimetype,
            })
            .promise();

          // Delete the original object
          await s3
            .deleteObject({
              Bucket: req.fileData.bucket,
              Key: req.fileData.key,
            })
            .promise();

          // Update URL with the new filename
          const urlParts = fileUrl.split("/");
          urlParts[urlParts.length - 1] = path.basename(fileKey);
          const updatedFileUrl = urlParts.join("/");

          req.file.location = updatedFileUrl;
          req.fileData.key = fileKey;
        } catch (error) {
          console.error("Error updating file extension in S3:", error);
          // Continue with original key if there's an error
          fileKey = req.fileData.key;
        }
      }
    }

    // Create and save new file document
    const newFile = new FileModel({
      ...req.file,
      url: req.file.location.startsWith("https://")
        ? req.file.location
        : `https://${req.file.location}`,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      type: getFileType(req.file.mimetype),
      createdDate: new Date(),
      updatedDate: new Date(),
      folder: req.body.folder,
      createdBy: req.user.id,
      updatedBy: req.user.id,
      organization: organizationId,
      width: req.file.width,
      height: req.file.height,
      html_attributions: req.file.html_attributions,
      photo_reference: req.file.photo_reference,
      bucket: req.fileData.bucket,
      key: req.fileData.key,
    });
    const savedFile = await newFile.save();
    res.json(savedFile);
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Error uploading file" });
  }
};

exports.update = async function (req, res) {
  try {
    const organizationId = req.organization._id;

    const { id } = req.params;
    const file = req.body;

    const fileUpdate = await FileModel.findOneAndUpdate(
      { _id: id, organization: organizationId },
      file,
      { new: true }
    );

    if (!fileUpdate) {
      return res.status(404).send("File not found or not authorized");
    }
    res.status(200).json(fileUpdate);
  } catch (error) {
    console.error("Error updating file:", error);
    res.status(500).send("Error updating file");
  }
};

exports.remove = async function (req, res) {
  try {
    const { id } = req.params;
    const file = await FileModel.findById(id);

    if (!file) {
      return res.status(404).send("File not found");
    }

    // Delete from S3
    try {
      if (file.bucket && file.key) {
        await deleteFile(file.bucket, file.key);
      }
    } catch (error) {
      console.error("Error deleting file from S3:", error);
    }

    // Delete from database
    await FileModel.deleteOne({ _id: id });
    res.status(200).send("File removed");
  } catch (error) {
    console.error("Error removing file:", error);
    res.status(500).send("Error removing file");
  }
};
