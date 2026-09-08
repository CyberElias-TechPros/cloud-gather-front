import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo, breadcrumbJsonLd } from "@/lib/seo";
import { fetchBlogPosts } from "@/services/blogService";
import { formatDate } from "@/lib/format";
import { Search, CalendarDays, ArrowRight, Newspaper } from "lucide-react";

/** Public blog index. Posts are authored in the admin console and stored in
 * the `blog_posts` table; only published content is shown. */
const BlogPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: posts, isLoading, isError, refetch } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: fetchBlogPosts,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = (posts ?? []).filter((post) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      post.title.toLowerCase().includes(q) ||
      post.excerpt.toLowerCase().includes(q) ||
      post.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  return (
    <MarketingLayout>
      <Seo
        title="Blog"
        description="Product updates, storage tips and engineering notes from the CloudGather team."
        path="/blog"
        jsonLd={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }])]}
      />

      <section className="border-b bg-dotted" aria-labelledby="blog-hero">
        <div className="container px-4 py-14 text-center sm:px-6 lg:py-20">
          <h1 id="blog-hero" className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            The CloudGather blog
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Product updates, storage workflows and what we&apos;re learning building multi-cloud tools.
          </p>
        </div>
      </section>

      <section className="container max-w-4xl px-4 py-12 sm:px-6" aria-label="Posts">
        <div className="relative mb-10 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search posts…"
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search blog posts"
          />
        </div>

        {isLoading && (
          <div className="grid gap-6" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="font-medium">Couldn&apos;t load posts.</p>
            <p className="mt-1 text-sm text-muted-foreground">This might be a temporary network issue.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="rounded-xl border bg-card p-12 text-center">
            <Newspaper className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">
              {posts?.length ? "No posts match your search" : "No posts yet"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {posts?.length
                ? "Try a different search term."
                : "We're writing the first posts now — check back soon, or follow along via the product changelog."}
            </p>
          </div>
        )}

        <div className="grid gap-6">
          {filtered.map((post) => (
            <Card key={post.slug} className="card-hover overflow-hidden">
              <CardContent className="p-0">
                <Link to={`/blog/${post.slug}`} className="block p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <article>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <Badge variant="secondary">{post.category}</Badge>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        <time dateTime={new Date(post.date).toISOString()}>{formatDate(post.date)}</time>
                      </span>
                      <span>By {post.author}</span>
                    </div>
                    <h2 className="mt-3 text-xl font-bold tracking-tight hover:text-primary">{post.title}</h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Read post <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </article>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
};

export default BlogPage;
