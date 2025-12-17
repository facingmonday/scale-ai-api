const { getUsersRoutes } = require("../../lib/routes");

exports.me = async function (req, res, next) {
  try {
    const routes = getUsersRoutes({
      activeClassroom: req.activeClassroom,
    });

    res.status(200).json({
      routes,
      organization: req.organization,
    });
  } catch (error) {
    next(error);
  }
};
