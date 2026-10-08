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
  { value: "inactive", label: "Inactive" },
  { value: "expired", label: "Expired" },
  { value: "frozen", label: "Frozen" },
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
  // DD/MM/YYYY — the desk reads dates off ID cards and printed statements in
  // this order, so an ISO order would only slow the front desk down.
  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
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
  // Pakistani Rupees — whole amounts print without decimals, which is how
  // every receipt and dashboard tile in this workspace reads.
  const whole = cents % 100 === 0;
  const amount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
  return `Rs ${amount}`;
}

/* --------------------------------------------------------- date ranges */

export const DATE_RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last15", label: "Last 15 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "thisYear", label: "This Year" },
  { value: "lastYear", label: "Last Year" },
  { value: "custom", label: "Custom" },
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]["value"];

export type DateRange = { from: number; to: number };

/** Resolve a preset (or an explicit custom range) against `now`. */
export function resolveDateRange(
  preset: DateRangePreset,
  now: number = Date.now(),
  custom?: { from?: number; to?: number },
): DateRange {
  const startOfToday = startOfDay(now);
  const endOfToday = startOfToday + DAY_MS - 1;
  const date = new Date(now);
  const year = date.getFullYear();
  const month = date.getMonth();

  switch (preset) {
    case "today":
      return { from: startOfToday, to: endOfToday };
    case "yesterday":
      return { from: startOfToday - DAY_MS, to: startOfToday - 1 };
    case "last7":
      return { from: startOfToday - 6 * DAY_MS, to: endOfToday };
    case "last15":
      return { from: startOfToday - 14 * DAY_MS, to: endOfToday };
    case "last30":
      return { from: startOfToday - 29 * DAY_MS, to: endOfToday };
    case "thisMonth":
      return {
        from: new Date(year, month, 1).getTime(),
        to: new Date(year, month + 1, 0, 23, 59, 59, 999).getTime(),
      };
    case "lastMonth":
      return {
        from: new Date(year, month - 1, 1).getTime(),
        to: new Date(year, month, 0, 23, 59, 59, 999).getTime(),
      };
    case "thisYear":
      return {
        from: new Date(year, 0, 1).getTime(),
        to: new Date(year, 11, 31, 23, 59, 59, 999).getTime(),
      };
    case "lastYear":
      return {
        from: new Date(year - 1, 0, 1).getTime(),
        to: new Date(year - 1, 11, 31, 23, 59, 59, 999).getTime(),
      };
    case "custom": {
      const from = custom?.from ?? startOfToday - 29 * DAY_MS;
      const to = custom?.to ?? endOfToday;
      return { from: Math.min(from, to), to: Math.max(from, to) };
    }
  }
}

export function dateRangeLabel(preset: DateRangePreset) {
  return (
    DATE_RANGE_PRESETS.find((option) => option.value === preset)?.label ??
    "Custom"
  );
}

/* ---------------------------------------------------------- status tones */

/** Every status badge tone in one place: green forward, amber partial,
 *  red dead, sky paused, muted off. */
export const STATUS_TONES = {
  active: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  paid: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  partial: "border-amber-400/35 bg-amber-400/10 text-amber-300",
  pending: "border-yellow-400/35 bg-yellow-400/10 text-yellow-300",
  sent: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  failed: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  expired: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  inactive: "border-border bg-muted text-muted-foreground",
  frozen: "border-sky-400/35 bg-sky-400/10 text-sky-300",
  paused: "border-sky-400/35 bg-sky-400/10 text-sky-300",
  cancelled: "border-border bg-muted text-muted-foreground",
  member: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  staff: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  trainer: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  admin: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  manager: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  receptionist: "border-lime-400/40 bg-lime-400/10 text-lime-200",
  machine: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  manual: "border-amber-400/35 bg-amber-400/10 text-amber-300",
  cash: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  bank: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  card: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  online: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200",
  created: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  updated: "border-amber-400/35 bg-amber-400/10 text-amber-300",
  deleted: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  auth: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  other: "border-border bg-muted text-muted-foreground",
} as const;

export type StatusTone = keyof typeof STATUS_TONES;

export function statusTone(status: string) {
  return (
    STATUS_TONES[status as StatusTone] ??
    "border-border bg-muted text-muted-foreground"
  );
}

export function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/* -------------------------------------------------------- payment helpers */

export const PAY_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "online", label: "Online" },
] as const;

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Salaries",
  "Equipment",
  "Electricity",
  "Marketing",
  "PT Commission",
  "Maintenance",
  "Other",
  "Internet",
  "Water",
] as const;

export const SALE_CATEGORIES = [
  "Supplements",
  "Accessories",
  "Apparel",
  "Beverages",
] as const;

export function paymentStatus(
  totalCents: number,
  paidCents: number,
): "paid" | "partial" | "pending" {
  if (paidCents <= 0) return "pending";
  if (paidCents >= totalCents) return "paid";
  return "partial";
}

/* ------------------------------------------------------- permission matrix */

/** Sections of the roles matrix; each action is one checkbox column. */
export const PERMISSION_SECTIONS = [
  { key: "members", label: "Members", actions: ["view", "create", "edit", "delete"] },
  { key: "attendance", label: "Attendance", actions: ["view", "record", "delete"] },
  { key: "fees", label: "Fees", actions: ["view", "record", "edit", "delete"] },
  { key: "expenses", label: "Expenses", actions: ["view", "create", "edit", "delete"] },
  { key: "sales", label: "Sales", actions: ["view", "create", "edit", "delete"] },
  { key: "withdrawals", label: "Withdrawals", actions: ["view", "create", "delete"] },
  { key: "packages", label: "Packages", actions: ["view", "manage"] },
  { key: "addons", label: "Add-ons", actions: ["view", "manage"] },
  { key: "staff", label: "Staff/Users", actions: ["view", "create", "edit", "delete", "manageRoles"] },
  { key: "trainers", label: "Personal Trainers", actions: ["view", "manage"] },
  { key: "roles", label: "Roles & Permissions", actions: ["view", "manage"] },
] as const;

