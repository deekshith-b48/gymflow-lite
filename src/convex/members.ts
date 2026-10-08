import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { memberStatusValidator } from "./schema";
import { logActivity } from "./activity";
import { requireStaff } from "./staff";
import { nextMemberCode } from "./settings";
import {
  addDays,
  duesInfo,
  isPlanId,
  planDurationDays,
  planLabel,
  planPriceCents,
  startOfDay,
} from "../lib/gym";

const DAY_MS = 86_400_000;

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Storage upload URL for member photos (client posts the file directly). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** The roster: filtered members, each with plan label, dues state and last visit. */
export const list = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    type: v.optional(v.string()), // member | staff | all
    package: v.optional(v.string()), // package name | all
    expiring: v.optional(v.string()), // 7 | 30 | all
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const now = Date.now();
    const [members, recentCheckIns, packages] = await Promise.all([
      ctx.db.query("members").collect(),
      // enough recent visits to know when each member last trained.
      ctx.db.query("checkIns").withIndex("by_at").order("desc").take(400),
      ctx.db.query("packages").collect(),
    ]);

    const lastVisit = new Map<string, number>();
    for (const checkIn of recentCheckIns) {
      const key = String(checkIn.memberId);
      if (!lastVisit.has(key)) lastVisit.set(key, checkIn.at);
    }

    const term = args.search?.trim().toLowerCase() ?? "";
    const status =
      args.status && args.status !== "all" ? args.status : null;

    const items = members
      .filter((member) => {
        if (status && member.status !== status) return false;
        if (args.type && args.type !== "all" && (member.memberType ?? "member") !== args.type)
          return false;
        if (args.package && args.package !== "all") {
          const pkg = packages.find((entry) => entry._id === member.packageId);
          const label = pkg?.name ?? planLabel(member.plan);
          if (label !== args.package) return false;
        }
        if (args.expiring && args.expiring !== "all") {
          const days = Math.ceil((member.renewsAt - now) / DAY_MS);
          const window = Number(args.expiring);
          if (!(days >= 0 && days <= window)) return false;
        }
        if (!term) return true;
        return [member.name, member.email ?? "", member.phone ?? "", member.memberCode ?? ""].some(
          (field) => field.toLowerCase().includes(term),
        );
      })
      .map((member) => {
        const pkg = packages.find((entry) => entry._id === member.packageId);
        return {
          ...member,
          planLabel: pkg?.name ?? planLabel(member.plan),
          dues: duesInfo(member.duesAmountCents, member.duesDueAt, now),
          lastCheckInAt: lastVisit.get(String(member._id)) ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const stats = {
      total: members.length,
      active: members.filter((member) => member.status === "active").length,
      newThisMonth: members.filter(
        (member) => member.joinedAt >= monthStart.getTime(),
      ).length,
      regFeeCollectedCents: members.reduce(
        (sum, member) => sum + (member.regFeeCents ?? 0),
        0,
      ),
      // Audience estimates for the notifications composer, resolved server-side
      // so the page itself never reads the clock during render.
      expiringSoon: members.filter((member) => {
        const days = Math.ceil((member.renewsAt - now) / DAY_MS);
        return days >= 0 && days <= 7;
      }).length,
      inactive14d: members.filter(
        (member) =>
          lastVisit.has(String(member._id)) === false ||
          (lastVisit.get(String(member._id)) ?? 0) < now - 14 * DAY_MS,
      ).length,
      overdue: members.filter(
        (member) =>
          duesInfo(member.duesAmountCents, member.duesDueAt, now).state ===
          "overdue",
      ).length,
      duesOutstandingCents: members.reduce(
        (sum, member) => sum + Math.max(0, member.duesAmountCents),
        0,
      ),
      packageNames: Array.from(
        new Set(
          members.map((member) => {
            const pkg = packages.find((entry) => entry._id === member.packageId);
            return pkg?.name ?? planLabel(member.plan);
          }),
        ),
      ).sort(),
    };

    return { items, stats };
  },
});

