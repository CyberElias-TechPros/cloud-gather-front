import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo, breadcrumbJsonLd, blogPostingJsonLd } from "@/lib/seo";
import { fetchBlogPostBySlug } from "@/services/blogService";
import { formatDate } from "@/lib/format";
import { CalendarDays, ArrowLeft, FileQuestion } from "lucide-react";

/**
 * Render post content safely: the content is admin-authored plain text /
 * markdown-lite. We never inject it as raw HTML — instead we escape everything
 * and render paragraphs, preserving intentional line breaks.
 */
const SafeContent: React.FC<{ content: string }> = ({ content }) => {
  const blocks = content
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        // Minimal, safe markdown: "## " headings and "- " lists.
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="mt-8 text-2xl font-bold tracking-tight">
              {block.slice(3)}
            </h2>
          );
        }
        if (block.startsWith("### ")) {
          return (
            <h3 key={i} className="mt-6 text-xl font-semibold tracking-tight">
              {block.slice(4)}
            </h3>
          );
        }
        const lines = block.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-2 pl-5">
              {lines.map((line, j) => (
                <li key={j}>{line.trim().slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="leading-relaxed">
            {block}
          </p>
        );
      })}
    </div>
  );
};

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: () => fetchBlogPostBySlug(slug ?? ""),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <MarketingLayout>
      <Seo
        title={post ? post.title : "Blog post"}
        description={post?.excerpt ?? "CloudGather blog"}
        path={`/blog/${slug ?? ""}`}
        type="article"
        jsonLd={
          post
            ? [
                blogPostingJsonLd({
                  title: post.title,
                  excerpt: post.excerpt,
                  author: post.author,
                  date: post.date,
                  slug: post.slug,
                  image: post.image,
                }),
                breadcrumbJsonLd([
                  { name: "Home", path: "/" },
                  { name: "Blog", path: "/blog" },
                  { name: post.title, path: `/blog/${post.slug}` },
                ]),
              ]
            : []
        }
      />

      <article className="container max-w-3xl px-4 py-12 sm:px-6">
        <Button variant="ghost" size="sm" className="mb-8 -ml-2" asChild>
          <Link to="/blog">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> All posts
          </Link>
        </Button>

        {isLoading && (
          <div className="space-y-4" aria-hidden="true">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <div className="space-y-3 pt-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="font-medium">Couldn&apos;t load this post.</p>
            <p className="mt-1 text-sm text-muted-foreground">It may have been unpublished, or the network hiccupped.</p>
          </div>
        )}

        {!isLoading && !isError && !post && (
          <div className="rounded-xl border bg-card p-12 text-center">
            <FileQuestion className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <h1 className="mt-4 text-lg font-semibold">Post not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The post you&apos;re looking for doesn&apos;t exist or was unpublished.
            </p>
            <Button className="mt-6" variant="outline" asChild>
              <Link to="/blog">Browse all posts</Link>
            </Button>
          </div>
        )}

        {post && (
          <>
            <header>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="secondary">{post.category}</Badge>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  <time dateTime={new Date(post.date).toISOString()}>{formatDate(post.date)}</time>
                </span>
                <span>By {post.author}</span>
              </div>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{post.title}</h1>
              <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>
            </header>

            {post.image && (
              <img
                src={post.image}
                alt=""
                width={1200}
                height={630}
                loading="eager"
                className="mt-8 w-full rounded-xl border object-cover"
              />
            )}

            <div className="mt-10 text-base text-foreground/90">
              <SafeContent content={post.content} />
            </div>

            {post.tags.length > 0 && (
              <footer className="mt-12 border-t pt-6">
                <div className="flex flex-wrap gap-2" aria-label="Tags">
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </footer>
            )}
          </>
        )}
      </article>
    </MarketingLayout>
  );
};

export default BlogPostPage;
