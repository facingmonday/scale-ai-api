const { renderReactEmail } = require("./reactRenderer");

/**
 * Universal renderer for both emails and PDFs using React Email components
 * This is the single source of truth for all template rendering
 *
 * @param {string} templateSlug - Template slug (e.g., 'ticket-template', 'order-created')
 * @param {object} props - Data to pass to the React component
 * @param {object} options - Rendering options
 * @returns {Promise<{html: string, text: string}>}
 */
async function renderTemplate(templateSlug, props = {}, options = {}) {
  // Ensure env variables are always available
  const propsWithEnv = {
    ...props,
    env: {
      SCALE_ADMIN_HOST: process.env.SCALE_ADMIN_HOST,
      ...props.env,
    },
  };

  try {
    const rendered = await renderReactEmail(templateSlug, propsWithEnv);
    return rendered;
  } catch (error) {
    console.error(`Failed to render template ${templateSlug}:`, error);
    throw new Error(
      `Template rendering failed for ${templateSlug}: ${error.message}`
    );
  }
}

module.exports = { renderTemplate };
