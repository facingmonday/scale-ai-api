const { STORE_TYPE_PRESETS } = require("../store/storeTypePresets");

/**
 * Get all store type presets (Plan/Source/Make/Deliver defaults, constraints, etc.)
 * GET /v1/store/type-presets
 */
exports.getStoreTypePresets = async function getStoreTypePresets(req, res) {
  try {
    return res.json({
      success: true,
      data: {
        storeTypes: Object.keys(STORE_TYPE_PRESETS),
        presets: STORE_TYPE_PRESETS,
      },
    });
  } catch (error) {
    console.error("Error getting store type presets:", error);
    return res.status(500).json({ error: error.message });
  }
};


