const mongoose = require("mongoose");
const FolderModel = require("./folders.model");
const FileModel = require("../files/files.model");
const { getAccumulatedFilters } = require("../../lib/utils");

exports.get = async function (req, res, next) {
  try {
    console.log("Getting folders");
    const organizationId = req.organization._id;
    console.log("Organization ID:", organizationId);
    let page = parseInt(req.query.page) || 0;
    page = page + 1;

    let pageSize = parseInt(req.query.pageSize) || 20;
    let skip = (page - 1) * pageSize;

    let sortField = "createdDate";
    let sortDirection = "asc";
    if (req.query.sort) {
      const sortFieldKey = Object.keys(req.query.sort)[0];
      if (sortFieldKey) {
        sortField = sortFieldKey;
        sortDirection = req.query.sort[sortFieldKey];
      }
    }

    const searchParamsArray = Array.isArray(req.query.query)
      ? req.query.query
      : [];

    const filter = searchParamsArray.length
      ? searchParamsArray
          .filter((param) => schemaFields.includes(param.field))
          .reduce((acc, param) => ({ ...getAccumulatedFilters(acc, param) }), {
            organization: organizationId,
          })
      : { organization: organizationId };

    const paginationStages = [
      { $sort: { [sortField]: sortDirection === "asc" ? 1 : -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ];

    let aggregateStages = [
      {
        $lookup: {
          from: "files",
          let: { folderId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$folder", "$$folderId"] }],
                },
              },
            },
          ],
          as: "files",
        },
      },
      {
        $addFields: {
          files: {
            $sortArray: {
              input: "$files",
              sortBy: { createdDate: -1 },
            },
          },
          fileCount: { $size: "$files" },
        },
      },
    ];

    if (searchParamsArray.length > 0) {
      searchParamsArray
        .filter((param) => param.field.includes("."))
        .forEach((param) => {
          const [field, subField] = param.field.split(".");
          const matchStage = {
            $match: {
              [`${field}.${subField}`]:
                subField === "_id"
                  ? new mongoose.Types.ObjectId(param.value)
                  : new RegExp(param.value, "i"),
            },
          };
          aggregateStages.push(matchStage);
        });
    }

    const folders = await FolderModel.aggregate([
      { $match: filter },
      ...aggregateStages,
      {
        $addFields: {
          id: "$_id",
        },
      },
      ...paginationStages,
    ]);

    const totalFolders = await FolderModel.aggregate([
      { $match: filter },
      ...aggregateStages,
      { $count: "total" },
    ]);
    const total = totalFolders.length > 0 ? totalFolders[0].total : 0;

    res.status(200).json({
      page,
      limit: pageSize,
      search: filter,
      total,
      sortField,
      sortDirection,
      data: folders,
    });
  } catch (error) {
    console.error("Error getting folders:", error);
    res.status(500).send("Error getting folders");
  }
};

exports.show = async function (req, res, next) {
  try {
    console.log("Getting folder");
    const organizationId = req.organization._id;

    const { id } = req.params;

    const folder = await FolderModel.findOne({
      _id: id,
      organization: organizationId,
    });

    if (!folder) {
      return res.status(404).send("Folder not found");
    }

    const response = {
      ...folder.toJSON(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error getting folder:", error);
    res.status(500).send("Error getting folder");
  }
};

exports.create = async function (req, res) {
  try {
    const organizationId = req.organization._id;

    const folder = req.body;
    folder.organization = organizationId;

    if (!folder.name) {
      return res.status(400).send("Invalid folder");
    }

    const newFolder = await FolderModel.create({
      ...folder,
      organization: organizationId,
      createdBy: req.user.id,
      updatedBy: req.user.id,
      path: folder.path,
    });
    res.status(201).json(newFolder);
  } catch (error) {
    console.error("Error adding folder:", error);
    res.status(500).send("Error adding folder");
  }
};

exports.update = async function (req, res) {
  try {
    const organizationId = req.organization._id;

    const { id } = req.params;
    const folder = req.body;

    const updatedFolder = await FolderModel.findOneAndUpdate(
      { _id: id, organization: organizationId },
      folder,
      {
        new: true,
      }
    );

    if (!updatedFolder) {
      return res.status(404).send("Folder not found or not authorized");
    }

    res.status(200).json(updatedFolder);
  } catch (error) {
    console.error("Error updating folder:", error);
    res.status(500).send("Error updating folder");
  }
};

exports.destroy = async function (req, res) {
  try {
    const organizationId = req.organization._id;

    const { id } = req.params;

    const folder = await FolderModel.findOneAndDelete({
      _id: id,
      organization: organizationId,
    });

    if (!folder) {
      return res.status(404).send("Folder not found or not authorized");
    }

    // Remove the folder id from any File documents' folders array
    await FileModel.updateMany({ folders: id }, { $pull: { folders: id } });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting location:", error);
    res.status(500).send("Error deleting location");
  }
};

exports.upload = async function (req, res) {
  try {
    const imageUrl = req.file.location;
    res.json({ imageUrl });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: "Error uploading image" });
  }
};
