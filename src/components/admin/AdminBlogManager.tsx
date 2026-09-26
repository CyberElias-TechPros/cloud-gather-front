import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, Loader2, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  createBlogPost,
  deleteBlogPost,
  duplicateBlogPost,
  listBlogPosts,
  updateBlogPost,
  type AdminBlogPost,
} from "@/services/admin";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const emptyDraft = (): Partial<AdminBlogPost> => ({
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  author: "CloudGather Team",
  category: "Product",
  tags: [],
  image: "",
  published: false,
  featured: false,
});

/** Create, edit, publish and delete blog posts. */
const AdminBlogManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState<Partial<AdminBlogPost> | null>(null);
  const [tagsText, setTagsText] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<AdminBlogPost | null>(null);

  const posts = useQuery({ queryKey: ["admin", "blog"], queryFn: listBlogPosts });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "blog"] });
    queryClient.invalidateQueries({ queryKey: ["blog"] });
  };

  const openEditor = (post?: AdminBlogPost) => {
    const next = post ? { ...post } : emptyDraft();
    setDraft(next);
    setTagsText((next.tags ?? []).join(", "));
  };

  const save = useMutation({
    mutationFn: () => {
      const payload: Partial<AdminBlogPost> = {
        ...draft,
        slug: draft?.slug || slugify(draft?.title ?? ""),
        tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
        published: Boolean(draft?.published),
        featured: Boolean(draft?.featured),
      };
      return draft?.id ? updateBlogPost(draft.id, payload) : createBlogPost(payload);
    },
    onSuccess: () => {
      toast.success(draft?.id ? "Post updated" : "Post created");
      setDraft(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const togglePublished = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) => updateBlogPost(id, { published }),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateBlogPost(id),
    onSuccess: () => {
      toast.success("Draft copy created");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBlogPost(id),
    onSuccess: () => {
      toast.success("Post deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const items = posts.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Blog</CardTitle>
          <CardDescription>{posts.data?.total ?? 0} posts · published entries appear on /blog immediately.</CardDescription>
        </div>
        <Button onClick={() => openEditor()}>
          <Plus className="mr-2 h-4 w-4" /> New post
        </Button>
      </CardHeader>
      <CardContent>
        {posts.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={Newspaper}
            title="No posts yet"
            description="Publish your first article to start building the content library."
            action={<Button onClick={() => openEditor()}>Write a post</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Published</TableHead>
                  <TableHead className="hidden lg:table-cell">Views</TableHead>
                  <TableHead>Live</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <p className="font-medium">{post.title}</p>
                      <p className="text-xs text-muted-foreground">/blog/{post.slug}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">{post.category}</Badge>
                      {post.featured ? <Badge className="ml-1">Featured</Badge> : null}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {post.published_at ? formatDate(post.published_at) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{post.view_count}</TableCell>
                    <TableCell>
                      <Switch
                        checked={Boolean(post.published)}
                        aria-label="Toggle published"
                        onCheckedChange={(checked) => togglePublished.mutate({ id: post.id, published: checked })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Preview" asChild>
                          <Link to={`/blog/${post.slug}`} target="_blank">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEditor(post)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Duplicate" onClick={() => duplicate.mutate(post.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(post)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit post" : "New post"}</DialogTitle>
            <DialogDescription>Markdown is supported in the body. Excerpts are used for cards and meta tags.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="post-title">Title</Label>
                <Input
                  id="post-title"
                  value={draft?.title ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                      slug: current?.id ? current.slug : slugify(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-slug">Slug</Label>
                <Input
                  id="post-slug"
                  value={draft?.slug ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, slug: slugify(event.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-category">Category</Label>
                <Input
                  id="post-category"
                  value={draft?.category ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-author">Author</Label>
                <Input
                  id="post-author"
                  value={draft?.author ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, author: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="post-image">Cover image URL</Label>
                <Input
                  id="post-image"
                  placeholder="https://…"
                  value={draft?.image ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, image: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="post-tags">Tags (comma separated)</Label>
                <Input id="post-tags" value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-excerpt">Excerpt</Label>
              <Textarea
                id="post-excerpt"
                rows={2}
                value={draft?.excerpt ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, excerpt: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-content">Body</Label>
              <Textarea
                id="post-content"
                rows={14}
                className="font-mono text-xs"
                value={draft?.content ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={Boolean(draft?.published)}
                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, published: checked }))}
                />
                Published
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={Boolean(draft?.featured)}
                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, featured: checked }))}
                />
                Featured
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={!draft?.title || save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.title}”?`}
        description="The post is removed from the site immediately. This cannot be undone."
        confirmLabel="Delete post"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </Card>
  );
};

export default AdminBlogManager;
