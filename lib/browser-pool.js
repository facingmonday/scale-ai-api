/**
 * Simple Puppeteer browser pool
 * - Keeps exactly one warm browser instance running
 * - Recycles the browser only after 60 seconds of idle time (no open pages)
 * - Cancels recycling if new pages are created during the delay
 * - Designed for stability in queue workers and PDF generation
 */

const puppeteer = require("puppeteer");
const { getPuppeteerConfig } = require("./puppeteer-config");

let browserInstance = null;
let launchingPromise = null;
let recyclingPromise = null;
let recycleTimeout = null;
const IDLE_RECYCLE_DELAY = 60000; // 60 seconds of idle time before recycling

async function getActualPageCount() {
  if (!browserInstance || !browserInstance.isConnected()) return 0;
  try {
    const pages = await browserInstance.pages();
    return pages ? pages.length : 0;
  } catch {
    return 0;
  }
}

async function ensureLaunched() {
  if (browserInstance && browserInstance.isConnected()) return browserInstance;
  if (launchingPromise) return launchingPromise;

  launchingPromise = (async () => {
    try {
      console.log("🚀 Launching warm Puppeteer browser instance...");
      const browser = await puppeteer.launch(getPuppeteerConfig());
      browser.on("disconnected", () => {
        console.log("🔌 Puppeteer browser disconnected");
        browserInstance = null;
        // Cancel any pending recycle
        if (recycleTimeout) {
          clearTimeout(recycleTimeout);
          recycleTimeout = null;
        }
        // Auto-relaunch to keep a warm instance available
        ensureLaunched().catch((e) =>
          console.error("Failed to relaunch Puppeteer after disconnect:", e)
        );
      });
      browserInstance = browser;
      return browserInstance;
    } finally {
      launchingPromise = null;
    }
  })();

  return launchingPromise;
}

async function getBrowserInstance() {
  return ensureLaunched();
}

function scheduleRecycleIfIdle() {
  // Don't schedule if already scheduled or recycling
  if (recycleTimeout || recyclingPromise) return;

  // Schedule recycling after idle delay
  recycleTimeout = setTimeout(async () => {
    recycleTimeout = null;

    if (recyclingPromise) return; // Already recycling

    recyclingPromise = (async () => {
      try {
        // Check if browser is still connected and has no pages
        if (!browserInstance || !browserInstance.isConnected()) {
          return; // Browser already disconnected or doesn't exist
        }

        // Check actual browser page count
        const pageCount = await getActualPageCount();
        if (pageCount > 0) {
          console.log(`⚠️  Browser has ${pageCount} pages, canceling recycle`);
          return; // Browser still has pages, don't recycle
        }

        // All checks passed - safe to recycle
        try {
          await browserInstance.close();
          console.log("♻️  Recycled Puppeteer browser after idle period");
        } catch (err) {
          console.error("Error closing Puppeteer during recycle:", err.message);
        }
        browserInstance = null;
        // Relaunch immediately to keep a warm browser
        await ensureLaunched();
      } finally {
        recyclingPromise = null;
      }
    })();
  }, IDLE_RECYCLE_DELAY);

  console.log(
    `⏰ Scheduled browser recycle in ${IDLE_RECYCLE_DELAY / 1000}s if idle`
  );
}

async function createPage(retries = 3) {
  let lastError;

  // Cancel any pending recycle since we're creating a page
  if (recycleTimeout) {
    clearTimeout(recycleTimeout);
    recycleTimeout = null;
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    let browser;
    let page;

    try {
      browser = await ensureLaunched();

      // Check if browser is still connected before creating page
      if (!browser.isConnected()) {
        console.warn("Browser disconnected, relaunching...");
        browser = await ensureLaunched();
      }

      page = await browser.newPage();

      // Ensure page is fully initialized before returning
      // Navigate to about:blank to ensure main frame is ready
      await page.goto("about:blank", {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });

      // Verify main frame is available by accessing it
      // This ensures the page is fully ready before use
      const mainFrame = page.mainFrame();
      if (!mainFrame) {
        throw new Error("Main frame not available after navigation");
      }

      // Small delay to ensure frame is fully initialized
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Success - set up close handler to check for recycling
      page.once("close", () => {
        scheduleRecycleIfIdle();
      });

      return { browser, page };
    } catch (error) {
      lastError = error;

      // If initialization fails, close the page and try again
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          // Ignore close errors
        }
      }

      // If this was the last attempt, throw the error
      if (attempt === retries - 1) {
        console.error(
          `Failed to initialize page after ${retries} attempts:`,
          error.message
        );
        throw new Error(
          `Failed to initialize page after ${retries} attempts: ${error.message}`
        );
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.warn(
        `Page initialization failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));

      // If browser was disconnected, force a relaunch
      if (browser && !browser.isConnected()) {
        browserInstance = null;
        await ensureLaunched();
      }
    }
  }

  // This should never be reached, but just in case
  throw lastError || new Error("Failed to create page");
}

async function closePage(page) {
  if (!page) return;

  try {
    // Check if page is already closed or browser is disconnected
    if (page.isClosed()) return;

    // Check if browser is still connected
    const browser = page.browser();
    if (!browser || !browser.isConnected()) return;

    await page.close();
    // The page.once("close") handler will call scheduleRecycleIfIdle()
  } catch (err) {
    // Ignore errors about target not found or already closed
    if (
      err.message &&
      (err.message.includes("No target with given id") ||
        err.message.includes("Target closed") ||
        err.message.includes("Session closed"))
    ) {
      return;
    }
    console.error("Error closing Puppeteer page:", err.message);
  }
}

async function shutdown() {
  try {
    // Cancel any pending recycle
    if (recycleTimeout) {
      clearTimeout(recycleTimeout);
      recycleTimeout = null;
    }

    if (browserInstance && browserInstance.isConnected()) {
      await browserInstance.close();
      console.log("✅ Puppeteer browser pool shut down");
    }
  } catch (err) {
    console.error("Error shutting down browser pool:", err.message);
  } finally {
    browserInstance = null;
    launchingPromise = null;
    recyclingPromise = null;
    recycleTimeout = null;
  }
}

// Keep one warm instance at module load
ensureLaunched().catch((e) =>
  console.error("Initial Puppeteer launch failed:", e.message)
);

module.exports = { getBrowserInstance, createPage, closePage, shutdown };
