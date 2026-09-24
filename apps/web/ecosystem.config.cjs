const fs = require("fs");
const path = require("path");

const web = __dirname;
const envFile = path.resolve(web, "../../.env");

function loadEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const eq = text.indexOf("=");
    if (eq < 1) continue;
    const key = text.slice(0, eq).trim();
    let value = text.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

module.exports = {
  apps: [
    {
      name: "nexautos",
      cwd: web,
      script: path.join(web, "scripts/start-with-api.cjs"),
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "900M",
      kill_timeout: 8000,
      env: {
        NODE_ENV: "production",
        PORT: "5001",
        API_PORT: "5002",
        API_HOST: "127.0.0.1",
        INTERNAL_API_URL: "http://127.0.0.1:5002/api/v1",
        API_PROXY_URL: "http://127.0.0.1:5002/api/v1",
        NEXT_PUBLIC_API_URL: "/api/v1",
        NEXT_PUBLIC_SITE_URL: "https://nex.autos",
        CORS_ORIGIN: "https://nex.autos",
        PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: "1",
        NEXT_TELEMETRY_DISABLED: "1",
        ...loadEnvFile(envFile),
      },
    },
  ],
};
