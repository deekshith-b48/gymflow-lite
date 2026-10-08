/**
 * Shared gym domain helpers.
 *
 * Kept as plain functions with no React or Convex imports so the same rules are
 * used by the Convex backend (dues state, plan renewal dates) and the frontend
 * (labels, money and date formatting). Divergence between the two would show up
 * as a member the desk thinks is paid up but the roster flags as overdue.
 */

export const DAY_MS = 86_400_000;

export const PLAN_OPTIONS = [
  {
    id: "day",
    label: "Day pass",
    priceCents: 1500,
    durationDays: 1,
    blurb: "Single visit",
  },
  {
    id: "monthly",
    label: "Monthly",
    priceCents: 4900,
    durationDays: 30,
    blurb: "Rolling month",
  },
  {
    id: "quarterly",
    label: "Quarterly",
    priceCents: 12900,
    durationDays: 90,
    blurb: "Save 12%",
  },
  {
    id: "annual",
    label: "Annual",
    priceCents: 44900,
    durationDays: 365,
    blurb: "Save 24%",
  },
] as const;

export type PlanId = (typeof PLAN_OPTIONS)[number]["id"];

const PLAN_BY_ID = new Map(PLAN_OPTIONS.map((plan) => [plan.id, plan]));

export function planOption(planId: string) {
  return PLAN_BY_ID.get(planId as PlanId) ?? PLAN_OPTIONS[1];
}

export function planLabel(planId: string) {
  return planOption(planId).label;
}

export function planPriceCents(planId: string) {
  return planOption(planId).priceCents;
}

export function planDurationDays(planId: string) {
  return planOption(planId).durationDays;
}

/** Price shown per month, so plans are comparable at a glance. */
export function monthlyPriceCents(planId: string) {
  const plan = planOption(planId);
  return Math.round((plan.priceCents / plan.durationDays) * 30);
}

export function isPlanId(value: string): value is PlanId {
  return PLAN_BY_ID.has(value as PlanId);
}

export const MEMBER_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type MemberStatus = (typeof MEMBER_STATUS_OPTIONS)[number]["value"];

/* ------------------------------------------------------------------ dates */

export function startOfDay(ms: number) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function addDays(ms: number, days: number) {
  return ms + days * DAY_MS;
}

/** Whole days from `now` until `ms` (negative when `ms` is in the past). */
export function daysUntil(ms: number, now: number = Date.now()) {
  return Math.round((startOfDay(ms) - startOfDay(now)) / DAY_MS);
}

export function formatDate(ms: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

export function formatShortDate(ms: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(ms));
}

export function formatTime(ms: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function formatDateTime(ms: number) {
  return `${formatShortDate(ms)} · ${formatTime(ms)}`;
}

/** "Today 8:12 AM", "Yesterday", "3d ago", or a short date. */
export function formatVisit(ms: number | null | undefined, now: number = Date.now()) {
  if (!ms) return "No visits yet";
  const delta = daysUntil(ms, now);
  if (delta === 0) return `Today · ${formatTime(ms)}`;
  if (delta === -1) return "Yesterday";
  if (delta < -1 && delta > -7) return `${Math.abs(delta)}d ago`;
  return formatShortDate(ms);
}

/** "today" / "yesterday" / "5d ago" — used where a full date is already shown. */
export function formatRecency(ms: number, now: number = Date.now()) {
  const delta = daysUntil(ms, now);
  if (delta === 0) return "today";
  if (delta === -1) return "yesterday";
  return `${Math.abs(delta)}d ago`;
}

export function formatRenewal(renewsAt: number, now: number = Date.now()) {
  const delta = daysUntil(renewsAt, now);
  if (delta === 0) return "Renews today";
  if (delta < 0) return `Lapsed ${Math.abs(delta)}d ago`;
  if (delta <= 31) return `Renews in ${delta}d`;
  return `Renews ${formatShortDate(renewsAt)}`;
}

/* ------------------------------------------------------------------- money */

export function formatMoney(cents: number) {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/* -------------------------------------------------------------------- dues */

export type DuesState = "paid" | "due" | "overdue";

export type DuesInfo = {
  state: DuesState;
  label: string;
  days: number;
};

/**
 * A member is "paid" when nothing is owed. An open balance is "overdue" once
 * its due date has passed, otherwise "due" (with a short label for badges).
 */
export function duesInfo(
  amountCents: number,
  dueAt: number | undefined,
  now: number = Date.now(),
): DuesInfo {
  if (amountCents <= 0) {
    return { state: "paid", label: "Settled", days: 0 };
  }
  if (dueAt === undefined) {
    return { state: "due", label: "Balance open", days: 0 };
  }
  const days = daysUntil(dueAt, now);
  if (days < 0) {
    return { state: "overdue", label: `Overdue ${Math.abs(days)}d`, days };
  }
  if (days === 0) {
    return { state: "due", label: "Due today", days };
  }
  return { state: "due", label: `Due in ${days}d`, days };
}

const DUES_TONE: Record<DuesState, string> = {
  paid: "border-border bg-muted text-muted-foreground",
  due: "border-foreground/25 bg-background text-foreground",
  overdue: "border-rose-600/30 bg-rose-50 text-rose-700",
};

export function duesBadgeClass(state: DuesState) {
  return DUES_TONE[state];
}

export function duesTextClass(state: DuesState) {
  if (state === "overdue") return "text-rose-700";
  if (state === "due") return "text-foreground";
  return "text-muted-foreground";
}

/** Cycle progress (0–1) for the plan progress hairline. */
export function cycleProgress(
  planStartedAt: number,
  renewsAt: number,
  now: number = Date.now(),
) {
  const span = renewsAt - planStartedAt;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now - planStartedAt) / span));
}

/* ------------------------------------------------------------------ people */

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
