/**
 * Centralized Puppeteer configuration for containerized environments
 * Optimized for DigitalOcean App Platform with Docker
 */

/**
 * Get Puppeteer launch configuration optimized for containers
 * @param {Object} options - Optional configuration overrides
 * @param {number} options.timeout - Launch timeout in milliseconds (default: 60000)
 * @returns {Object} Puppeteer launch configuration
 */
function getPuppeteerConfig(options = {}) {
  const { timeout = 60000 } = options;

  const config = {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--headless",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
    ],
    timeout,
    dumpio: false,
    protocolTimeout: timeout,
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    config.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return config;
}

/**
 * Get page navigation options with extended timeout
 * @param {Object} options - Optional configuration overrides
 * @param {number} options.timeout - Navigation timeout in milliseconds (default: 30000)
 * @returns {Object} Page navigation options
 */
function getNavigationOptions(options = {}) {
  const {
    timeout = 30000,
    waitUntil = ["networkidle0", "load", "domcontentloaded"],
  } = options;
  return { waitUntil, timeout };
}

/**
 * Get PDF generation options
 * @param {Object} options - Optional PDF configuration overrides
 * @returns {Object} PDF generation options
 */
function getPdfOptions(options = {}) {
  return {
    format: options.format || "A4",
    printBackground: options.printBackground !== false,
    margin: options.margin || {
      top: "20px",
      right: "20px",
      bottom: "20px",
      left: "20px",
    },
    ...options,
  };
}

module.exports = {
  getPuppeteerConfig,
  getNavigationOptions,
  getPdfOptions,
};