/** A single member's home screen: plan & dues, recent visits, visit totals. */
export const get = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    await requireStaff(ctx);

    const member = await ctx.db.get(memberId);
    if (!member) return null;

    const now = Date.now();
    const [visits, recent] = await Promise.all([
      ctx.db
        .query("checkIns")
        .withIndex("by_member", (q) => q.eq("memberId", memberId))
        .collect(),
      ctx.db
        .query("checkIns")
        .withIndex("by_member_at", (q) => q.eq("memberId", memberId))
        .order("desc")
        .take(10),
    ]);

    const lastVisitAt = recent[0]?.at ?? null;

    return {
      member: {
        ...member,
        planLabel: planLabel(member.plan),
        dues: duesInfo(member.duesAmountCents, member.duesDueAt, now),
      },
      checkIns: recent,
      stats: {
        totalVisits: visits.length,
        visits30d: visits.filter((visit) => visit.at >= now - 30 * DAY_MS)
          .length,
        lastVisitAt,
        checkedInToday:
          lastVisitAt !== null && startOfDay(lastVisitAt) === startOfDay(now),
      },
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    plan: v.string(),
    // false records the first cycle as owed, which is how a member who joins
    // and pays later shows up in the dues list.
    firstPaymentCollected: v.boolean(),
    startedAt: v.optional(v.number()),
    note: v.optional(v.string()),
    // profile extras from the full add-member form.
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    dob: v.optional(v.number()),
    cnic: v.optional(v.string()),
    address: v.optional(v.string()),
    memberType: v.optional(v.union(v.literal("member"), v.literal("staff"))),
    regFeeCents: v.optional(v.number()),
    addOns: v.optional(v.array(v.string())),
    packageId: v.optional(v.id("packages")),
    trainerId: v.optional(v.id("trainers")),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const staffId = await requireStaff(ctx);

    const name = args.name.trim();
    if (!name) throw new Error("A member name is required.");
    if (!isPlanId(args.plan)) throw new Error("Pick a plan from the list.");

    const now = Date.now();
    const startedAt = args.startedAt ?? now;
    const priceCents = planPriceCents(args.plan);
    const duesAmountCents = args.firstPaymentCollected ? 0 : priceCents;
    const memberCode = await nextMemberCode(ctx);

    const memberId = await ctx.db.insert("members", {
      name,
      email: clean(args.email),
      phone: clean(args.phone),
      plan: args.plan,
      planPriceCents: priceCents,
      planStartedAt: startedAt,
      renewsAt: addDays(startedAt, planDurationDays(args.plan)),
      duesAmountCents,
      duesDueAt: duesAmountCents > 0 ? now : undefined,
      status: "active",
      joinedAt: now,
      note: clean(args.note),
      createdBy: staffId,
      memberCode,
      gender: args.gender,
      dob: args.dob,
      cnic: clean(args.cnic),
      address: clean(args.address),
      memberType: args.memberType ?? "member",
      regFeeCents: args.regFeeCents ?? 0,
      addOns: args.addOns?.length ? args.addOns : undefined,
      packageId: args.packageId,
      trainerId: args.trainerId,
      photoStorageId: args.photoStorageId,
    });

    await logActivity(ctx, {
      event: "created",
      category: "members",
      activity: `Added member ${name} (${memberCode})`,
    });
    return memberId;
  },
});

