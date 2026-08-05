#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  buildAppSpec,
  getEnvironmentConfig,
  PROJECT_ID,
} from "../.do/app-spec.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const environment = process.argv[2];
const apply = process.argv.includes("--apply");
const schemaOnly = process.argv.includes("--schema-only");

if (!environment || !["dev", "prod"].includes(environment)) {
  console.error("Usage: node scripts/deploy-do-app.mjs <dev|prod> [--apply]");
  process.exit(2);
}

const config = getEnvironmentConfig(environment);
const envPath = path.join(root, config.envFile);
if (!fs.existsSync(envPath)) {
  console.error(`Missing ignored deployment environment file: ${envPath}`);
  process.exit(2);
}

const parsed = dotenv.parse(fs.readFileSync(envPath));
const spec = buildAppSpec(environment, parsed);
const payload = `${JSON.stringify(spec, null, 2)}\n`;

function runDoctl(args, { showStdout = true } = {}) {
  const result = spawnSync("doctl", args, {
    cwd: root,
    input: payload,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (showStdout && result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runDoctl([
  "apps",
  "spec",
  "validate",
  ...(schemaOnly ? ["--schema-only"] : []),
  "-",
], { showStdout: false });
console.log(`Validated ${config.appName} using ${config.envFile}.`);

if (!apply) {
  console.log("Validation only; pass --apply to create or update the app.");
  process.exit(0);
}

runDoctl([
  "apps",
  "create",
  "--spec",
  "-",
  "--upsert",
  "--update-sources",
  "--wait",
  "--project-id",
  PROJECT_ID,
  "--format",
  "ID,Spec.Name,DefaultIngress,ActiveDeployment.ID,Updated",
]);
