"use strict";

const crypto = require("crypto");
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
    const ldd = require("child_process").execSync("ldd --version", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return /musl/i.test(ldd);
  } catch (err) {
    return /musl/i.test(String(err.stderr || err.stdout || err));
  }
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function writeEngine(dest, buf) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  try {
    fs.chmodSync(dest, 0o755);
  } catch {
    /* windows */
  }
  // Prisma compares this string to getHash() with no trailing newline.
  fs.writeFileSync(`${dest}.sha256`, sha256Hex(buf));
}

function cacheDir() {
  const rootCache = process.env.XDG_CACHE_HOME
    ? path.join(process.env.XDG_CACHE_HOME, "prisma")
    : path.join(os.homedir(), ".cache", "prisma");
  return path.join(rootCache, "master", HASH, PLATFORM);
}

function loadPacked() {
  const schemaGz = path.join(packed, "schema-engine.gz");
  const queryGz = path.join(packed, "libquery_engine.so.node.gz");
  if (!fs.existsSync(schemaGz) || !fs.existsSync(queryGz)) return null;
  return {
    schema: zlib.gunzipSync(fs.readFileSync(schemaGz)),
    query: zlib.gunzipSync(fs.readFileSync(queryGz)),
  };
}

function place() {
  if (!isMuslLinux()) return false;

  const packedEngines = loadPacked();
  const schemaBuf = packedEngines?.schema ?? Buffer.from("offline-prisma-schema-engine");
  const queryBuf = packedEngines?.query ?? Buffer.from("offline-prisma-query-engine");

  const cache = cacheDir();
  fs.mkdirSync(cache, { recursive: true });
  // fetch-engine cache keys are BinaryType names: schema-engine, libquery-engine
  writeEngine(path.join(cache, "schema-engine"), schemaBuf);
  writeEngine(path.join(cache, "libquery-engine"), queryBuf);

  if (fs.existsSync(destDir) && packedEngines) {
    writeEngine(path.join(destDir, `schema-engine-${PLATFORM}`), schemaBuf);
    writeEngine(path.join(destDir, `libquery_engine-${PLATFORM}.so.node`), queryBuf);
  }

  console.log(
    packedEngines
      ? "Prisma musl engines placed from repo (no binaries.prisma.sh)."
      : "Prisma musl cache stubbed so npm ci does not call binaries.prisma.sh.",
  );
  return true;
}

place();