export const update = mutation({
  args: {
    memberId: v.id("members"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    plan: v.optional(v.string()),
    status: v.optional(memberStatusValidator),
    note: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    dob: v.optional(v.number()),
    cnic: v.optional(v.string()),
    address: v.optional(v.string()),
    memberType: v.optional(v.union(v.literal("member"), v.literal("staff"))),
    addOns: v.optional(v.array(v.string())),
    trainerId: v.optional(v.id("trainers")),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("That member no longer exists.");

    const patch: Partial<Doc<"members">> = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("A member name is required.");
      patch.name = name;
    }
    // An empty string clears an optional field.
    if (args.email !== undefined) patch.email = clean(args.email);
    if (args.phone !== undefined) patch.phone = clean(args.phone);
    if (args.note !== undefined) patch.note = clean(args.note);
    if (args.status !== undefined) patch.status = args.status;
    if (args.gender !== undefined) patch.gender = args.gender;
    if (args.dob !== undefined) patch.dob = args.dob;
    if (args.cnic !== undefined) patch.cnic = clean(args.cnic);
    if (args.address !== undefined) patch.address = clean(args.address);
    if (args.memberType !== undefined) patch.memberType = args.memberType;
    if (args.addOns !== undefined) patch.addOns = args.addOns.length ? args.addOns : undefined;
    if (args.trainerId !== undefined) patch.trainerId = args.trainerId;
    if (args.photoStorageId !== undefined)
      patch.photoStorageId = args.photoStorageId;
    if (args.status !== undefined && args.status === "frozen") {
      patch.frozenAt = Date.now();
    }
    if (args.status !== undefined && args.status === "active") {
      patch.frozenAt = undefined;
    }

    if (args.plan !== undefined && args.plan !== member.plan) {
      if (!isPlanId(args.plan)) throw new Error("Pick a plan from the list.");
      const now = Date.now();
      patch.plan = args.plan;
      // keep the stored price as the agreed rate and restart the cycle.
      patch.planPriceCents = planPriceCents(args.plan);
      patch.planStartedAt = now;
      patch.renewsAt = addDays(now, planDurationDays(args.plan));
    }

    await ctx.db.patch(args.memberId, patch);

    await logActivity(ctx, {
      event: "updated",
      category: "members",
      activity: `Updated member ${member.name}${args.status ? ` — status ${args.status}` : ""}`,
    });
  },
});

/** One-tap lifecycle actions: freeze today, unfreeze back to active. */
export const setLifecycle = mutation({
  args: {
    memberId: v.id("members"),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("expired"),
      v.literal("frozen"),
    ),
  },
  handler: async (ctx, { memberId, status }) => {
    await requireStaff(ctx);
    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("That member no longer exists.");

    await ctx.db.patch(memberId, {
      status,
      frozenAt: status === "frozen" ? Date.now() : undefined,
    });

    await logActivity(ctx, {
      event: "updated",
      category: "members",
      activity: `${status === "frozen" ? "Froze" : "Set"} ${member.name}'s membership to ${status}`,
    });
    return memberId;
  },
});

export const remove = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    await requireStaff(ctx);

    const member = await ctx.db.get(memberId);
    if (!member) return;

    const checkIns = await ctx.db
      .query("checkIns")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .collect();
    for (const checkIn of checkIns) {
      await ctx.db.delete(checkIn._id);
    }

    await ctx.db.delete(memberId);

    await logActivity(ctx, {
      event: "deleted",
      category: "members",
      activity: `Removed member ${member.name} from the roster`,
    });
  },
});

/**
 * Dues collected at the desk: clears the balance and, if the renewal date has
 * already passed, opens a fresh cycle from today.
 */
export const settleDues = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    await requireStaff(ctx);

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("That member no longer exists.");

    const now = Date.now();
    const renewing = member.renewsAt <= now;

    await ctx.db.patch(memberId, {
      duesAmountCents: 0,
      duesDueAt: undefined,
      planStartedAt: renewing ? now : member.planStartedAt,
      renewsAt: renewing
        ? addDays(now, planDurationDays(member.plan))
        : member.renewsAt,
    });
  },
});

type DemoMember = {
  name: string;
  email: string;
  phone?: string;
  plan: string;
  status: "active" | "paused" | "cancelled";
  joinedDaysAgo: number;
  planStartedDaysAgo: number;
  duesAmountCents: number;
  duesInDays?: number;
};

/**
 * A few members so a fresh gym is not an empty screen. Inserted once; the
 * `meta` flag means deleting the roster later does not bring them back.
 */
