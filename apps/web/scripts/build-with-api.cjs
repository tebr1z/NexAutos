"use strict";

const fs = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const apiDir = path.join(root, "api");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=1536",
  NEXT_PUBLIC_API_URL: "/api/v1",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://nex.autos",
  NEXT_TELEMETRY_DISABLED: "1",
};

function run(cwd, args, cmd = npm) {
  console.log(`\n[build] ${path.relative(root, cwd) || "."} > ${cmd} ${args.join(" ")}\n`);
  const result = spawnSync(cmd, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32" && cmd === npm,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function rm(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

if (!fs.existsSync(path.join(apiDir, "node_modules"))) {
  run(apiDir, ["ci", "--omit=dev", "--no-audit", "--no-fund"]);
}
run(apiDir, ["run", "build"]);
run(root, ["--max-old-space-size=1536", path.join(root, "node_modules", "next", "dist", "bin", "next"), "build", "--webpack"], process.execPath);

rm(path.join(root, ".next", "cache"));
rm(path.join(root, ".next", "standalone"));
rm(path.join(apiDir, "node_modules", ".cache"));
console.log("Pruned .next/cache so the Docker layer can commit before SSH timeout.");
