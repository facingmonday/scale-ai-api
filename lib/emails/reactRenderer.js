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
    case "event-invitation":
      templateModule = require("./templates/EventInvitationEmail.jsx");
      return templateModule.EventInvitationEmail || templateModule;
    case "order-created":
      templateModule = require("./templates/OrderCreatedEmail.jsx");
      return templateModule.OrderCreatedEmail || templateModule;
    case "tickets-generated":
      templateModule = require("./templates/TicketsGeneratedEmail.jsx");
      return templateModule.TicketsGeneratedEmail || templateModule;
    case "order-cancelled":
      templateModule = require("./templates/OrderCancelledEmail.jsx");
      return templateModule.OrderCancelledEmail || templateModule;
    case "ticket-reminder":
      templateModule = require("./templates/TicketReminderEmail.jsx");
      return templateModule.TicketReminderEmail || templateModule;
    case "ticket-template":
      templateModule = require("./templates/TicketTemplateEmail.jsx");
      return templateModule.TicketTemplateEmail || templateModule;
    case "share-template":
      templateModule = require("./templates/ShareTemplateEmail.jsx");
      return templateModule.ShareTemplateEmail || templateModule;
    case "ticket-claimed":
      templateModule = require("./templates/TicketClaimedEmail.jsx");
      return templateModule.TicketClaimedEmail || templateModule;
    case "daily-stats":
      templateModule = require("./templates/DailyStatsEmail.jsx");
      return templateModule.DailyStatsEmail || templateModule;
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
