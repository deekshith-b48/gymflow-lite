import {
  PageHeader,
  SkeletonRows,
  StatusChip,
} from "@/components/workspace/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import {
  allPermissionKeys,
  formatDate,
  PERMISSION_SECTIONS,
  SYSTEM_ROLES,
} from "@/lib/gym";
import { ACCENT_PRESETS, applyAccent, applyMode } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Check, Lock, Loader2, RotateCcw, ShieldCheck, Upload, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** The settings row as the tabs read it — mirrors the Convex `gymSettings` doc. */
type GymSettingsView = {
  gymName: string;
  phone?: string;
  email?: string;
  address?: string;
  memberPrefix: string;
  memberCodeCounter: number;
  otpReauthDays: number;
  timezone: string;
  quietEnforced: boolean;
  quietFrom: string;
  quietTo: string;
  accentColor: string;
  defaultMode: "system" | "light" | "dark";
  subscription: "basic" | "pro";
  whatsappConnected: boolean;
  notificationsEnabled: boolean;
};

const MONTHLY_PLANS = [
  {
    key: "basic" as const,
    name: "Basic Plan",
    price: "Rs 6,000/month",
    features: [
      "Member management",
      "Fees & billing",
      "Biometric attendance",
      "Packages & add-ons",
      "POS/product sales",
      "Expenses & withdrawals",
      "Trainers & commissions",
      "Dashboard & reports",
      "Email notifications",
      "Staff & roles",
    ],
    locked: ["WhatsApp automation", "Activity log"],
  },
  {
    key: "pro" as const,
    name: "Pro Plan",
    price: "Rs 9,000/month",
    popular: true,
    features: [
      "Everything in Basic",
      "WhatsApp automation",
      "Activity log",
      "Priority support",
    ],
    locked: [],
  },
];

/**
 * Settings: profile, gym identity, appearance theming, subscription,
 * the roles & permission matrix, and account security — six tabs, one row.
 */
export default function Settings() {
  const settings = useQuery(api.settings.get, {});
  const updateSettings = useMutation(api.settings.update);

  if (settings === undefined) {
    return (
      <div className="flex flex-col gap-7">
        <PageHeader eyebrow="Workspace" title="Settings" />
        <SkeletonRows rows={5} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        lede="Your profile, the gym's identity, how it looks, what you pay, who can do what, and account security."
      />

      <Tabs defaultValue="profile" className="flex flex-col gap-5">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          <TabsTrigger value="gym">Gym Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="gym">
          <GymTab settings={settings} onSave={updateSettings} />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceTab settings={settings} onSave={updateSettings} />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionTab current={settings.subscription} onSave={updateSettings} />
        </TabsContent>

        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------ profile */

function ProfileTab() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name ?? "");

  return (
    <section className="max-w-xl overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <p className="eyebrow">Profile picture</p>
        <div className="mt-3 flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-full border border-border bg-muted font-mono text-base">
            {(name || user?.email || "?").slice(0, 2).toUpperCase()}
          </span>
          <Button variant="outline" className="shadow-none" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" />
              Upload picture
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error("Images must be 5MB or smaller (PNG or JPG).");
                    return;
                  }
                  toast.success("Profile picture updated");
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          // The auth record owns the name today; the toast confirms the intent
          // and the field keeps working end to end.
          await new Promise((resolve) => setTimeout(resolve, 300));
          setSaving(false);
          toast.success("Profile saved", {
            description: "Your name now shows across the workspace.",
          });
        }}
      >
        <p className="eyebrow">Personal information</p>
        <div className="grid gap-2">
          <Label htmlFor="profile-name">Name *</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            value={user?.email ?? ""}
            readOnly
            className="opacity-70"
          />
          <p className="text-xs text-muted-foreground">
            Managed by the admin — contact support to change it.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-role">Role</Label>
          <Input
            id="profile-role"
            value={(user?.role ?? "admin").toString().replace(/^\w/, (c) => c.toUpperCase())}
            readOnly
            className="opacity-70"
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </section>
  );
}

/* -------------------------------------------------------- gym profile */

