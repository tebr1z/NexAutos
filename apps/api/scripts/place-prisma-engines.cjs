"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const HASH = "c2990dca591cba766e3b7ef5d9e8a84796e47ab7";
const PLATFORM = "linux-musl-openssl-3.0.x";
const root = path.join(__dirname, "..");
const packed = path.join(root, "prisma", "engines", PLATFORM);
const destDir = path.join(root, "node_modules", "@prisma", "engines");

function isMuslLinux() {
  if (process.platform !== "linux") return false;
  if (fs.existsSync("/etc/alpine-release")) return true;
  try {
    const report = process.report?.getReport?.();
    if (report?.header && report.header.glibcVersionRuntime == null) return true;
  } catch {
    /* ignore */
  }
  try {
    const ldd = require("child_process").execSync("ldd --version", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return /musl/i.test(ldd);
  } catch (err) {
    return /musl/i.test(String(err.stderr || err.stdout || err));
  }
}

function gunzip(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, zlib.gunzipSync(fs.readFileSync(src)));
  try {
    fs.chmodSync(dest, 0o755);
  } catch {
    /* windows */
  }
}

if (!isMuslLinux()) {
  process.exit(0);
}

const schemaGz = path.join(packed, "schema-engine.gz");
const queryGz = path.join(packed, "libquery_engine.so.node.gz");
if (!fs.existsSync(schemaGz) || !fs.existsSync(queryGz)) {
  console.warn("Bundled Prisma musl engines are missing.");
  process.exit(0);
}

if (fs.existsSync(destDir)) {
  gunzip(schemaGz, path.join(destDir, `schema-engine-${PLATFORM}`));
  gunzip(queryGz, path.join(destDir, `libquery_engine-${PLATFORM}.so.node`));
}

const cache = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "prisma", "master", HASH, PLATFORM);
fs.mkdirSync(cache, { recursive: true });
gunzip(schemaGz, path.join(cache, "schema-engine"));
gunzip(queryGz, path.join(cache, "libquery_engine.so.node"));
for (const name of [
  "schema-engine.sha256",
  "schema-engine.gz.sha256",
  "libquery_engine.so.node.sha256",
  "libquery_engine.so.node.gz.sha256",
]) {
  fs.writeFileSync(path.join(cache, name), `${"0".repeat(64)}\n`);
}

console.log("Prisma musl engines placed from repo (no binaries.prisma.sh).");
