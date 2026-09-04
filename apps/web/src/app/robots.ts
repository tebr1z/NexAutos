import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/login", "/api"] },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://nex.autos"}/sitemap.xml`,
  };
}
