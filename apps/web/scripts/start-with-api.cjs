"use strict";

const { spawn } = require("child_process");
const net = require("net");
const path = require("path");

const root = path.join(__dirname, "..");
const apiDir = path.join(root, "api");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

const publicPort = String(process.env.PORT || 3000);
const apiPort = String(
  process.env.API_PORT && process.env.API_PORT !== publicPort ? process.env.API_PORT : 4000,
);
const apiHost = process.env.API_HOST || "127.0.0.1";

function waitForPort(host, port, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host, port: Number(port) }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`API did not listen on ${host}:${port} within ${timeoutMs}ms`));
          return;
        }
        setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

const children = [];

function shutdown(code) {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  process.exit(code);
}

function spawnChild(cmd, args, cwd, extraEnv, useShell) {
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: Boolean(useShell),
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal === "SIGTERM") return;
    shutdown(code || 1);
  });
  return child;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`Starting Nest API on ${apiHost}:${apiPort} and Next.js on 0.0.0.0:${publicPort}`);

spawnChild(npm, ["start"], apiDir, {
  PORT: apiPort,
  API_PORT: apiPort,
  API_HOST: apiHost,
  CORS_ORIGIN: process.env.CORS_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || "https://nex.autos",
}, process.platform === "win32");

waitForPort(apiHost, apiPort, 180000)
  .then(() => {
    spawnChild(process.execPath, [nextBin, "start", "--port", publicPort, "--hostname", "0.0.0.0"], root, {
      PORT: publicPort,
      HOSTNAME: "0.0.0.0",
      NEXT_PUBLIC_API_URL: "/api/v1",
      INTERNAL_API_URL: `http://${apiHost}:${apiPort}/api/v1`,
      API_PROXY_URL: `http://${apiHost}:${apiPort}/api/v1`,
    }, false);
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    shutdown(1);
  });
