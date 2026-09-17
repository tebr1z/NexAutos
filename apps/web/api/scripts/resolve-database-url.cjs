"use strict";

const fs = require("fs");
const { execSync, spawnSync } = require("child_process");

function inContainer() {
  return fs.existsSync("/.dockerenv") || fs.existsSync("/run/.containerenv");
}

function detectGateway() {
  try {
    const out = execSync("ip route show default", { encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] });
    const match = out.match(/default via (\S+)/);
    if (match) return match[1];
  } catch {
    /* not linux, or no ip */
  }
  return null;
}

function tcpOk(host, port, timeoutMs) {
  const script = `
    const net = require("net");
    const s = net.connect({ host: ${JSON.stringify(host)}, port: ${Number(port)} }, () => process.exit(0));
    s.setTimeout(${Number(timeoutMs)}, () => process.exit(1));
    s.on("error", () => process.exit(1));
  `;
  const result = spawnSync(process.execPath, ["-e", script], {
    timeout: Number(timeoutMs) + 800,
    windowsHide: true,
  });
  return result.status === 0;
}

function withHost(url, host) {
  const parsed = new URL(url);
  parsed.hostname = host;
  return parsed.toString();
}

function logHost(url) {
  try {
    const parsed = new URL(url);
    console.log(`Postgres host=${parsed.hostname} port=${parsed.port || 5432} db=${parsed.pathname.replace(/^\//, "")}`);
  } catch {
    console.warn("DATABASE_URL is not a valid URL");
  }
}

/**
 * From inside Docker/Podman, 127.0.0.1 is the container and the VPS public IP
 * often hairpins / hits pg_hba remote rules. Prefer the host Postgres.
 */
function resolveDatabaseUrl(url) {
  if (!url) {
    console.warn("DATABASE_URL is not set — login and orders will return 500.");
    return url;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    console.warn("DATABASE_URL is not a valid URL");
    return url;
  }

  if (!inContainer()) {
    logHost(url);
    return url;
  }

  const port = parsed.port || "5432";
  const preferred = [
    process.env.DATABASE_HOST_INTERNAL,
    "127.0.0.1",
    detectGateway(),
    "host.containers.internal",
    "host.docker.internal",
    "10.88.0.1",
    "172.17.0.1",
  ].filter(Boolean);

  for (const host of preferred) {
    if (!tcpOk(host, port, 900)) continue;
    const next = host === parsed.hostname ? url : withHost(url, host);
    if (host !== parsed.hostname) {
      console.log(`DATABASE_URL host ${parsed.hostname} → ${host} (container → host Postgres)`);
    }
    logHost(next);
    return next;
  }

  logHost(url);
  return url;
}

module.exports = { resolveDatabaseUrl, inContainer, tcpOk, detectGateway };
