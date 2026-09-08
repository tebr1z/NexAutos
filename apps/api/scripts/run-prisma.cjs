"use strict";

process.env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = "1";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const schema = path.join(root, "prisma", "schema.prisma");
const clientJs = path.join(root, "node_modules", ".prisma", "client", "index.js");
const prismaCli = require.resolve("prisma/build/index.js");

function clientReady() {
  return fs.existsSync(clientJs);
}

function run(args, { retries = 1 } = {}) {
  let last;
  for (let i = 1; i <= retries; i++) {
    last = spawnSync(process.execPath, [prismaCli, ...args, `--schema=${schema}`], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    if (last.status === 0) return last;
    console.warn(`prisma ${args[0]} failed (attempt ${i}/${retries})`);
    if (i < retries) {
      spawnSync(process.execPath, ["-e", "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,4000)"], {
        stdio: "ignore",
      });
    }
  }
  return last;
}

function generate() {
  const result = run(["generate"], { retries: 3 });
  if (result.status === 0) return 0;
  if (clientReady()) {
    console.warn("prisma generate could not reach binaries.prisma.sh; using the client already in node_modules.");
    return 0;
  }
  return result.status ?? 1;
}

function migrate() {
  return run(["migrate", "deploy"]).status ?? 1;
}

const cmd = process.argv[2] || "generate";
let code = 1;
if (cmd === "generate") code = generate();
else if (cmd === "migrate") code = migrate();
else if (cmd === "boot") {
  code = generate();
  if (code === 0) code = migrate();
} else {
  console.error("Usage: node scripts/run-prisma.cjs generate|migrate|boot");
  code = 1;
}
process.exit(code);
