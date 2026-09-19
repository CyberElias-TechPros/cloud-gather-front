import { siteConfig } from "@/lib/site";

export { Seo } from "@/components/common/Seo";

/**
 * schema.org JSON-LD builders. Only factual, verifiable information is
 * emitted — no fabricated reviews, ratings or prices.
 */

export const organizationJsonLd = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  url: siteConfig.url,
  logo: `${siteConfig.url}/icon.svg`,
  description: siteConfig.description,
});

export const webSiteJsonLd = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  url: siteConfig.url,
});

export const softwareAppJsonLd = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: siteConfig.description,
  url: siteConfig.url,
  featureList:
    "Multi-cloud file browsing, unified search, file sharing with expiry, storage overview across providers, developer REST API",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier available during open beta",
  },
});

export const breadcrumbJsonLd = (items: { name: string; path: string }[]): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: `${siteConfig.url}${item.path}`,
  })),
});

export const faqJsonLd = (
  faqs: { q: string; a: string }[]
): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
});

export const blogPostingJsonLd = (post: {
  title: string;
  excerpt: string;
  author: string;
  date: Date | string;
  slug: string;
  image?: string | null;
}): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: post.title,
  description: post.excerpt,
  author: { "@type": "Person", name: post.author },
  datePublished: new Date(post.date).toISOString(),
  dateModified: new Date(post.date).toISOString(),
  mainEntityOfPage: `${siteConfig.url}/blog/${post.slug}`,
  ...(post.image ? { image: post.image.startsWith("http") ? post.image : `${siteConfig.url}${post.image}` } : {}),
  publisher: {
    "@type": "Organization",
    name: siteConfig.name,
    logo: { "@type": "ImageObject", url: `${siteConfig.url}/icon.svg` },
  },
});