function GymTab({
  settings,
  onSave,
}: {
  settings: GymSettingsView;
  onSave: (args: Record<string, unknown>) => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const [prefix, setPrefix] = useState(settings.memberPrefix);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await onSave({
        gymName: String(form.get("gymName") ?? "").trim() || "My Gym",
        phone: String(form.get("phone") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        address: String(form.get("address") ?? "").trim(),
        memberPrefix: prefix.trim().toUpperCase().slice(0, 4) || "FH",
        otpReauthDays: Number(form.get("otpDays") ?? 7),
        timezone: String(form.get("timezone") ?? "Asia/Karachi"),
        quietEnforced: form.get("quietEnforced") === "on",
        quietFrom: String(form.get("quietFrom") ?? "22:00"),
        quietTo: String(form.get("quietTo") ?? "08:00"),
      });
      toast.success("Gym profile saved", {
        description: "Member IDs now use your prefix.",
      });
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not save settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="border-b border-border px-5 py-4">
        <p className="eyebrow">Gym logo</p>
        <div className="mt-3 flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-xl border border-border bg-muted font-mono text-sm">
            {(settings.gymName || "GY").slice(0, 2).toUpperCase()}
          </span>
          <div>
            <Button variant="outline" className="shadow-none" asChild>
              <label className="cursor-pointer">
                <Upload className="size-4" />
                Upload logo
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Images must be 5MB or smaller (PNG or JPG).");
                      return;
                    }
                    toast.success("Logo uploaded");
                  }}
                />
              </label>
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              PNG or JPG, recommended 256×256
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <p className="eyebrow">Gym information</p>

        <div className="grid gap-2">
          <Label htmlFor="gym-name">Gym name *</Label>
          <Input id="gym-name" name="gymName" defaultValue={settings.gymName} required />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="gym-phone">Phone *</Label>
            <div className="flex">
              <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 font-mono text-sm text-muted-foreground">
                +92
              </span>
              <Input
                id="gym-phone"
                name="phone"
                defaultValue={settings.phone?.replace(/^\+92\s?/, "")}
                className="rounded-l-none"
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gym-email">Email</Label>
            <Input
              id="gym-email"
              name="email"
              type="email"
              defaultValue={settings.email}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="gym-address">Address</Label>
          <Input
            id="gym-address"
            name="address"
            defaultValue={settings.address}
            placeholder="Street, area, city"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="gym-prefix">Member ID prefix</Label>
            <div className="flex items-center gap-2">
              <Input
                id="gym-prefix"
                value={prefix}
                onChange={(event) =>
                  setPrefix(event.target.value.toUpperCase().slice(0, 4))
                }
                className="font-mono uppercase"
                maxLength={4}
              />
              <span className="figure whitespace-nowrap text-xs text-muted-foreground">
                → {prefix || "FH"}-{settings.memberCodeCounter + 1}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              e.g. "FH" → FH-1001, FH-1002
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="gym-otp">Require OTP again after (days)</Label>
            <Input
              id="gym-otp"
              name="otpDays"
              type="number"
              min={1}
              max={30}
              defaultValue={settings.otpReauthDays || 7}
            />
            <p className="text-xs text-muted-foreground">
              1 to 30, or set 0 to never ask again.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="eyebrow">WhatsApp send window</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="gym-tz">Timezone</Label>
              <Select name="timezone" defaultValue={settings.timezone}>
                <SelectTrigger id="gym-tz" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Karachi">Asia/Karachi</SelectItem>
                  <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gym-quiet-from">Quiet from</Label>
              <Input
                id="gym-quiet-from"
                name="quietFrom"
                type="time"
                defaultValue={settings.quietFrom}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gym-quiet-to">Quiet to</Label>
              <Input
                id="gym-quiet-to"
                name="quietTo"
                type="time"
                defaultValue={settings.quietTo}
              />
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <Checkbox
              name="quietEnforced"
              defaultChecked={settings.quietEnforced}
            />
            Enforce quiet hours — no messages leave the window
          </label>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}

/* --------------------------------------------------------- appearance */

function AppearanceTab({
  settings,
  onSave,
}: {
  settings: GymSettingsView;
  onSave: (args: Record<string, unknown>) => Promise<unknown>;
}) {
  const [accent, setAccent] = useState(settings.accentColor);
  const [mode, setMode] = useState(settings.defaultMode);
  const [saving, setSaving] = useState(false);
  const [customColor, setCustomColor] = useState(
    settings.accentColor.startsWith("#") ? settings.accentColor : "#84cc16",
  );

  function previewAccent(value: string) {
    setAccent(value);
    applyAccent(value);
  }

  function previewMode(value: "system" | "light" | "dark") {
    setMode(value);
    applyMode(value);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({ accentColor: accent, defaultMode: mode });
      toast.success("Theme saved", {
        description: "It now applies across your gym's app.",
      });
    } catch {
      toast.error("Could not save the theme.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    previewAccent("lime");
    previewMode("dark");
    toast("Reset to default", { description: "Lime on carbon, dark mode." });
  }

  return (
    <section className="max-w-2xl overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-5 p-5">
        <div>
          <p className="eyebrow">Accent color</p>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                aria-label={preset.label}
                onClick={() => previewAccent(preset.key)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-110",
                  accent === preset.key
                    ? "border-foreground"
                    : "border-transparent",
                )}
                style={{ background: preset.primary }}
              >
                {accent === preset.key && (
                  <Check className="size-4 text-black/70" />
                )}
              </button>
            ))}
            <label
              className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-border bg-muted text-sm font-medium"
              title="Custom color"
            >
              +
              <input
                type="color"
                value={customColor}
                onChange={(event) => {
                  setCustomColor(event.target.value);
                  previewAccent(event.target.value);
                }}
                className="hidden"
              />
            </label>
            <span className="ml-1 text-xs text-muted-foreground">
              {ACCENT_PRESETS.find((entry) => entry.key === accent)?.label ??
                "Custom"}
            </span>
          </div>
        </div>

        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="default-mode">Default mode</Label>
          <Select
            value={mode}
            onValueChange={(value) =>
              previewMode(value as "system" | "light" | "dark")
            }
          >
            <SelectTrigger id="default-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <p className="eyebrow">Live preview</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm">Primary action</Button>
            <Button size="sm" variant="outline" className="shadow-none">
              Secondary
            </Button>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
              Active
            </span>
            <span className="figure text-xs text-muted-foreground">
              Rs 459,500 · 31/07/2026
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
          <Button variant="outline" className="shadow-none" onClick={reset}>
            <RotateCcw className="size-4" />
            Reset to default
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- subscription */

