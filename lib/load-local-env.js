const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const projectRoot = path.resolve(__dirname, "..");

/**
 * Load environment variables for processes started from a local checkout.
 * Hosted environments inject variables through DigitalOcean and do not ship
 * any of these ignored files.
 */
function loadLocalEnv() {
  const candidates = process.env.ENV_FILE
    ? [path.resolve(projectRoot, process.env.ENV_FILE)]
    : [
        path.join(projectRoot, ".env.local"),
        path.join(projectRoot, ".env"),
      ];

  const envPath = candidates.find((candidate) => fs.existsSync(candidate));
  return envPath ? dotenv.config({ path: envPath }) : dotenv.config();
}

module.exports = loadLocalEnv;
