"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const env = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=4096",
  NEXT_PUBLIC_API_URL: "/api/v1",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://nex.autos",
};

function run(cwd, args) {
  console.log(`\n[build] ${path.relative(root, cwd) || "."} > ${npm} ${args.join(" ")}\n`);
  const result = spawnSync(npm, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

run(path.join(root, "apps", "api"), ["ci"]);
run(path.join(root, "apps", "api"), ["run", "build"]);
run(path.join(root, "apps", "web"), ["ci"]);
run(path.join(root, "apps", "web"), ["run", "build"]);
