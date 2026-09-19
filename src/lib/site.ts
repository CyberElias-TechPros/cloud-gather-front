/**
 * Central site configuration — single source of truth for brand identity,
 * canonical URLs and public navigation.
 *
 * The canonical origin comes from VITE_PUBLIC_SITE_URL so preview, staging and
 * production environments each emit correct canonical links and sitemaps.
 */

const rawSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;

export const siteConfig = {
  name: "CloudGather",
  tagline: "One home for every cloud",
  description:
    "CloudGather brings your Google Drive, Dropbox, OneDrive, Box and more into one unified, searchable storage pool — so you always know where your files are.",
  url: (rawSiteUrl || "http://localhost:8080").replace(/\/$/, ""),
  ogImage: "/og-image.png",
  twitter: "@cloudgather",
  supportEmail: "support@cloudgather.app",
  appVersion: "1.0.0",
} as const;

/** Routes that require authentication — excluded from sitemap & allowed in robots. */
export const protectedRoutes = [
  "/dashboard",
  "/files",
  "/storage",
  "/providers",
  "/recents",
  "/settings",
  "/api-keys",
  "/admin",
];

export const mainNav = [
  { title: "Features", href: "/features" },
  { title: "Pricing", href: "/pricing" },
  { title: "Developers", href: "/developers" },
  { title: "Blog", href: "/blog" },
  { title: "About", href: "/about" },
] as const;

export const footerNav = [
  {
    title: "Product",
    links: [
      { title: "Features", href: "/features" },
      { title: "Pricing", href: "/pricing" },
      { title: "Supported providers", href: "/features#providers" },
      { title: "API for developers", href: "/developers" },
    ],
  },
  {
    title: "Resources",
    links: [
      { title: "Blog", href: "/blog" },
      { title: "About us", href: "/about" },
      { title: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { title: "Privacy policy", href: "/privacy" },
      { title: "Terms of service", href: "/terms" },
    ],
  },
] as const;
