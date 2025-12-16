const NotificationModel = require("./notifications.model");
const mongoose = require("mongoose");

exports.get = async function (req, res, next) {
  try {
    const { limit = 10, offset = 0, status, sort, type } = req.query;
    let { query } = req.query;

    const mongooseQuery = { recipient: req.user.id };

    // Handle status filter if provided
    if (status) {
      mongooseQuery.status = status;
    }

    // Handle type filter if provided
    if (type) {
      mongooseQuery.type = type;
    }

    // Handle dynamic query parameters
    if (query) {
      // Ensure query is an array
      if (!Array.isArray(query)) {
        query = [query];
      }

      query.forEach((q) => {
        const { field, value, operator } = q;

        if (field && value && operator) {
          switch (operator.toLowerCase()) {
            case "eq":
              mongooseQuery[field] = value;
              break;
            case "ne":
              mongooseQuery[field] = { $ne: value };
              break;
            case "gt":
              mongooseQuery[field] = { ...mongooseQuery[field], $gt: value };
              break;
            case "gte":
              mongooseQuery[field] = { ...mongooseQuery[field], $gte: value };
              break;
            case "lt":
              mongooseQuery[field] = { ...mongooseQuery[field], $lt: value };
              break;
            case "lte":
              mongooseQuery[field] = { ...mongooseQuery[field], $lte: value };
              break;
            case "in":
              mongooseQuery[field] = {
                $in: Array.isArray(value) ? value : [value],
              };
              break;
            case "nin":
              mongooseQuery[field] = {
                $nin: Array.isArray(value) ? value : [value],
              };
              break;
            case "regex":
              mongooseQuery[field] = { $regex: value, $options: "i" }; // Case-insensitive
              break;
            default:
              // Handle unknown operators or throw an error
              break;
          }
        }
      });
    }

    // Handle sorting
    let sortOptions = { createdDate: -1 }; // Default sort
    if (sort) {
      sortOptions = {};
      Object.entries(sort).forEach(([key, value]) => {
        sortOptions[key] = value.toLowerCase() === "asc" ? 1 : -1;
      });
    }

    const [notifications, total] = await Promise.all([
      NotificationModel.find(mongooseQuery)
        .sort(sortOptions)
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .populate("metadata.booking")
        .populate("metadata.event")
        .populate("metadata.artist"),
      NotificationModel.countDocuments(mongooseQuery),
    ]);

    return res.json({
      data: notifications,
      total,
      offset: parseInt(offset),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Generic function to update a single notification status
exports.updateNotificationStatus = async function (req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const organizationId = req.organization._id;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const notification = await NotificationModel.findOneAndUpdate(
      { _id: id, "recipient.id": req.user.id, organization: organizationId },
      { status },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(notification);
  } catch (error) {
    next(error);
  }
};

// Generic function to update all notifications status
exports.updateAllWebNotificationsStatus = async function (req, res, next) {
  try {
    const { fromStatus, toStatus } = req.body;
    const organizationId = req.organization._id;

    if (!fromStatus || !toStatus) {
      console.log("Missing fromStatus or toStatus:", { fromStatus, toStatus });
      return res
        .status(400)
        .json({ error: "fromStatus and toStatus are required" });
    }

    let query = {
      "recipient.id": req.user._id,
      organization: organizationId,
      type: "web",
      status: fromStatus,
    };

    const result = await NotificationModel.updateMany(query, {
      status: toStatus,
    });

    res.status(200).json({
      message: `All ${fromStatus.toLowerCase()} notifications marked as ${toStatus.toLowerCase()}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

exports.create = async function (req, res, next) {
  try {
    const notification = new NotificationModel({
      ...req.body,
      sender: req.user.id,
    });

    console.log(notification);

    await notification.save();

    const populatedNotification = await NotificationModel.findById(
      notification._id
    )
      .populate("sender")
      .populate("metadata.booking")
      .populate("metadata.event")
      .populate("metadata.artist");

    res.status(201).json(populatedNotification);
  } catch (error) {
    next(error);
  }
};

// Get web notifications specifically
exports.getWebNotifications = async function (req, res, next) {
  try {
    const { limit = 10, offset = 0, status, sort } = req.query;
    const organizationId = req.organization._id;

    const mongooseQuery = {
      "recipient.id": req.user.id,
      organization: organizationId,
      type: "web",
    };

    // Handle status filter if provided
    if (status && status !== "all") {
      mongooseQuery.status = status;
    } else if (status === "all") {
      // For "all" tab, exclude deleted notifications
      mongooseQuery.status = { $ne: "Deleted" };
    }

    // Handle sorting
    let sortOptions = { createdDate: -1 }; // Default sort
    if (sort) {
      sortOptions = {};
      Object.entries(sort).forEach(([key, value]) => {
        sortOptions[key] = value.toLowerCase() === "asc" ? 1 : -1;
      });
    }

    const [notifications, total] = await Promise.all([
      NotificationModel.find(mongooseQuery)
        .sort(sortOptions)
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .populate("sender")
        .populate("modelData.order")
        .populate("modelData.member")
        .populate("modelData.event"),
      NotificationModel.countDocuments(mongooseQuery),
    ]);

    return res.json({
      data: notifications,
      total,
      offset: parseInt(offset),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Get unread notification count
exports.getUnreadCount = async function (req, res, next) {
  try {
    const organizationId = req.organization._id;
    const { type = "web" } = req.query;

    const mongooseQuery = {
      "recipient.id": req.user.id,
      type: "web",
      organization: organizationId,
      status: { $nin: ["Read", "Deleted"] },
    };

    // Handle type filter if provided
    if (type) {
      mongooseQuery.type = type;
    }

    const count = await NotificationModel.countDocuments(mongooseQuery);

    return res.json({
      count,
      type: type || "all",
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Helper function to create notifications (to be used by other services)
exports.createNotification = async function (notificationData) {
  try {
    const notification = new NotificationModel(notificationData);

    return await notification.save();
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};
