"use strict";

process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = "1";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const schema = path.join(root, "prisma", "schema.prisma");
const clientJs = path.join(root, "node_modules", ".prisma", "client", "index.js");
const prismaCli = require.resolve("prisma/build/index.js");
const enginesDir = path.join(root, "node_modules", "@prisma", "engines");
const muslQuery = path.join(enginesDir, "libquery_engine-linux-musl-openssl-3.0.x.so.node");
const muslSchema = path.join(enginesDir, "schema-engine-linux-musl-openssl-3.0.x");

if (fs.existsSync(muslQuery)) process.env.PRISMA_QUERY_ENGINE_LIBRARY = muslQuery;
if (fs.existsSync(muslSchema)) process.env.PRISMA_SCHEMA_ENGINE_BINARY = muslSchema;

function clientReady() {
  return fs.existsSync(clientJs);
}

function run(args) {
  return spawnSync(process.execPath, [prismaCli, ...args, `--schema=${schema}`], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

function generate() {
  const result = run(["generate"]);
  if (result.status === 0 || clientReady()) return 0;
  console.warn("prisma generate skipped (offline engines or CDN blocked).");
  return 0;
}

function migrate() {
  const result = run(["migrate", "deploy"]);
  if (result.status === 0) return 0;
  console.warn("prisma migrate deploy skipped.");
  return 0;
}

const cmd = process.argv[2] || "generate";
if (cmd === "generate") generate();
else if (cmd === "migrate") migrate();
else if (cmd === "boot") {
  generate();
  migrate();
} else {
  console.error("Usage: node scripts/run-prisma.cjs generate|migrate|boot");
  process.exit(1);
}
