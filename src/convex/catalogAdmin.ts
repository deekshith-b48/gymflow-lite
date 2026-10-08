import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { logActivity } from "./activity";
import { requireStaff } from "./staff";

/* ------------------------------------------------------------ packages */

/** All packages with the live active-member count per package. */
export const listPackages = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const [packages, members] = await Promise.all([
      ctx.db.query("packages").collect(),
      ctx.db.query("members").collect(),
    ]);

    const items = packages
      .map((pkg) => ({
        ...pkg,
        activeMembers: members.filter(
          (member) =>
            member.packageId === pkg._id ||
            (!member.packageId && member.plan === pkg.name.toLowerCase().replace(/\s+/g, "-")),
        ).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { items };
  },
});

export const upsertPackage = mutation({
  args: {
    packageId: v.optional(v.id("packages")),
    name: v.string(),
    kind: v.union(v.literal("gym"), v.literal("pt")),
    durationMonths: v.number(),
    gymFeeCents: v.number(),
    regFeeCents: v.number(),
    ptFeeCents: v.number(),
    includeGymFee: v.boolean(),
    includeRegFee: v.boolean(),
    includePtFee: v.boolean(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);
    const now = Date.now();

    if (args.durationMonths < 1 || args.durationMonths > 24) {
      throw new Error("Duration must be between 1 and 24 months.");
    }

    const payload = {
      name: args.name.trim(),
      kind: args.kind,
      durationMonths: args.durationMonths,
      gymFeeCents: args.gymFeeCents,
      regFeeCents: args.regFeeCents,
      ptFeeCents: args.ptFeeCents,
      includeGymFee: args.includeGymFee,
      includeRegFee: args.includeRegFee,
      includePtFee: args.includePtFee,
      details: args.details?.trim() || undefined,
      status: "active" as const,
      createdBy: userId,
      updatedAt: now,
    };

    if (args.packageId) {
      await ctx.db.patch(args.packageId, payload);
      await logActivity(ctx, {
        event: "updated",
        category: "packages",
        activity: `Updated package ${payload.name}`,
      });
      return args.packageId;
    }

    const packageId = await ctx.db.insert("packages", payload);
    await logActivity(ctx, {
      event: "created",
      category: "packages",
      activity: `Created package ${payload.name}`,
    });
    return packageId;
  },
});

export const archivePackage = mutation({
  args: { packageId: v.id("packages") },
  handler: async (ctx, { packageId }) => {
    await requireStaff(ctx);
    const pkg = await ctx.db.get(packageId);
    if (!pkg) throw new Error("That package no longer exists.");
    await ctx.db.patch(packageId, {
      status: pkg.status === "active" ? "archived" : "active",
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      event: "updated",
      category: "packages",
      activity: `${pkg.status === "active" ? "Archived" : "Restored"} package ${pkg.name}`,
    });
    return packageId;
  },
});

/* -------------------------------------------------------------- add-ons */

export const listAddOns = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const addOns = await ctx.db.query("addOns").collect();
    return {
      items: addOns.sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

export const upsertAddOn = mutation({
  args: {
    addOnId: v.optional(v.id("addOns")),
    name: v.string(),
    priceCents: v.number(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const now = Date.now();
    const payload = {
      name: args.name.trim(),
      priceCents: args.priceCents,
      details: args.details?.trim() || undefined,
      status: "active" as const,
      updatedAt: now,
    };

    if (args.addOnId) {
      await ctx.db.patch(args.addOnId, payload);
      await logActivity(ctx, {
        event: "updated",
        category: "addons",
        activity: `Updated add-on ${payload.name}`,
      });
      return args.addOnId;
    }

    const addOnId = await ctx.db.insert("addOns", payload);
    await logActivity(ctx, {
      event: "created",
      category: "addons",
      activity: `Created add-on ${payload.name}`,
    });
    return addOnId;
  },
});

export const archiveAddOn = mutation({
  args: { addOnId: v.id("addOns") },
  handler: async (ctx, { addOnId }) => {
    await requireStaff(ctx);
    const addOn = await ctx.db.get(addOnId);
    if (!addOn) throw new Error("That add-on no longer exists.");
    await ctx.db.patch(addOnId, {
      status: addOn.status === "active" ? "archived" : "active",
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      event: "updated",
      category: "addons",
      activity: `${addOn.status === "active" ? "Archived" : "Restored"} add-on ${addOn.name}`,
    });
    return addOnId;
  },
});

/* ------------------------------------------------------------ trainers */

/** Trainers with their assigned-member counts and this month's commission. */
export const listTrainers = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const [trainers, members, feeRecords] = await Promise.all([
      ctx.db.query("trainers").collect(),
      ctx.db.query("members").collect(),
      ctx.db.query("feeRecords").collect(),
    ]);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const items = trainers.map((trainer) => {
      const assigned = members.filter(
        (member) => member.trainerId === trainer._id,
      );
      const ptFeesThisMonth = feeRecords
        .filter(
          (record) =>
            record.trainerId === trainer._id &&
            record.kind === "pt" &&
            (record.paymentDate ?? record.createdAt) >= monthStart.getTime(),
        )
        .reduce((sum, record) => sum + record.paidCents, 0);
      const commissionCents = Math.round(
        (ptFeesThisMonth * trainer.commissionBps) / 10_000,
      );

      return {
        ...trainer,
        memberCount: assigned.length,
        commissionCents,
        monthlyCostCents: trainer.salaryCents + commissionCents,
      };
    });

    return {
      items,
      stats: {
        active: items.filter((item) => item.status === "active").length,
        membersAssigned: items.reduce((sum, item) => sum + item.memberCount, 0),
        totalCostCents: items.reduce((sum, item) => sum + item.monthlyCostCents, 0),
      },
    };
  },
});

