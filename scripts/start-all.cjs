"use strict";

const { spawn } = require("child_process");
const path = require("path");

const webDir = path.join(__dirname, "..", "apps", "web");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npmCli = process.env.npm_execpath;

const child = spawn(npmCli ? process.execPath : npm, npmCli ? [npmCli, "start"] : ["start"], {
  cwd: webDir,
  env: process.env,
  stdio: "inherit",
  shell: !npmCli && process.platform === "win32",
});

child.on("exit", (code) => process.exit(code || 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
