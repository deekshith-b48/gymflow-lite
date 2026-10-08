import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logActivity } from "./activity";
import { requireStaff } from "./staff";

/** Seed shapes for the four automated rules and the system templates. */
const RULE_SEED = [
  {
    key: "expiry",
    name: "Membership expiring soon",
    description: "Reminders before a membership lapses",
    triggers: ["3 days before", "On expiry day", "2 days after expiry"],
    channels: ["email", "whatsapp"] as ("email" | "whatsapp")[],
    templateKey: "expiry",
    enabled: true,
  },
  {
    key: "inactive",
    name: "Inactive member",
    description: "Sent when a member hasn't checked in",
    triggers: ["Inactive for 14 days"],
    channels: ["email", "whatsapp"] as ("email" | "whatsapp")[],
    templateKey: "inactive",
    enabled: true,
  },
  {
    key: "payment",
    name: "Payment received",
    description: "Sent after a payment is recorded",
    triggers: ["On payment"],
    channels: ["email", "whatsapp"] as ("email" | "whatsapp")[],
    templateKey: "receipt",
    enabled: true,
  },
  {
    key: "welcome",
    name: "Welcome new member",
    description: "Sent when a new member registers",
    triggers: ["On registration"],
    channels: ["email", "whatsapp"] as ("email" | "whatsapp")[],
    templateKey: "welcome",
    enabled: true,
  },
];

const TEMPLATE_SEED = [
  {
    key: "birthday",
    name: "Birthday",
    channels: ["email"] as ("email" | "whatsapp")[],
    subject: "Happy birthday from your gym family!",
    body: "Happy birthday! Your next visit is on us — come train with us this week.",
  },
  {
    key: "expiry",
    name: "Membership expiry reminder",
    channels: ["email", "whatsapp"] as ("email" | "whatsapp")[],
    subject: "Your membership expires soon",
    body: "Hi {name}, your {package} membership expires on {date}. Renew now to keep your slot.",
  },
  {
    key: "closure",
    name: "Gym closure",
    channels: ["email", "whatsapp"] as ("email" | "whatsapp")[],
    subject: "Planned closure notice",
    body: "The gym will be closed on {date} for maintenance. Regular hours resume the next day.",
  },
  {
    key: "inactive",
    name: "Inactive member re-engagement",
    channels: ["email", "whatsapp"] as ("email" | "whatsapp")[],
    subject: "We haven't seen you lately",
    body: "Hi {name}, it's been 14 days since your last visit. Your trainer has a plan ready when you're back.",
  },
  {
    key: "offer",
    name: "Package offer",
    channels: ["email", "whatsapp"] as ("email" | "whatsapp")[],
    subject: "A package deal for you",
    body: "Upgrade this month and get {discount} off the {package} package. Reply YES to claim.",
  },
  {
    key: "receipt",
    name: "Payment receipt",
    channels: ["email"] as ("email" | "whatsapp")[],
    subject: "Payment received",
    body: "We received Rs {amount} on {date}. Balance: Rs {balance}. Thank you!",
  },
  {
    key: "welcome",
    name: "Welcome new member",
    channels: ["email", "whatsapp"] as ("email" | "whatsapp")[],
    subject: "Welcome to the gym!",
    body: "Welcome aboard, {name}! Your first session with a trainer is free — book at the front desk.",
  },
];

