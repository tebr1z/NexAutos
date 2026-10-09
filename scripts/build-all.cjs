"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const webDir = path.join(root, "apps", "web");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npmCli = process.env.npm_execpath;
const env = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=4096",
  NEXT_PUBLIC_API_URL: "/api/v1",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://nex.autos",
};

function run(cwd, args) {
  console.log(`\n[build] ${path.relative(root, cwd) || "."} > ${npm} ${args.join(" ")}\n`);
  const result = spawnSync(npmCli ? process.execPath : npm, npmCli ? [npmCli, ...args] : args, {
    cwd,
    env,
    stdio: "inherit",
    shell: !npmCli && process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

run(webDir, ["ci"]);
run(webDir, ["run", "build"]);
