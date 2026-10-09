import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const configuredDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const localDevOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : Object.values(networkInterfaces()).flatMap((addresses) =>
        (addresses ?? [])
          .filter((address) => address.family === "IPv4" && !address.internal)
          .map((address) => address.address),
      );
const allowedDevOrigins = [...new Set([...configuredDevOrigins, ...localDevOrigins])];

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOrigins.length ? allowedDevOrigins : undefined,
  productionBrowserSourceMaps: false,
  experimental: { cpus: 1 },
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
  redirects: async () => [
    { source: "/vin-search", destination: "/cars", permanent: false },
    { source: "/vin-search/:path*", destination: "/cars", permanent: false },
    { source: "/vessels", destination: "/track", permanent: false },
  ],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(self)",
        },
      ],
    },
  ],
};

export default nextConfig;
