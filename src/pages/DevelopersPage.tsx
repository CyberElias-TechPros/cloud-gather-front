import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo, breadcrumbJsonLd } from "@/lib/seo";
import { KeyRound, Terminal, ShieldCheck, ArrowRight } from "lucide-react";

const CodeBlock: React.FC<{ children: string; label?: string }> = ({ children, label }) => (
  <div className="overflow-hidden rounded-lg border bg-muted/50">
    {label && (
      <div className="border-b bg-muted/70 px-4 py-1.5 text-xs font-medium text-muted-foreground">{label}</div>
    )}
    <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed"><code>{children}</code></pre>
  </div>
);

const endpoints = [
  { method: "GET", path: "/api/v1/files", description: "List files. Query params: folder (id), sort (name|date|size), direction (asc|desc)." },
  { method: "GET", path: "/api/v1/files/:id", description: "Get metadata for a single file or folder." },
  { method: "GET", path: "/api/v1/files/:id/download", description: "Download the file content." },
  { method: "POST", path: "/api/v1/files/folder", description: "Create a folder. Body: { folderName, parentFolderId? }." },
  { method: "POST", path: "/api/v1/files/upload", description: "Upload a file (multipart/form-data). Fields: file, parentFolderId?." },
  { method: "POST", path: "/api/v1/files/:id/share", description: "Share a file. Body: { email, permissionLevel: 'view'|'edit'|'admin', expiresAt? }." },
  { method: "DELETE", path: "/api/v1/files/:id", description: "Delete a file or folder (and its contents)." },
];

const DevelopersPage: React.FC = () => {
  return (
    <MarketingLayout>
      <Seo
        title="Developers"
        description="The CloudGather REST API: manage files across your connected cloud storage with personal API keys. Endpoints, authentication and examples."
        path="/developers"
        jsonLd={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Developers", path: "/developers" }])]}
      />

      <section className="border-b bg-dotted" aria-labelledby="dev-hero">
        <div className="container px-4 py-16 text-center sm:px-6 lg:py-24">
          <Badge variant="secondary" className="mb-4 rounded-full">v1 · Beta</Badge>
          <h1 id="dev-hero" className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            The CloudGather <span className="text-gradient">API</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Script your storage: list, upload, download and share files across every
            connected provider with a single authenticated interface.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link to="/api-keys">
                <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" /> Create an API key
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contact">Ask a question</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container max-w-4xl px-4 py-14 sm:px-6" aria-labelledby="auth-heading">
        <h2 id="auth-heading" className="text-2xl font-bold tracking-tight">Authentication</h2>
        <p className="mt-3 text-muted-foreground">
          Every request carries your personal key in the <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">x-api-key</code> header.
          Keys are created in your dashboard, are shown once, and are stored as irreversible hashes —
          treat them like passwords. Each key has scoped permissions (<code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">read</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">write</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">share</code>) and can be revoked at any time.
        </p>
        <div className="mt-5">
          <CodeBlock label="Example request">{`curl "https://api.cloudgather.com/api/files" \\
  -H "x-api-key: cg_YOUR_KEY"`}</CodeBlock>
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <p>
            Requests are limited to 100 per minute per key. When you exceed the limit the API returns{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[13px]">429 Too Many Requests</code> — back off and retry.
          </p>
        </div>
      </section>

      <section className="border-y bg-muted/30" aria-labelledby="endpoints-heading">
        <div className="container max-w-4xl px-4 py-14 sm:px-6">
          <h2 id="endpoints-heading" className="text-2xl font-bold tracking-tight">Endpoints</h2>
          <div className="mt-6 overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">CloudGather API v1 endpoints</caption>
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th scope="col" className="px-4 py-3 font-semibold">Method</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Path</th>
                  <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((endpoint) => (
                  <tr key={endpoint.method + endpoint.path} className="border-b last:border-0 align-top">
                    <td className="px-4 py-3">
                      <Badge variant={endpoint.method === "DELETE" ? "destructive" : "secondary"} className="font-mono text-[11px]">
                        {endpoint.method}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px]">{endpoint.path}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{endpoint.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="container max-w-4xl px-4 py-14 sm:px-6" aria-labelledby="examples-heading">
        <h2 id="examples-heading" className="text-2xl font-bold tracking-tight">Examples</h2>
        <Tabs defaultValue="list" className="mt-6">
          <TabsList>
            <TabsTrigger value="list">List files</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="mt-4">
            <CodeBlock label="GET /api/v1/files">{`curl "https://api.cloudgather.com/api/files?sort=name&direction=asc" \\
  -H "x-api-key: cg_YOUR_KEY"

# → { "files": [ { "id": "…", "filename": "invoice.pdf", "size": 81234,
#                  "mime_type": "application/pdf", "is_folder": false, … } ] }`}</CodeBlock>
          </TabsContent>
          <TabsContent value="upload" className="mt-4">
            <CodeBlock label="POST /api/v1/files/upload">{`curl -X POST "https://api.cloudgather.com/api/files/upload" \\
  -H "x-api-key: cg_YOUR_KEY" \\
  -F "file=@report.pdf"`}</CodeBlock>
          </TabsContent>
          <TabsContent value="share" className="mt-4">
            <CodeBlock label="POST /api/v1/files/:id/share">{`curl -X POST "https://api.cloudgather.com/api/files/FILE_ID/share" \\
  -H "x-api-key: cg_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"teammate@example.com","permissionLevel":"view"}'`}</CodeBlock>
          </TabsContent>
        </Tabs>
      </section>

      <section className="container max-w-4xl px-4 pb-20 sm:px-6" aria-labelledby="start-heading">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <Terminal className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 id="start-heading" className="text-lg font-semibold">Ready to build?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a key from your dashboard and make your first call in under a minute.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link to="/register">
                Sign up <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </MarketingLayout>
  );
};

export default DevelopersPage;
