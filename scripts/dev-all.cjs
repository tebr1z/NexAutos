"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const webDir = path.join(root, "apps", "web");
const apiDir = path.join(webDir, "api");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npmCli = process.env.npm_execpath;

function loadRootEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;

    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadRootEnv();

const webPort = String(process.env.PORT || 5001);
const apiPort = String(
  process.env.API_PORT && process.env.API_PORT !== webPort ? process.env.API_PORT : 5002,
);
const apiHost = process.env.API_HOST || "127.0.0.1";
const browserHost = apiHost === "0.0.0.0" ? "127.0.0.1" : apiHost;
const webOrigin = `http://localhost:${webPort}`;
const apiBase = `http://${browserHost}:${apiPort}/api/v1`;
const existingCors = process.env.CORS_ORIGIN?.trim();
const corsOrigin = existingCors ? `${webOrigin},${existingCors}` : webOrigin;
const lanHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((address) => address && address.family === "IPv4" && !address.internal)
  .map((address) => address.address);
const allowedDevOrigins = [...new Set(["localhost", "127.0.0.1", ...lanHosts])];

const children = [];
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // The process has already stopped.
    }
  }
  process.exit(code);
}

function run(label, args, cwd, extraEnv) {
  const command = npmCli ? process.execPath : npm;
  const commandArgs = npmCli ? [npmCli, ...args] : args;
  const child = spawn(command, commandArgs, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: !npmCli && process.platform === "win32",
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (stopping || signal === "SIGTERM") return;
    console.error(`${label} stopped${code == null ? "" : ` with exit code ${code}`}.`);
    stop(code || 1);
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

console.log(`Starting Auto Nex web at ${webOrigin}`);
console.log(`Starting Auto Nex API at ${apiBase}`);
if (lanHosts.length) console.log(`LAN access allowed at http://${lanHosts[0]}:${webPort}`);

run("API", ["run", "start:dev"], apiDir, {
  API_PORT: apiPort,
  API_HOST: apiHost,
  CORS_ORIGIN: corsOrigin,
});

run("Web", ["run", "dev", "--", "--port", webPort], webDir, {
  NEXT_PUBLIC_API_URL: "/api/v1",
  INTERNAL_API_URL: apiBase,
  API_PROXY_URL: apiBase,
  NEXT_ALLOWED_DEV_ORIGINS: allowedDevOrigins.join(","),
});
