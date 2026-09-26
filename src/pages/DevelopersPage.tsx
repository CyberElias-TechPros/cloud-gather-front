import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Braces, KeyRound, Lock, ShieldCheck, Terminal, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { CopyButton } from "@/components/common/CopyButton";
import { Seo, breadcrumbJsonLd } from "@/lib/seo";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------- types */

interface OpenApiOperation {
  summary?: string;
  tags?: string[];
  security?: unknown[];
  responses?: Record<string, { description?: string }>;
}
interface OpenApiDocument {
  info: { title: string; version: string; description?: string };
  servers: { url: string }[];
  paths: Record<string, Record<string, OpenApiOperation>>;
}
interface Endpoint {
  method: string;
  path: string;
  summary: string;
  secured: boolean;
  admin: boolean;
  tag: string;
}

const METHOD_COLOR: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  POST: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  PATCH: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const CodeBlock: React.FC<{ children: string; label?: string }> = ({ children, label }) => (
  <div className="overflow-hidden rounded-lg border bg-muted/50">
    {label ? (
      <div className="flex items-center justify-between border-b bg-muted/70 px-4 py-1.5 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <CopyButton value={children} />
      </div>
    ) : null}
    <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
      <code>{children}</code>
    </pre>
  </div>
);

/* --------------------------------------------------------------- page */

