const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const loadLocalEnv = require("../../lib/load-local-env");

test("loadLocalEnv honors an explicit ENV_FILE", (t) => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "scale-env-loader-"),
  );
  const envPath = path.join(temporaryDirectory, ".env.custom");
  const previousEnvFile = process.env.ENV_FILE;
  const previousValue = process.env.SCALE_ENV_LOADER_TEST_VALUE;

  fs.writeFileSync(envPath, "SCALE_ENV_LOADER_TEST_VALUE=loaded\n", "utf8");
  process.env.ENV_FILE = envPath;
  delete process.env.SCALE_ENV_LOADER_TEST_VALUE;

  t.after(() => {
    if (previousEnvFile === undefined) delete process.env.ENV_FILE;
    else process.env.ENV_FILE = previousEnvFile;

    if (previousValue === undefined) delete process.env.SCALE_ENV_LOADER_TEST_VALUE;
    else process.env.SCALE_ENV_LOADER_TEST_VALUE = previousValue;

    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  loadLocalEnv();

  assert.equal(process.env.SCALE_ENV_LOADER_TEST_VALUE, "loaded");
});
