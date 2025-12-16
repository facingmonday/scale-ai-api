const { getUsersRoutes } = require("../../lib/routes");

exports.me = async function (req, res, next) {
  try {
    const routes = getUsersRoutes(req.user.permissions);

    res.status(200).json({
      routes,
      organization: req.organization,
    });
  } catch (error) {
    next(error);
  }
};