export function allPermissionKeys(): string[] {
  return PERMISSION_SECTIONS.flatMap((section) =>
    section.actions.map((action) => `${section.key}.${action}`),
  );
}

export type SystemRoleKey =
  | "admin"
  | "manager"
  | "receptionist"
  | "trainer"
  | "custom";

/** System roles and the permission slice each one starts from. */
export const SYSTEM_ROLES: {
  key: SystemRoleKey;
  name: string;
  description: string;
  legacyRole: string;
  permissions: string[] | "all";
}[] = [
  {
    key: "admin",
    name: "Admin",
    description: "Full access to the gym",
    legacyRole: "admin",
    permissions: "all",
  },
  {
    key: "manager",
    name: "Manager",
    description:
      "Day-to-day operations except packages, roles, gym settings edit",
    legacyRole: "admin",
    permissions: allPermissionKeys().filter(
      (key) =>
        !key.startsWith("packages.") &&
        !key.startsWith("roles.") &&
        key !== "staff.manageRoles",
    ),
  },
  {
    key: "receptionist",
    name: "Receptionist",
    description: "Front desk — members, attendance, fees, own profile",
    legacyRole: "user",
    permissions: [
      "members.view",
      "members.create",
      "members.edit",
      "attendance.view",
      "attendance.record",
      "fees.view",
      "fees.record",
      "sales.view",
      "sales.create",
      "trainers.view",
      "packages.view",
      "addons.view",
    ],
  },
  {
    key: "trainer",
    name: "Trainer",
    description: "Same scope as Receptionist",
    legacyRole: "user",
    permissions: [
      "members.view",
      "members.create",
      "members.edit",
      "attendance.view",
      "attendance.record",
      "fees.view",
      "trainers.view",
      "packages.view",
      "addons.view",
    ],
  },
  {
    key: "custom",
    name: "Custom",
    description: "A role you define from a base category and a template",
    legacyRole: "user",
    permissions: [],
  },
];

export function systemRoleName(key: string) {
  return SYSTEM_ROLES.find((role) => role.key === key)?.name ?? key;
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
  due: "border-amber-400/35 bg-amber-400/10 text-amber-300",
  overdue: "border-rose-500/40 bg-rose-500/15 text-rose-300",
};

export function duesBadgeClass(state: DuesState) {
  return DUES_TONE[state];
}

export function duesTextClass(state: DuesState) {
  if (state === "overdue") return "text-rose-300";
  if (state === "due") return "text-amber-300";
  return "text-muted-foreground";
}

/* ----------------------------------------------------------------- catalog */

export const CADENCE_OPTIONS = [
  { value: "one_time", label: "One-time" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
] as const;

export type Cadence = (typeof CADENCE_OPTIONS)[number]["value"];

export const CATALOG_STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
] as const;

export type CatalogStatus = (typeof CATALOG_STATUS_OPTIONS)[number]["value"];

export const POST_KIND_OPTIONS = [
  { value: "announcement", label: "Announcement" },
  { value: "update", label: "Product update" },
  { value: "note", label: "Internal note" },
] as const;

export type PostKind = (typeof POST_KIND_OPTIONS)[number]["value"];

export const ORDER_STATUS_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number]["value"];

const CADENCE_SUFFIX: Record<string, string> = {
  monthly: "/mo",
  quarterly: "/qtr",
  annual: "/yr",
};

/** "$79 /mo" — one-time prices carry no suffix. */
export function formatPrice(priceCents: number, cadence: string) {
  return `${formatMoney(priceCents)}${CADENCE_SUFFIX[cadence] ?? ""}`;
}

export function cadenceLabel(cadence: string) {
  return CADENCE_OPTIONS.find((option) => option.value === cadence)?.label ?? cadence;
}

export function catalogStatusLabel(status: string) {
  return (
    CATALOG_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

export function postKindLabel(kind: string) {
  return POST_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

/** Chip tones. Every status reads at a glance without a legend. */
export function orderStatusClass(status: string) {
  if (status === "paid") return "border-emerald-400/35 bg-emerald-400/10 text-emerald-300";
  if (status === "pending") return "border-amber-400/35 bg-amber-400/10 text-amber-300";
  if (status === "refunded") return "border-sky-400/35 bg-sky-400/10 text-sky-300";
  return "border-border bg-muted text-muted-foreground";
}

export function catalogStatusClass(status: string) {
  if (status === "published") return "border-lime-400/40 bg-lime-400/10 text-lime-300";
  if (status === "draft") return "border-border bg-muted text-muted-foreground";
  return "border-rose-500/30 bg-rose-500/10 text-rose-300";
}

/** Category accents, assigned by first letter so a category keeps its colour. */
const CATEGORY_TONES = [
  "border-violet-400/40 bg-violet-400/10 text-violet-200",
  "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  "border-lime-400/40 bg-lime-400/10 text-lime-200",
  "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200",
  "border-amber-400/40 bg-amber-400/10 text-amber-200",
];

export function categoryTone(category: string) {
  const key = category.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 997;
  }
  return CATEGORY_TONES[hash % CATEGORY_TONES.length];
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