/** All five tabs read from these two queries: rules, templates, history. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const [ruleRows, templateRows, historyRows, settingsRow] = await Promise.all([
      ctx.db.query("notificationRules").collect(),
      ctx.db.query("notificationTemplates").collect(),
      ctx.db.query("messageHistory").withIndex("by_at").order("desc").take(300),
      ctx.db
        .query("gymSettings")
        .withIndex("by_key", (q) => q.eq("key", "gym"))
        .first(),
    ]);

    const rules = RULE_SEED.map(
      (seed) => ruleRows.find((row) => row.key === seed.key) ?? seed,
    ).map((row) => ({
      key: row.key,
      name: row.name,
      description: row.description,
      triggers: row.triggers,
      channels: row.channels,
      templateKey: row.templateKey,
      enabled: row.enabled,
    }));

    const templates = TEMPLATE_SEED.map(
      (seed) => templateRows.find((row) => row.key === seed.key) ?? seed,
    ).map((row) => ({
      key: row.key,
      name: row.name,
      channels: row.channels,
      subject: row.subject ?? null,
      body: row.body,
    }));

    const now = Date.now();
    const hourStart = now - 3_600_000;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const sent = historyRows.filter((row) => row.status !== "failed");
    const usage = {
      thisHour: sent.filter((row) => row.at >= hourStart).length,
      hourLimit: 40,
      today: sent.filter((row) => row.at >= dayStart.getTime()).length,
      dayLimit: 50,
      thisMonth: sent.filter((row) => row.at >= monthStart.getTime()).length,
      monthLimit: 500,
    };

    return {
      rules,
      templates,
      history: historyRows.map((row) => ({
        _id: row._id,
        at: row.at,
        type: row.type,
        trigger: row.trigger,
        channel: row.channel,
        recipients: row.recipients,
        status: row.status,
        subject: row.subject ?? null,
        audience: row.audience ?? null,
      })),
      whatsapp: {
        number: settingsRow?.whatsappNumber ?? null,
        connected: settingsRow?.whatsappConnected ?? false,
      },
      usage,
      notificationsEnabled: settingsRow?.notificationsEnabled ?? true,
    };
  },
});

export const toggleRule = mutation({
  args: { key: v.string(), enabled: v.boolean() },
  handler: async (ctx, { key, enabled }) => {
    await requireStaff(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("notificationRules")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    const seed = RULE_SEED.find((rule) => rule.key === key);
    if (!seed) throw new Error("Unknown notification rule.");

    if (existing) {
      await ctx.db.patch(existing._id, { enabled, updatedAt: now });
    } else {
      await ctx.db.insert("notificationRules", { ...seed, enabled, updatedAt: now });
    }

    await logActivity(ctx, {
      event: "updated",
      category: "settings",
      activity: `${enabled ? "Enabled" : "Disabled"} automated rule: ${seed.name}`,
    });
    return key;
  },
});

export const toggleAllNotifications = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    await requireStaff(ctx);
    const now = Date.now();
    const settingsRow = await ctx.db
      .query("gymSettings")
      .withIndex("by_key", (q) => q.eq("key", "gym"))
      .first();
    if (settingsRow) {
      await ctx.db.patch(settingsRow._id, {
        notificationsEnabled: enabled,
        updatedAt: now,
      });
    }
    await logActivity(ctx, {
      event: "updated",
      category: "settings",
      activity: `${enabled ? "Enabled" : "Disabled"} all notifications`,
    });
    return enabled;
  },
});

export const setWhatsappConnected = mutation({
  args: { connected: v.boolean(), number: v.optional(v.string()) },
  handler: async (ctx, { connected, number }) => {
    await requireStaff(ctx);
    const now = Date.now();
    const settingsRow = await ctx.db
      .query("gymSettings")
      .withIndex("by_key", (q) => q.eq("key", "gym"))
      .first();
    if (settingsRow) {
      await ctx.db.patch(settingsRow._id, {
        whatsappConnected: connected,
        ...(number ? { whatsappNumber: number } : {}),
        updatedAt: now,
      });
    }
    await logActivity(ctx, {
      event: "updated",
      category: "settings",
      activity: `${connected ? "Connected" : "Disconnected"} WhatsApp device${number ? ` ${number}` : ""}`,
    });
    return connected;
  },
});

/** Queue a broadcast: recorded in the outbox as pending for the worker. */
export const sendMessage = mutation({
  args: {
    audience: v.string(),
    channels: v.array(v.union(v.literal("email"), v.literal("whatsapp"))),
    subject: v.optional(v.string()),
    body: v.string(),
    recipients: v.number(),
    custom: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    if (args.recipients <= 0) throw new Error("No recipients match that audience.");
    if (!args.body.trim()) throw new Error("Message body is required.");

    const now = Date.now();
    for (const channel of args.channels) {
      await ctx.db.insert("messageHistory", {
        at: now,
        type: "manual",
        trigger: args.subject?.trim() || "Broadcast",
        channel,
        recipients: args.recipients,
        status: "pending",
        subject: args.custom ? undefined : args.subject?.trim() || undefined,
        audience: args.audience,
      });
    }

    await logActivity(ctx, {
      event: "created",
      category: "settings",
      activity: `Queued ${args.channels.join(" + ")} message to ${args.recipients} recipients (${args.audience})`,
    });
    return now;
  },
});

export const clearHistory = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("messageHistory").collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});
