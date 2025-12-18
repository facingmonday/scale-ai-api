const { getUsersRoutes } = require("../../lib/routes");

exports.me = async function (req, res, next) {
  try {
    // Get user's role in the active organization using existing helper method
    const membership = req.user.getOrganizationMembership(req.organization);

    if (!membership) {
      return res.status(403).json({
        error: "User membership does not exist for this organization",
      });
    }

    const routes = getUsersRoutes({
      activeClassroom: req.activeClassroom,
      role: membership.role,
    });

    res.status(200).json({
      routes,
      organization: req.organization,
    });
  } catch (error) {
    next(error);
  }
};