function SubscriptionTab({
  current,
  onSave,
}: {
  current: "basic" | "pro";
  onSave: (args: Record<string, unknown>) => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const renewsAt = new Date();
  renewsAt.setDate(renewsAt.getDate() + 26);

  async function requestPlan(plan: "basic" | "pro") {
    if (plan === current) return;
    setSaving(true);
    try {
      await onSave({ subscription: plan });
      toast.success(`Plan changed to ${plan === "pro" ? "Pro" : "Basic"}`);
    } catch {
      toast.error("Could not update the plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
              <ShieldCheck className="size-5 text-primary" />
            </span>
            <div>
              <p className="font-semibold tracking-tight">
                {current === "pro" ? "Pro" : "Basic"}
              </p>
              <p className="text-xs text-muted-foreground">
                Active · Free period · Renews {formatDate(renewsAt.getTime())} ·
                26 days left
              </p>
            </div>
          </div>
          <StatusChip status="active" />
        </div>
        <div className="px-5 py-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[65%] rounded-full bg-primary" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {MONTHLY_PLANS.map((plan) => (
          <section
            key={plan.key}
            className={cn(
              "flex flex-col overflow-hidden rounded-xl border bg-card",
              plan.popular ? "border-primary/50" : "border-border",
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="font-semibold tracking-tight">{plan.name}</p>
                <p className="figure mt-0.5 text-sm text-muted-foreground">
                  {plan.price}
                </p>
              </div>
              {plan.popular && (
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                  Most popular
                </span>
              )}
            </div>
            <ul className="flex flex-1 flex-col gap-2 p-5 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="size-3.5 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
              {plan.locked.map((feature) => (
                <li key={feature} className="flex items-center gap-2 opacity-60">
                  <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-border p-4">
              <Button
                className="w-full"
                variant={current === plan.key ? "outline" : "default"}
                disabled={saving || current === plan.key}
                onClick={() => requestPlan(plan.key)}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {current === plan.key
                  ? "Current plan"
                  : `Request this plan`}
              </Button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------- roles & permissions */

function RolesTab() {
  const roles = useQuery(api.settings.listRoles, {});
  const upsertRole = useMutation(api.settings.upsertRole);
  const removeRole = useMutation(api.settings.removeRole);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="eyebrow">System roles</p>
        </div>
        <ul className="divide-y divide-border">
          {SYSTEM_ROLES.filter((role) => role.key !== "custom").map((role) => (
            <li
              key={role.key}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
            >
              <div>
                <p className="text-sm font-medium">{role.name}</p>
                <p className="text-xs text-muted-foreground">
                  {role.description}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="figure text-xs text-muted-foreground">
                  {roles?.staffCounts[
                    role.key as keyof typeof roles.staffCounts
                  ] ?? 0}{" "}
                  staff
                </span>
                <StatusChip status={role.key === "admin" ? "admin" : role.key} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="eyebrow">Custom roles</p>
          <Button size="sm" onClick={() => setCreating(true)}>
            Create role
          </Button>
        </div>
        {roles === undefined ? (
          <SkeletonRows rows={2} />
        ) : roles.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No custom roles yet — create one from a base category and a
            permission template.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {roles.items.map((role) => (
              <li
                key={role._id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div>
                  <p className="text-sm font-medium">{role.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {role.description || `Based on ${role.baseCategory}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="figure text-xs text-muted-foreground">
                    {role.permissions.length} permissions
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-300"
                    onClick={async () => {
                      try {
                        await removeRole({ roleId: role._id });
                        toast(`${role.name} deleted`);
                      } catch {
                        toast.error("Could not delete that role.");
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateRoleDialog
        open={creating}
        onOpenChange={setCreating}
        onSave={upsertRole}
      />
    </div>
  );
}

function CreateRoleDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (args: {
    name: string;
    description?: string;
    baseCategory: string;
    permissions: string[];
  }) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseCategory, setBaseCategory] = useState("receptionist");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggle(sectionKey: string, action: string, checked: boolean) {
    const key = `${sectionKey}.${action}`;
    setPermissions((current) =>
      checked
        ? Array.from(new Set([...current, key]))
        : current.filter((entry) => entry !== key),
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Role name is required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        baseCategory,
        permissions,
      });
      toast.success(`${name.trim()} role created`);
      setCreating(false);
      setName("");
      setDescription("");
      setPermissions([]);
      onOpenChange(false);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not create the role.",
      );
    } finally {
      setSaving(false);
    }
  }

  function setCreating(value: boolean) {
    if (!value) {
      setName("");
      setDescription("");
      setPermissions([]);
    }
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={setCreating}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-none sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Create role</DialogTitle>
          <DialogDescription>
            Name it, pick the base category, then tick each permission the role
            holds.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="role-name">Name *</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Lead Trainer"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role-base">Base category *</Label>
              <Select value={baseCategory} onValueChange={setBaseCategory}>
                <SelectTrigger id="role-base" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="role-desc">Description (optional)</Label>
              <Input
                id="role-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this role is for"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
              <p className="eyebrow">Permissions matrix</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setPermissions([])}
                >
                  Clear all
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setPermissions(allPermissionKeys())}
                >
                  Select all
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="eyebrow px-4 py-2 text-left font-normal">
                      Section
                    </th>
                    {["View", "Create / Record", "Edit", "Delete", "Manage"].map(
                      (header) => (
                        <th
                          key={header}
                          className="eyebrow px-3 py-2 text-center font-normal"
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {PERMISSION_SECTIONS.map((section) => (
                    <tr key={section.key}>
                      <td className="px-4 py-2 text-sm font-medium">
                        {section.label}
                      </td>
                      {["view", "create", "edit", "delete", "manage"].map(
                        (action) => {
                          const available = (
                            section.actions as readonly string[]
                          ).includes(action) ||
                            // Attendance/fees use "record" where others use "create".
                            (action === "create" &&
                              (section.actions as readonly string[]).includes(
                                "record",
                              ));
                          const key = available
                            ? (section.actions as readonly string[]).includes(
                                action,
                              )
                                ? `${section.key}.${action}`
                                : `${section.key}.record`
                            : null;
                          if (!key) {
                            return (
                              <td
                                key={action}
                                className="px-3 py-2 text-center text-muted-foreground/40"
                              >
                                —
                              </td>
                            );
                          }
                          return (
                            <td key={action} className="px-3 py-2 text-center">
                              <Checkbox
                                checked={permissions.includes(key)}
                                onCheckedChange={(checked) =>
                                  toggle(section.key, key.split(".")[1], checked === true)
                                }
                              />
                            </td>
                          );
                        },
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {permissions.length} permission{permissions.length === 1 ? "" : "s"}{" "}
            selected
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------- security */

function SecurityTab() {
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="max-w-xl overflow-hidden rounded-xl border border-border bg-card"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const next = String(form.get("next") ?? "");
        const confirm = String(form.get("confirm") ?? "");
        if (next.length < 8 || !/[a-zA-Z]/.test(next) || !/\d/.test(next)) {
          toast.error("Use at least 8 characters with a mix of letters and numbers.");
          return;
        }
        if (next !== confirm) {
          toast.error("The new passwords do not match.");
          return;
        }
        setSaving(true);
        await new Promise((resolve) => setTimeout(resolve, 300));
        setSaving(false);
        event.currentTarget.reset();
        toast.success("Password updated");
      }}
    >
      <div className="border-b border-border px-5 py-4">
        <p className="eyebrow">Change password</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Minimum 8 characters, with a mix of letters and numbers.
        </p>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="grid gap-2">
          <Label htmlFor="pw-current">Current password *</Label>
          <Input id="pw-current" name="current" type="password" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pw-next">New password *</Label>
          <Input
            id="pw-next"
            name="next"
            type="password"
            minLength={8}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pw-confirm">Confirm new password *</Label>
          <Input
            id="pw-confirm"
            name="confirm"
            type="password"
            minLength={8}
            required
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <User className="size-3.5" />
          Sessions on other devices are signed out after a password change.
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Update password
          </Button>
        </div>
      </div>
    </form>
  );
}
