const React = require("react");
const { render } = require("@react-email/render");
const path = require("path");
// Register esbuild at runtime to support requiring .jsx files
try {
  // eslint-disable-next-line global-require
  require("esbuild-register/dist/node").register({
    extensions: [".jsx", ".tsx"],
    target: "es2019",
  });
} catch (e) {
  // If esbuild-register is not available, we rely on plain CJS require
}

function loadComponent(templateSlug) {
  let templateModule;

  // In dev/preview, bust require cache so changes to templates are reflected
  // when the browser reloads. This targets only files within the templates dir.
  try {
    const templatesDir = path.join(__dirname, "templates") + path.sep;
    Object.keys(require.cache).forEach((cacheKey) => {
      if (cacheKey.startsWith(templatesDir)) {
        delete require.cache[cacheKey];
      }
    });
  } catch (_) {
    // Best-effort cache busting; ignore if anything goes wrong
  }

  switch (templateSlug) {
    case "scenario-created":
      templateModule = require("./templates/ScenarioCreatedEmail.jsx");
      return templateModule.ScenarioCreatedEmail || templateModule;
    default:
      throw new Error(`React Email template not found for id: ${templateSlug}`);
  }
}

async function renderReactEmail(templateSlug, props = {}) {
  const Component = loadComponent(templateSlug);
  const element = React.createElement(Component, props);

  const html = await render(element, { pretty: true });
  const text = await render(element, { plainText: true });

  return { html, text };
}

module.exports = {
  renderReactEmail,
};
