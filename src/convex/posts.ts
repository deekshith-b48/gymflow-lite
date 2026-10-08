import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { postKindValidator } from "./schema";
import { requireStaff } from "./staff";

/**
 * Content the workspace publishes: announcements, updates and internal notes,
 * each with an optional uploaded image. Image bytes live in Convex file
 * storage; only the storage id is kept on the post.
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
    includeDrafts: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);
    const posts = await ctx.db.query("posts").order("desc").take(100);

    const term = args.search?.trim().toLowerCase() ?? "";
    const visible = args.includeDrafts
      ? posts
      : posts.filter((post) => post.published);
    const filtered = term
      ? visible.filter((post) =>
          [post.title, post.body, post.authorName]
            .join(" ")
            .toLowerCase()
            .includes(term),
        )
      : visible;

    const items = await Promise.all(
      filtered.map(async (post) => ({
        ...post,
        imageUrl: post.imageId
          ? await ctx.storage.getUrl(post.imageId)
          : null,
        isMine: post.authorId === userId,
      })),
    );

    return {
      items,
      stats: {
        total: posts.length,
        published: posts.filter((post) => post.published).length,
        drafts: posts.filter((post) => !post.published).length,
        withImages: posts.filter((post) => post.imageId).length,
        mine: posts.filter((post) => post.authorId === userId).length,
      },
    };
  },
});

/** Call this first, then POST the file to the returned URL. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    kind: postKindValidator,
    imageId: v.optional(v.id("_storage")),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);

    const title = args.title.trim();
    if (!title) throw new Error("Give the post a title.");
    if (!args.body.trim()) throw new Error("Give the post some body text.");

    const author = await ctx.db.get(userId);

    return await ctx.db.insert("posts", {
      title,
      body: args.body.trim(),
      kind: args.kind,
      imageId: args.imageId,
      published: args.published,
      authorId: userId,
      authorName: author?.name ?? author?.email ?? "GymNetic operator",
    });
  },
});

export const togglePublish = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    await requireStaff(ctx);

    const post = await ctx.db.get(postId);
    if (!post) throw new Error("That post no longer exists.");

    await ctx.db.patch(postId, { published: !post.published });
  },
});

export const remove = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    await requireStaff(ctx);

    const post = await ctx.db.get(postId);
    if (!post) return;

    if (post.imageId) {
      await ctx.storage.delete(post.imageId);
    }
    await ctx.db.delete(postId);
  },
});
