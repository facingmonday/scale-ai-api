const express = require("express");
const path = require("path");
const fs = require("fs");
const livereload = require("livereload");

// Support .jsx in node for email components
try {
  require("esbuild-register/dist/node").register({
    extensions: [".jsx", ".tsx"],
    target: "es2019",
  });
} catch (_) {}

const { renderReactEmail } = require("../../lib/emails/reactRenderer");

const app = express();
const PORT = process.env.EMAIL_PREVIEW_PORT || 4001;

// Live reload server watching email templates and fixtures
// This is best-effort: if the port is already taken (common in dev), we
// disable livereload rather than crashing the preview server.
let livereloadEnabled = process.env.EMAIL_PREVIEW_LIVERELOAD !== "false";
const livereloadPort = Number(
  process.env.EMAIL_PREVIEW_LIVERELOAD_PORT || 35729
);

if (livereloadEnabled) {
  const lrserver = livereload.createServer({
    exts: ["js", "jsx", "tsx", "json"],
    delay: 200,
    port: livereloadPort,
    noListen: true,
  });

  lrserver.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      console.warn(
        `⚠️  Livereload port ${livereloadPort} is already in use; continuing without livereload.`
      );
      livereloadEnabled = false;
      return;
    }
    console.warn("⚠️  Livereload error; continuing without livereload:", err);
    livereloadEnabled = false;
  });

  lrserver.listen(() => {
    // Only watch if we successfully started listening.
    lrserver.watch(path.join(__dirname, "../../lib/emails/templates"));
    lrserver.watch(path.join(__dirname, "./fixtures"));
  });
}

// Known template slugs (mirror of lib/emails/reactRenderer mapping)
const templateSlugs = ["scenario-created", "scenario-closed"];

// Load fixture if exists
function loadFixture(slug) {
  const fixturePath = path.join(__dirname, "fixtures", `${slug}.json`);
  if (fs.existsSync(fixturePath)) {
    try {
      const raw = fs.readFileSync(fixturePath, "utf-8");
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`Failed to read fixture for ${slug}:`, e.message);
    }
  }
  return {};
}

function page(html) {
  const livereloadScript = livereloadEnabled
    ? `<script src="http://localhost:${livereloadPort}/livereload.js?snipver=1"></script>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Email Preview</title></head><body style="margin:0;padding:0;">${html}${livereloadScript}</body></html>`;
}

app.get("/", (req, res) => {
  const links = templateSlugs
    .map(
      (slug) =>
        `<li><a href="/preview/${slug}">${slug}</a> — <a href="/raw/${slug}">raw</a> — <a href="/text/${slug}">text</a></li>`
    )
    .join("");
  const html = `<div style="padding:20px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><h1>Email Templates</h1><ul>${links}</ul></div>`;
  res.send(page(html));
});

app.get("/preview/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!templateSlugs.includes(slug))
    return res.status(404).send("Unknown template slug");
  const data = loadFixture(slug);
  try {
    const { html } = await renderReactEmail(slug, data);
    res.send(page(html));
  } catch (e) {
    res.status(500).send(`<pre>${(e && e.stack) || e}</pre>`);
  }
});

app.get("/raw/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!templateSlugs.includes(slug))
    return res.status(404).send("Unknown template slug");
  const data = loadFixture(slug);
  try {
    const { html } = await renderReactEmail(slug, data);
    res.type("html").send(html);
  } catch (e) {
    res.status(500).send((e && e.stack) || String(e));
  }
});

app.get("/text/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!templateSlugs.includes(slug))
    return res.status(404).send("Unknown template slug");
  const data = loadFixture(slug);
  try {
    const { text } = await renderReactEmail(slug, data);
    res.type("text").send(text || "(no text version)");
  } catch (e) {
    res.status(500).send((e && e.stack) || String(e));
  }
});

app.listen(PORT, () => {
  console.log(`📧 Email preview running at http://localhost:${PORT}`);
});
