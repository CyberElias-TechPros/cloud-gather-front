import React, { useEffect } from "react";
import { siteConfig } from "@/lib/site";
interface SeoProps {
  title: string;
  description?: string;
  /** Path portion of the canonical URL, e.g. "/pricing". */
  path?: string;
  /** Exclude from indexation (app pages, error pages). */
  noIndex?: boolean;
  /** schema.org JSON-LD payloads to embed. */
  jsonLd?: Record<string, unknown>[];
  /** Use article-type OG metadata (blog posts). */
  type?: "website" | "article";
  image?: string;
}

function upsertMeta(selector: string, attrs: Record<string, string>): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

/**
 * Per-route document metadata: title, description, canonical, Open Graph /
 * Twitter cards and JSON-LD structured data. Rendered client-side by the SPA;
 * the static shell in index.html carries the defaults for the landing page.
 */
export const Seo: React.FC<SeoProps> = ({
  title,
  description = siteConfig.description,
  path,
  noIndex = false,
  jsonLd = [],
  type = "website",
  image,
}) => {
  useEffect(() => {
    const fullTitle = title === siteConfig.name ? title : `${title} · ${siteConfig.name}`;
    const canonicalUrl = `${siteConfig.url}${path ?? ""}`;
    const imageUrl = image?.startsWith("http") ? image : `${siteConfig.url}${image ?? siteConfig.ogImage}`;

    document.title = fullTitle;

    upsertMeta('meta[name="description"]', { name: "description", content: description });

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    // Robots
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
    });

    // Open Graph
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: siteConfig.name });

    // Twitter
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: fullTitle });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });

    // JSON-LD (replace previous route payloads to avoid duplication across navigations)
    document.head.querySelectorAll('script[data-seo-jsonld="route"]').forEach((n) => n.remove());
    jsonLd.forEach((payload) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo-jsonld", "route");
      script.textContent = JSON.stringify(payload);
      document.head.appendChild(script);
    });
  }, [title, description, path, noIndex, type, image, JSON.stringify(jsonLd)]);

  return null;
};