export const upsertTrainer = mutation({
  args: {
    trainerId: v.optional(v.id("trainers")),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    specialty: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    commissionBps: v.number(),
    salaryCents: v.number(),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const now = Date.now();
    const payload = {
      name: args.name.trim(),
      email: args.email?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      specialty: args.specialty?.trim() || undefined,
      status: args.status,
      commissionBps: args.commissionBps,
      salaryCents: args.salaryCents,
      updatedAt: now,
    };

    if (args.trainerId) {
      await ctx.db.patch(args.trainerId, payload);
      await logActivity(ctx, {
        event: "updated",
        category: "staff",
        activity: `Updated trainer ${payload.name}`,
      });
      return args.trainerId;
    }

    const trainerId = await ctx.db.insert("trainers", {
      ...payload,
      joinedAt: now,
    });
    await logActivity(ctx, {
      event: "created",
      category: "staff",
      activity: `Added trainer ${payload.name}`,
    });
    return trainerId;
  },
});

export const removeTrainer = mutation({
  args: { trainerId: v.id("trainers") },
  handler: async (ctx, { trainerId }) => {
    await requireStaff(ctx);
    const trainer = await ctx.db.get(trainerId);
    if (!trainer) return;
    await ctx.db.delete(trainerId);
    await logActivity(ctx, {
      event: "deleted",
      category: "staff",
      activity: `Deleted trainer ${trainer.name}`,
    });
  },
});

/** A trainer's profile: person, assigned members and PT payment history. */
export const getTrainer = query({
  args: { trainerId: v.id("trainers") },
  handler: async (ctx, { trainerId }) => {
    await requireStaff(ctx);
    const trainer = await ctx.db.get(trainerId);
    if (!trainer) return null;

    const [members, feeRecords] = await Promise.all([
      ctx.db.query("members").collect(),
      ctx.db.query("feeRecords").collect(),
    ]);

    const assigned = members
      .filter((member) => member.trainerId === trainerId)
      .map((member) => ({
        _id: member._id,
        name: member.name,
        memberCode: member.memberCode ?? null,
        status: member.status,
      }));

    const payments = feeRecords
      .filter((record) => record.trainerId === trainerId && record.kind === "pt")
      .sort((a, b) => b.periodStart - a.periodStart)
      .map((record) => {
        const trainerShare = Math.round(
          (record.paidCents * trainer.commissionBps) / 10_000,
        );
        return {
          _id: record._id,
          memberName: record.memberName,
          periodStart: record.periodStart,
          periodEnd: record.periodEnd,
          ptFeeCents: record.ptFeeCents ?? record.paidCents,
          commissionBps: trainer.commissionBps,
          trainerShareCents: trainerShare,
          gymShareCents: record.paidCents - trainerShare,
          status: record.status,
        };
      });

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const collectedThisMonth = feeRecords
      .filter(
        (record) =>
          record.trainerId === trainerId &&
          record.kind === "pt" &&
          (record.paymentDate ?? record.createdAt) >= thisMonthStart.getTime(),
      )
      .reduce((sum, record) => sum + record.paidCents, 0);
    const commissionCents = Math.round(
      (collectedThisMonth * trainer.commissionBps) / 10_000,
    );

    return {
      trainer: { ...trainer, memberCount: assigned.length },
      assigned,
      payments,
      financial: {
        assignedCount: assigned.length,
        salaryCents: trainer.salaryCents,
        commissionCents,
        gymRevenueCents: collectedThisMonth - commissionCents,
        totalThisMonthCents: trainer.salaryCents + commissionCents,
      },
    };
  },
});