const DEMO_ROSTER: DemoMember[] = [
  {
    name: "Amara Osei",
    email: "amara.osei@example.com",
    phone: "(415) 555-0132",
    plan: "annual",
    status: "active",
    joinedDaysAgo: 512,
    planStartedDaysAgo: 128,
    duesAmountCents: 0,
  },
  {
    name: "Ben Nakamura",
    email: "ben.nakamura@example.com",
    phone: "(415) 555-0177",
    plan: "monthly",
    status: "active",
    joinedDaysAgo: 214,
    planStartedDaysAgo: 35,
    duesAmountCents: 4900,
    duesInDays: -5,
  },
  {
    name: "Chloé Adeyemi",
    email: "chloe.adeyemi@example.com",
    phone: "(415) 555-0193",
    plan: "quarterly",
    status: "active",
    joinedDaysAgo: 96,
    planStartedDaysAgo: 83,
    duesAmountCents: 0,
  },
  {
    name: "Dev Ramachandran",
    email: "dev.r@example.com",
    plan: "monthly",
    status: "active",
    joinedDaysAgo: 61,
    planStartedDaysAgo: 27,
    duesAmountCents: 4900,
    duesInDays: 3,
  },
  {
    name: "Elena Petrova",
    email: "elena.petrova@example.com",
    phone: "(415) 555-0148",
    plan: "monthly",
    status: "paused",
    joinedDaysAgo: 342,
    planStartedDaysAgo: 12,
    duesAmountCents: 0,
  },
  {
    name: "Farid Haddad",
    email: "farid.haddad@example.com",
    phone: "(415) 555-0165",
    plan: "monthly",
    status: "active",
    joinedDaysAgo: 128,
    planStartedDaysAgo: 4,
    duesAmountCents: 0,
  },
  {
    name: "Grace Lindqvist",
    email: "grace.l@example.com",
    phone: "(415) 555-0110",
    plan: "day",
    status: "active",
    joinedDaysAgo: 9,
    planStartedDaysAgo: 1,
    duesAmountCents: 1500,
    duesInDays: -1,
  },
  {
    name: "Hana Takahashi",
    email: "hana.takahashi@example.com",
    phone: "(415) 555-0188",
    plan: "quarterly",
    status: "active",
    joinedDaysAgo: 274,
    planStartedDaysAgo: 66,
    duesAmountCents: 0,
  },
];

/** Stable per-member visit rhythm so the demo history looks the same every load. */
function demoVisits(memberIndex: number, now: number) {
  const todayStart = startOfDay(now);
  const visits: number[] = [];

  for (let dayBack = 0; dayBack < 7; dayBack += 1) {
    const dayStart = addDays(todayStart, -dayBack);
    const visitsToday = dayBack === 0 ? memberIndex % 3 === 0 : null;
    const shouldVisit =
      visitsToday ?? (dayBack + memberIndex) % (1 + (memberIndex % 3)) === 0;
    if (!shouldVisit) continue;

    const hour = memberIndex % 2 === 0 ? 7 : 18;
    const at = dayStart + hour * 3_600_000 + (memberIndex % 5) * 9 * 60_000;
    if (at <= now) visits.push(at);
  }

  return visits.reverse();
}

export const seedDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const staffId = await requireStaff(ctx);
    const now = Date.now();

    const seeded = await ctx.db
      .query("meta")
      .withIndex("by_key", (q) => q.eq("key", "demo-seeded"))
      .first();
    if (seeded) return { seeded: false };

    const existing = await ctx.db.query("members").first();
    if (existing) {
      await ctx.db.insert("meta", { key: "demo-seeded", value: String(now) });
      return { seeded: false };
    }

    for (const [index, person] of DEMO_ROSTER.entries()) {
      const planStartedAt = addDays(now, -person.planStartedDaysAgo);
      const memberId = await ctx.db.insert("members", {
        name: person.name,
        email: person.email,
        phone: person.phone,
        plan: person.plan,
        planPriceCents: planPriceCents(person.plan),
        planStartedAt,
        renewsAt: addDays(planStartedAt, planDurationDays(person.plan)),
        duesAmountCents: person.duesAmountCents,
        duesDueAt:
          person.duesAmountCents > 0
            ? addDays(now, person.duesInDays ?? 7)
            : undefined,
        status: person.status,
        joinedAt: addDays(now, -person.joinedDaysAgo),
        createdBy: staffId,
      });

      for (const at of demoVisits(index, now)) {
        await ctx.db.insert("checkIns", {
          memberId,
          at,
          recordedBy: staffId,
        });
      }
    }

    await ctx.db.insert("meta", { key: "demo-seeded", value: String(now) });
    return { seeded: true };
  },
});
