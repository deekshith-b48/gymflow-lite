import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  categoryTone,
  formatRecency,
  postKindLabel,
  POST_KIND_OPTIONS,
  type PostKind,
} from "@/lib/gym";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * The workspace feed. Operators publish announcements and upload images; the
 * bytes go to Convex file storage and the post keeps the storage id.
 */
export default function Feed() {
  const [search, setSearch] = useState("");
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [kind, setKind] = useState<PostKind>("announcement");
  const [published, setPublished] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const feed = useQuery(api.posts.list, { search, includeDrafts });
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const createPost = useMutation(api.posts.create);
  const togglePublish = useMutation(api.posts.togglePublish);
  const removePost = useMutation(api.posts.remove);

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    // Hold the element: after the awaits below, `currentTarget` is no longer
    // guaranteed to point at the form.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();

    if (!title || !body) {
      toast.error("A title and some body text are required.");
      setSaving(false);
      return;
    }

    try {
      let imageId: Id<"_storage"> | undefined;
      if (file) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) throw new Error("The image upload failed.");
        const payload = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        imageId = payload.storageId;
      }

      await createPost({ title, body, kind, published, imageId });

      toast.success(published ? "Published to the feed" : "Saved as a draft", {
        description: title,
      });
      setFile(null);
      formElement.reset();
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not save the post.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(postId: Id<"posts">, title: string) {
    setBusyId(postId);
    try {
      await togglePublish({ postId });
      toast.success(`${title} visibility updated`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not update the post.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(postId: Id<"posts">, title: string) {
    setBusyId(postId);
    try {
      await removePost({ postId });
      toast(`${title} deleted`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not delete the post.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="eyebrow">Feed</p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight">
          Content &amp; uploads
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {feed
            ? `${feed.stats.published} published · ${feed.stats.drafts} drafts · ${feed.stats.withImages} with images`
            : "Loading the feed…"}
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="eyebrow">Compose</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
          <div className="grid gap-2">
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              name="title"
              placeholder="New morning class added to the schedule"
              autoComplete="off"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="post-body">Body</Label>
            <Textarea
              id="post-body"
              name="body"
              rows={4}
              placeholder="Say what changed, who it affects and when it starts."
              className="resize-none"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="post-kind">Type</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as PostKind)}
              >
                <SelectTrigger id="post-kind" className="w-full">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {POST_KIND_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="post-published">Visibility</Label>
              <div className="flex h-9 items-center gap-3 rounded-md border border-input px-3">
                <Switch
                  id="post-published"
                  checked={published}
                  onCheckedChange={setPublished}
                />
                <span className="text-sm text-muted-foreground">
                  {published ? "Publish now" : "Keep as draft"}
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="post-image">Image</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="post-image"
                  type="file"
                  accept="image/*"
                  className="h-9 cursor-pointer py-1 text-xs shadow-none file:mr-2 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:text-secondary-foreground"
                  onChange={(event) =>
                    setFile(event.target.files?.[0] ?? null)
                  }
                />
                {file && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove image"
                    onClick={() => setFile(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {previewUrl && (
            <div className="flex items-center gap-3">
              <img
                src={previewUrl}
                alt="Upload preview"
                className="size-16 rounded-md border border-border object-cover"
              />
              <p className="text-xs text-muted-foreground">
                {file?.name} will be stored in Convex file storage.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : file ? (
                <Upload className="size-4" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              {published ? "Publish post" : "Save draft"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Posts are visible to every operator in this workspace.
            </span>
          </div>
        </form>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search posts and authors"
          className="shadow-none"
          autoComplete="off"
        />
        <div className="flex items-center gap-3 rounded-md border border-input px-3 py-2">
          <Switch
            id="feed-drafts"
            checked={includeDrafts}
            onCheckedChange={setIncludeDrafts}
          />
          <Label htmlFor="feed-drafts" className="text-sm text-muted-foreground">
            Include drafts
          </Label>
        </div>
      </div>

      {feed === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : feed.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm font-medium">Nothing posted yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Write the first update above — add an image and it uploads straight
            to storage.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {feed.items.map((post, index) => (
            <motion.li
              key={post._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.03 }}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                    categoryTone(post.kind),
                  )}
                >
                  {postKindLabel(post.kind)}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-mono text-[10px]",
                    post.published
                      ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {post.published ? "published" : "draft"}
                </span>
                <span className="figure ml-auto text-[11px] text-muted-foreground">
                  {post.authorName} · {formatRecency(post._creationTime)}
                </span>
              </div>

              <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row">
                {post.imageUrl && (
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="h-40 w-full rounded-lg border border-border object-cover sm:w-56"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {post.title}
                  </h2>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {post.body}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-border px-5 py-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="shadow-none"
                  disabled={busyId === post._id}
                  onClick={() => handleToggle(post._id, post.title)}
                >
                  {busyId === post._id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : post.published ? (
                    "Unpublish"
                  ) : (
                    "Publish"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto gap-2 text-muted-foreground hover:text-rose-300"
                  disabled={busyId === post._id}
                  onClick={() => handleRemove(post._id, post.title)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