const DevelopersPage: React.FC = () => {
  const [filter, setFilter] = React.useState("");

  const spec = useQuery({
    queryKey: ["openapi"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<OpenApiDocument> => {
      const response = await fetch(apiUrl("/openapi.json"), { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Failed to load API schema (${response.status})`);
      return response.json();
    },
  });

  const endpoints = React.useMemo<Endpoint[]>(() => {
    const paths = spec.data?.paths ?? {};
    const list: Endpoint[] = [];
    for (const [path, operations] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        list.push({
          method: method.toUpperCase(),
          path,
          summary: operation.summary ?? "",
          secured: Array.isArray(operation.security) && operation.security.length > 0,
          admin: Boolean(operation.responses?.["403"]),
          tag: operation.tags?.[0] ?? "system",
        });
      }
    }
    return list.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  }, [spec.data]);

  const grouped = React.useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const map = new Map<string, Endpoint[]>();
    for (const endpoint of endpoints) {
      if (needle && !`${endpoint.method} ${endpoint.path} ${endpoint.summary}`.toLowerCase().includes(needle)) continue;
      map.set(endpoint.tag, [...(map.get(endpoint.tag) ?? []), endpoint]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [endpoints, filter]);

  const base = spec.data?.servers?.[0]?.url ?? "https://api.cloudgather.app";

  return (
    <MarketingLayout>
      <Seo
        title="Developers"
        description="The CloudGather REST API: manage files across every connected cloud with personal API keys. Live endpoint reference, authentication, webhooks and examples."
        path="/developers"
        jsonLd={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Developers", path: "/developers" }])]}
      />

      {/* Hero */}
      <section className="border-b bg-dotted" aria-labelledby="dev-hero">
        <div className="container px-4 py-16 sm:px-6 lg:py-20">
          <Badge variant="outline" className="mb-4">
            API v{spec.data?.info?.version ?? "1"}
          </Badge>
          <h1 id="dev-hero" className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            One API for every cloud your users already have
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            List, search, upload, share and sync files across Google Drive, OneDrive, Dropbox and CloudGather storage
            through a single REST surface. Authenticate with a personal API key — no OAuth dance to implement yourself.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/api-keys">
                <KeyRound className="mr-2 h-4 w-4" /> Create an API key
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={apiUrl("/openapi.json")} target="_blank" rel="noreferrer">
                <Braces className="mr-2 h-4 w-4" /> Download OpenAPI schema
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Quickstart */}
      <section className="container px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Quickstart</h2>
              <p className="mt-1 text-muted-foreground">
                Three steps: create a key in the dashboard, send it as a header, call any endpoint below.
              </p>
            </div>

            <Tabs defaultValue="curl">
              <TabsList>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="node">Node.js</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
              <TabsContent value="curl" className="mt-3">
                <CodeBlock label="List the 20 most recent files">{`curl "${base}/api/v1/files?limit=20&sort=updated_at&direction=desc" \\
  -H "X-API-Key: $CLOUDGATHER_API_KEY"`}</CodeBlock>
              </TabsContent>
              <TabsContent value="node" className="mt-3">
                <CodeBlock label="node >= 18 (global fetch)">{`const res = await fetch("${base}/api/v1/files?limit=20", {
  headers: { "X-API-Key": process.env.CLOUDGATHER_API_KEY },
});
if (!res.ok) throw new Error(\`CloudGather \${res.status}\`);
const { items, total } = await res.json();
console.log(\`\${items.length} of \${total} files\`);`}</CodeBlock>
              </TabsContent>
              <TabsContent value="python" className="mt-3">
                <CodeBlock label="requests">{`import os, requests

res = requests.get(
    "${base}/api/v1/files",
    params={"limit": 20},
    headers={"X-API-Key": os.environ["CLOUDGATHER_API_KEY"]},
    timeout=30,
)
res.raise_for_status()
print(res.json()["total"])`}</CodeBlock>
              </TabsContent>
            </Tabs>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Uploading a file</h3>
              <CodeBlock label="multipart/form-data">{`curl -X POST "${base}/api/v1/files/upload" \\
  -H "X-API-Key: $CLOUDGATHER_API_KEY" \\
  -F "file=@report.pdf" \\
  -F "parent_id=$FOLDER_ID"`}</CodeBlock>
              <p className="text-sm text-muted-foreground">
                Files larger than the single-shot limit use the resumable flow:{" "}
                <code>POST /api/v1/uploads</code> to start, <code>PUT /api/v1/uploads/:id/parts/:part</code> for each
                chunk, then <code>POST /api/v1/uploads/:id/complete</code>.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Creating a share link</h3>
              <CodeBlock label="JSON body">{`curl -X POST "${base}/api/v1/files/$FILE_ID/links" \\
  -H "X-API-Key: $CLOUDGATHER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"expires_in_days":7,"password":"optional","max_downloads":50}'`}</CodeBlock>
              <p className="text-sm text-muted-foreground">
                The response contains a <code>token</code>; the shareable URL is{" "}
                <code>{`${window.location.origin}/l/<token>`}</code>. Sharing with a specific person instead uses{" "}
                <code>POST /api/v1/files/:id/shares</code> with an email address.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="h-4 w-4" /> Authentication
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Send <code className="text-foreground">X-API-Key: cg_live_…</code> for machine access, or{" "}
                  <code className="text-foreground">Authorization: Bearer &lt;session&gt;</code> from a signed-in app.
                </p>
                <p>Keys are shown once at creation, can be scoped per capability, and are revocable at any time.</p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/api-keys">
                    Manage keys <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4" /> Rate limits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Limits are per plan and returned on every response as <code className="text-foreground">X-RateLimit-Limit</code>,{" "}
                  <code className="text-foreground">X-RateLimit-Remaining</code> and{" "}
                  <code className="text-foreground">X-RateLimit-Reset</code>.
                </p>
                <p>
                  Exceeding a limit returns <code className="text-foreground">429</code> with a{" "}
                  <code className="text-foreground">Retry-After</code> header — back off and retry.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Webhook className="h-4 w-4" /> Webhooks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Subscribe to <code className="text-foreground">file.uploaded</code>,{" "}
                  <code className="text-foreground">file.deleted</code>, <code className="text-foreground">share.created</code>{" "}
                  and more. Every delivery is signed with HMAC-SHA256 in{" "}
                  <code className="text-foreground">X-CloudGather-Signature</code>.
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/webhooks">
                    Configure endpoints <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="h-4 w-4" /> Errors
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="mb-2">Every error uses the same envelope:</p>
                <pre className="overflow-x-auto rounded border bg-muted/50 p-3 text-xs">
                  <code>{`{
  "error": {
    "code": "not_found",
    "message": "File not found"
  },
  "request_id": "req_…"
}`}</code>
                </pre>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>

      {/* Live endpoint reference */}
      <section className="border-t bg-muted/20">
        <div className="container px-4 py-14 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">API reference</h2>
              <p className="mt-1 text-muted-foreground">
                Generated live from the running service — {endpoints.length} endpoints across {grouped.length} groups.
              </p>
            </div>
            <Input
              className="w-full sm:w-72"
              placeholder="Filter endpoints…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>

          {spec.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
            </div>
          ) : spec.isError ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reference unavailable</CardTitle>
                <CardDescription>
                  The API schema could not be reached. It is always available at{" "}
                  <a className="text-primary underline-offset-2 hover:underline" href={apiUrl("/openapi.json")}>
                    /api/openapi.json
                  </a>
                  .
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {grouped.map(([tag, items]) => (
                <AccordionItem key={tag} value={tag} className="rounded-lg border bg-background px-4">
                  <AccordionTrigger className="text-left">
                    <span className="flex items-center gap-2 capitalize">
                      {tag.replace(/-/g, " ")}
                      <Badge variant="secondary">{items.length}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="divide-y">
                      {items.map((endpoint) => (
                        <li key={`${endpoint.method} ${endpoint.path}`} className="flex flex-wrap items-center gap-3 py-2.5">
                          <span
                            className={cn(
                              "w-16 shrink-0 rounded px-2 py-0.5 text-center text-[11px] font-bold",
                              METHOD_COLOR[endpoint.method] ?? "bg-muted text-muted-foreground",
                            )}
                          >
                            {endpoint.method}
                          </span>
                          <code className="text-sm">{endpoint.path}</code>
                          {endpoint.secured ? (
                            <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Requires authentication" />
                          ) : null}
                          {endpoint.admin ? (
                            <Badge variant="outline" className="text-[10px]">
                              admin
                            </Badge>
                          ) : null}
                          <span className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">{endpoint.summary}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            Every endpoint is also reachable under the versioned prefix <code>/api/v1/…</code>, which we keep
            backwards-compatible. Breaking changes ship as a new version.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t">
        <div className="container px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight">Build something with it</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            Create a free account, generate a key and make your first call in under two minutes.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                Get started free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/contact">Talk to an engineer</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default DevelopersPage;
