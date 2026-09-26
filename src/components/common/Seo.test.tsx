import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Seo } from "./Seo";
import { siteConfig } from "@/lib/site";
import { faqJsonLd, blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/seo";

describe("Seo component", () => {
  it("sets the document title with the brand suffix", () => {
    render(<Seo title="Pricing" path="/pricing" />);
    expect(document.title).toBe(`Pricing · ${siteConfig.name}`);
  });

  it("uses the bare brand name for the homepage title", () => {
    render(<Seo title={siteConfig.name} path="/" />);
    expect(document.title).toBe(siteConfig.name);
  });

  it("writes description, canonical and OG tags", () => {
    render(<Seo title="Features" description="All features" path="/features" />);
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("All features");
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${siteConfig.url}/features`);
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
      `Features · ${siteConfig.name}`
    );
  });

  it("emits noindex for protected pages", () => {
    render(<Seo title="Dashboard" noIndex />);
    const robots = document.head.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "";
    expect(robots).toContain("noindex");
  });

  it("allows indexation for public pages", () => {
    render(<Seo title="Pricing" path="/pricing" />);
    const robots = document.head.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "";
    expect(robots).toContain("index");
    expect(robots).not.toContain("noindex");
  });

  it("embeds JSON-LD payloads tagged for cleanup", () => {
    render(<Seo title="Home" jsonLd={[{ "@type": "WebSite" }]} />);
    const scripts = document.head.querySelectorAll('script[data-seo-jsonld="route"]');
    expect(scripts.length).toBe(1);
    expect(JSON.parse(scripts[0].textContent ?? "{}")["@type"]).toBe("WebSite");
  });
});

describe("structured data builders", () => {
  it("builds valid FAQ structured data", () => {
    const payload = faqJsonLd([{ q: "Is it free?", a: "Yes." }]) as {
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(payload["@type"]).toBe("FAQPage");
    expect(payload.mainEntity[0].name).toBe("Is it free?");
    expect(payload.mainEntity[0].acceptedAnswer.text).toBe("Yes.");
  });

  it("builds BlogPosting data with ISO dates and absolute URLs", () => {
    const payload = blogPostingJsonLd({
      title: "Hello",
      excerpt: "World",
      author: "Team",
      date: "2026-01-15T00:00:00.000Z",
      slug: "hello",
    }) as { mainEntityOfPage: string; datePublished: string; author: { name: string } };
    expect(payload.mainEntityOfPage).toBe(`${siteConfig.url}/blog/hello`);
    expect(payload.datePublished).toBe("2026-01-15T00:00:00.000Z");
    expect(payload.author.name).toBe("Team");
  });

  it("builds breadcrumb lists with positions", () => {
    const payload = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
    ]) as { itemListElement: { position: number; item: string }[] };
    expect(payload.itemListElement.length).toBe(2);
    expect(payload.itemListElement[1].item).toBe(`${siteConfig.url}/blog`);
  });
});
