import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Inter } from "next/font/google";
import { ThemeProvider, type Theme } from "@/providers/theme-provider";
import { I18nProvider } from "@/providers/i18n-provider";
import { CurrencyProvider } from "@/providers/currency-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { SiteShell } from "@/components/layout/site-shell";
import { SITE } from "@/lib/constants";
import { JsonLd } from "@/components/seo/json-ld";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Auto Nex | Premium Car Import from USA, Korea & China",
    template: "%s | Auto Nex",
  },
  description:
    "Auto Nex imports premium vehicles from Copart, IAAI and Manheim. Full inspection, customs clearance and live shipment tracking to Azerbaijan.",
  keywords: [
    "car import Azerbaijan",
    "Copart",
    "IAAI",
    "Manheim",
    "VIN search",
    "shipment tracking",
    "USA cars Baku",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE.url,
    siteName: "Auto Nex",
    title: "Auto Nex | Premium Car Import",
    description: SITE.tagline,
    images: [
      {
        url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
        width: 1200,
        height: 630,
        alt: "Auto Nex",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Auto Nex | Premium Car Import",
    description: SITE.tagline,
  },
  alternates: {
    canonical: SITE.url,
    languages: {
      en: SITE.url,
      az: SITE.url,
      ru: SITE.url,
      tr: SITE.url,
    },
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "AutomotiveBusiness",
  name: "Auto Nex",
  url: SITE.url,
  email: SITE.email,
  telephone: SITE.phones.map((p) => p.tel),
  address: {
    "@type": "PostalAddress",
    streetAddress: "Bakıxanov qəsəbəsi",
    addressLocality: "Bakı",
    addressCountry: "AZ",
  },
  description: SITE.tagline,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const theme: Theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";

  return (
    <html
      lang="az"
      suppressHydrationWarning
      className={`${theme} ${geist.variable} ${inter.variable} h-full`}
      style={{ colorScheme: theme }}
    >
      <body className="min-h-full flex flex-col antialiased">
        <JsonLd data={jsonLd} />
        <ThemeProvider initialTheme={theme}>
          <I18nProvider>
            <CurrencyProvider>
              <AuthProvider>
                <SiteShell>{children}</SiteShell>
              </AuthProvider>
            </CurrencyProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
