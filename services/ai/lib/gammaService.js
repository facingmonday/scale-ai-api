const GAMMA_API_BASE = "https://public-api.gamma.app/v1.0";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 36; // ~3 minutes

class GammaService {
  /**
   * Create a Gamma presentation generation job
   * @param {string} inputText - The text content to generate from
   * @param {Object} options - Generation options
   * @param {string} [options.title] - Custom title for the presentation
   * @param {number} [options.numCards] - Target number of slides
   * @param {string} [options.themeId] - Override theme ID (defaults to env var)
   * @returns {Promise<{generationId: string}>}
   */
  static async generatePresentation(inputText, options = {}) {
    const apiKey = process.env.GAMMA_API_KEY;
    if (!apiKey) {
      throw new Error("GAMMA_API_KEY is not configured");
    }

    const body = {
      inputText,
      textMode: "generate",
      format: "presentation",
      exportAs: "pptx",
    };

    // Apply theme from options or environment
    const themeId = options.themeId || process.env.GAMMA_THEME_ID;
    if (themeId) {
      body.themeId = themeId;
    }

    if (options.title) {
      body.title = options.title;
    }

    if (options.numCards) {
      body.numCards = options.numCards;
    }

    console.log(`🎨 Gamma: Starting presentation generation...`);

    const response = await fetch(`${GAMMA_API_BASE}/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gamma API generation request failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    console.log(`🎨 Gamma: Generation started — ID: ${data.generationId}`);

    if (data.warnings) {
      console.warn(`🎨 Gamma warnings: ${data.warnings}`);
    }

    return data;
  }

  /**
   * Poll a generation job until it completes or fails
   * @param {string} generationId - The generation ID to poll
   * @returns {Promise<{generationId: string, status: string, gammaId: string, gammaUrl: string, exportUrl: string, credits: {deducted: number, remaining: number}}>}
   */
  static async pollUntilComplete(generationId) {
    const apiKey = process.env.GAMMA_API_KEY;
    if (!apiKey) {
      throw new Error("GAMMA_API_KEY is not configured");
    }

    console.log(`🎨 Gamma: Polling generation ${generationId}...`);

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
        method: "GET",
        headers: {
          "X-API-KEY": apiKey,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gamma API poll request failed (${response.status}): ${errorBody}`);
      }

      const data = await response.json();

      if (data.status === "completed") {
        console.log(`🎨 Gamma: Generation completed! Credits used: ${data.credits?.deducted}, remaining: ${data.credits?.remaining}`);
        return data;
      }

      if (data.status === "failed") {
        const errorMsg = data.error?.message || "Unknown error";
        throw new Error(`Gamma generation failed: ${errorMsg}`);
      }

      // Still pending — wait and retry
      console.log(`🎨 Gamma: Still generating (attempt ${attempt}/${MAX_POLL_ATTEMPTS})...`);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error(`Gamma generation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s for generation ${generationId}`);
  }

  /**
   * Generate a presentation and wait for completion
   * @param {string} inputText - The text content to generate from
   * @param {Object} options - Generation options (see generatePresentation)
   * @returns {Promise<{generationId: string, gammaUrl: string, exportUrl: string, gammaId: string, credits: {deducted: number, remaining: number}}>}
   */
  static async generateAndExport(inputText, options = {}) {
    const { generationId } = await this.generatePresentation(inputText, options);
    const result = await this.pollUntilComplete(generationId);

    return {
      generationId: result.generationId,
      gammaId: result.gammaId,
      gammaUrl: result.gammaUrl,
      exportUrl: result.exportUrl,
      credits: result.credits,
    };
  }
}

module.exports = GammaService;
