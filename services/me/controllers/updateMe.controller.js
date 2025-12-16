const { clerkClient } = require("@clerk/express");

module.exports = async function (req, res) {
  try {
    // Mirror prior behavior: validate current user exists in Clerk and return success
    try {
      await clerkClient.users.getUser(req.clerkUser.id);
    } catch (error) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully (no-op; managed by Clerk)",
      userId: req.clerkUser.id,
    });
  } catch (error) {
    console.error("Error updating current member:", error);
    res.status(500).json({ error: "Error updating current member" });
  }
};
