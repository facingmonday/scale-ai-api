const Member = require("../../members/member.model");

/**
 * Get current member profile and associated devices
 * Uses authentication middleware to get current user from req.user
 */
module.exports = async function (req, res) {
  try {
    // Get the current member from authentication middleware
    const member = await Member.findById(req.user._id);

    if (!member) {
      return res.status(404).json({
        error: "Member not found",
      });
    }

    // Combine member data with devices
    const response = {
      ...member.toObject(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error getting member profile:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
