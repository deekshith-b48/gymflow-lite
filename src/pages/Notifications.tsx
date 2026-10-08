import {
  EmptyState,
  PageHeader,
  SkeletonRows,
  StatusChip,
} from "@/components/workspace/primitives";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/gym";
import { useMutation, useQuery } from "convex/react";
import {
  Info,
  Loader2,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Notifications: automated rules with toggles, the system template library,
 * the connected WhatsApp device with its rate limits, the composer with a
 * live preview, and the outbox history.
 */
export default function Notifications() {
  const overview = useQuery(api.notifications.overview, {});
  const roster = useQuery(api.members.list, {});
  const toggleRule = useMutation(api.notifications.toggleRule);
  const toggleAll = useMutation(api.notifications.toggleAllNotifications);
  const setWhatsapp = useMutation(api.notifications.setWhatsappConnected);
  const sendMessage = useMutation(api.notifications.sendMessage);
  const clearHistory = useMutation(api.notifications.clearHistory);

  const [preview, setPreview] = useState<{
    name: string;
    body: string;
    channels: string[];
    subject?: string | null;
  } | null>(null);
  const [audience, setAudience] = useState("all");
  const [channels, setChannels] = useState<string[]>(["whatsapp"]);
  const [useTemplate, setUseTemplate] = useState(true);
  const [templateKey, setTemplateKey] = useState("welcome");
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [sending, setSending] = useState(false);

  if (overview === undefined) {
    return (
      <div className="flex flex-col gap-7">
        <PageHeader
          eyebrow="Engagement"
          title="Notifications"
          lede="Automated rules, templates and the WhatsApp channel."
        />
        <SkeletonRows rows={5} />
      </div>
    );
  }

  const audienceCount =
    audience === "all"
      ? (roster?.stats.total ?? 0)
      : audience === "active"
        ? (roster?.stats.active ?? 0)
        : audience === "expiring"
          ? (roster?.stats.expiringSoon ?? 0)
          : (roster?.stats.inactive14d ?? 0);

  const selectedTemplate = overview.templates.find(
    (template) => template.key === templateKey,
  );

  async function handleSend() {
    if (channels.length === 0) {
      toast.error("Pick at least one channel.");
      return;
    }
    const body = useTemplate ? selectedTemplate?.body ?? "" : customBody;
    if (!body.trim()) {
      toast.error("Write a message or pick a template.");
      return;
    }
    setSending(true);
    try {
      await sendMessage({
        audience,
        channels: channels as ("email" | "whatsapp")[],
        subject: useTemplate
          ? selectedTemplate?.name
          : customSubject.trim() || undefined,
        body,
        recipients: audienceCount,
        custom: !useTemplate,
      });
      toast.success(
        `Queued for ${audienceCount} recipients on ${channels.join(" + ")}`,
      );
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not queue the message.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Engagement"
        title="Notifications"
        lede="Automated rules, system templates, the WhatsApp device and the outbox."
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <span className="text-xs text-muted-foreground">
              Notifications
            </span>
            <Switch
              checked={overview.notificationsEnabled}
              onCheckedChange={async (enabled) => {
                try {
                  await toggleAll({ enabled });
                  toast.success(
                    enabled
                      ? "All notifications enabled"
                      : "All notifications paused",
                  );
                } catch {
                  toast.error("Could not update notifications.");
                }
              }}
            />
          </div>
        }
      />

      <Tabs defaultValue="rules" className="flex flex-col gap-5">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="rules">Automated Rules</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="send">Send Message</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------- automated rules */}
        <TabsContent value="rules" className="flex flex-col gap-4">
          {overview.rules.map((rule) => (
            <section
              key={rule.key}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                <div>
                  <p className="font-semibold tracking-tight">{rule.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {rule.description}
                  </p>
                </div>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={async (enabled) => {
                    try {
                      await toggleRule({ key: rule.key, enabled });
                      toast.success(
                        `${rule.name} ${enabled ? "enabled" : "disabled"}`,
                      );
                    } catch {
                      toast.error("Could not update that rule.");
                    }
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 text-sm">
                <div>
                  <p className="eyebrow">Triggers</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {rule.triggers.map((trigger) => (
                      <li
                        key={trigger}
                        className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {trigger}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow">Channels</p>
                  <div className="mt-1 flex gap-1.5">
                    {rule.channels.map((channel) => (
                      <span
                        key={channel}
                        className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
                      >
                        {channel}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <p className="eyebrow">Template</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shadow-none"
                    onClick={() => {
                      const template = overview.templates.find(
                        (entry) => entry.key === rule.templateKey,
                      );
                      if (template) setPreview(template);
                    }}
                  >
                    Preview
                  </Button>
                </div>
              </div>
            </section>
          ))}
        </TabsContent>

        {/* ------------------------------------------------- templates */}
        <TabsContent value="templates" className="flex flex-col gap-3">
          {overview.templates.map((template) => (
            <section
              key={template.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4"
            >
              <div>
                <p className="font-semibold tracking-tight">{template.name}</p>
                <p className="mt-0.5 line-clamp-1 max-w-xl text-xs text-muted-foreground">
                  {template.subject ? `${template.subject} — ` : ""}
                  {template.body}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {template.channels.map((channel) => (
                    <span
                      key={channel}
                      className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
                    >
                      {channel}
                    </span>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shadow-none"
                  onClick={() => setPreview(template)}
                >
                  Preview
                </Button>
              </div>
            </section>
          ))}
        </TabsContent>

        {/* -------------------------------------------------- whatsapp */}
        <TabsContent value="whatsapp" className="flex flex-col gap-4">
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                  <Smartphone className="size-5 text-primary" />
                </span>
                <div>
                  <p className="figure text-sm">
                    {overview.whatsapp.number ?? "Not connected"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {overview.whatsapp.connected ? "Connected" : "Disconnected"}
                  </p>
                </div>
                <span
                  className={`size-2 rounded-full ${
                    overview.whatsapp.connected ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
              </div>
              <Button
                variant="outline"
                className="shadow-none"
                onClick={async () => {
                  try {
                    await setWhatsapp({
                      connected: !overview.whatsapp.connected,
                    });
                    toast.success(
                      overview.whatsapp.connected
                        ? "WhatsApp disconnected"
                        : "WhatsApp connected",
                    );
                  } catch {
                    toast.error("Could not update the device.");
                  }
                }}
              >
                <X className="size-4" />
                {overview.whatsapp.connected ? "Disconnect" : "Connect"}
              </Button>
            </div>

            <div className="grid gap-px bg-border sm:grid-cols-3">
              <UsageStat
                label="This hour"
                used={overview.usage.thisHour}
                limit={overview.usage.hourLimit}
              />
              <UsageStat
                label="Today"
                used={overview.usage.today}
                limit={overview.usage.dayLimit}
              />
              <UsageStat
                label="This month"
                used={overview.usage.thisMonth}
                limit={overview.usage.monthLimit}
              />
            </div>
          </section>

          <Alert>
            <Info className="size-4" />
            <AlertTitle>Rate limiting</AlertTitle>
            <AlertDescription>
              Messages are paced at roughly one every 30–45 seconds per gym, so
              a burst never trips the provider&apos;s anti-spam limits.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* ---------------------------------------------- send message */}
        <TabsContent value="send" className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="send-audience">Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger id="send-audience" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  <SelectItem value="active">Active members</SelectItem>
                  <SelectItem value="expiring">Expiring this week</SelectItem>
                  <SelectItem value="inactive">Inactive 14+ days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {audienceCount} recipients match
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Channel</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={channels.includes("email")}
                    onCheckedChange={(checked) =>
                      setChannels((current) =>
                        checked === true
                          ? Array.from(new Set([...current, "email"]))
                          : current.filter((entry) => entry !== "email"),
                      )
                    }
                  />
                  Email
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={channels.includes("whatsapp")}
                    onCheckedChange={(checked) =>
                      setChannels((current) =>
                        checked === true
                          ? Array.from(new Set([...current, "whatsapp"]))
                          : current.filter((entry) => entry !== "whatsapp"),
                      )
                    }
                  />
                  WhatsApp
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={useTemplate}
                  onCheckedChange={(checked) => setUseTemplate(checked === true)}
                />
                Use a template
              </label>
              <span className="text-xs text-muted-foreground">or</span>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!useTemplate}
                  onCheckedChange={(checked) => setUseTemplate(checked !== true)}
                />
                Write custom message
              </label>
            </div>

            {useTemplate ? (
              <div className="grid gap-2">
                <Label htmlFor="send-template">Template</Label>
                <Select value={templateKey} onValueChange={setTemplateKey}>
                  <SelectTrigger id="send-template" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {overview.templates.map((template) => (
                      <SelectItem key={template.key} value={template.key}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="send-subject">Subject</Label>
                  <Input
                    id="send-subject"
                    value={customSubject}
                    onChange={(event) => setCustomSubject(event.target.value)}
                    placeholder="Optional for WhatsApp"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="send-body">Message</Label>
                  <Textarea
                    id="send-body"
                    rows={5}
                    className="resize-none"
                    value={customBody}
                    onChange={(event) => setCustomBody(event.target.value)}
                    placeholder="Write the message…"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="shadow-none"
                onClick={() => toast.success("Test message queued to your inbox")}
              >
                <Send className="size-4" />
                Send test to me
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending && <Loader2 className="size-4 animate-spin" />}
                Send now
              </Button>
            </div>
          </div>

          {/* preview panel */}
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="eyebrow">Preview</p>
            <div className="mt-4 rounded-lg border border-border bg-background p-4">
              <p className="text-xs text-muted-foreground">
                {channels.includes("email") && useTemplate && selectedTemplate?.subject
                  ? selectedTemplate.subject
                  : customSubject || selectedTemplate?.name || "Message preview"}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {useTemplate
                  ? (selectedTemplate?.body ?? "Pick a template to preview it.")
                  : customBody || "Your custom message appears here."}
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground">
                To: {audienceCount} recipients ·{" "}
                {channels.length ? channels.join(" + ") : "no channel selected"}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* -------------------------------------------------- history */}
        <TabsContent value="history" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {overview.history.length} message
              {overview.history.length === 1 ? "" : "s"} in the last 30 days
            </p>
            <Button
              size="sm"
              variant="outline"
              className="shadow-none"
              onClick={async () => {
                try {
                  await clearHistory({});
                  toast("History cleared");
                } catch {
                  toast.error("Could not clear history.");
                }
              }}
            >
              Clear history
            </Button>
          </div>

          {overview.history.length === 0 ? (
            <EmptyState
              title="Nothing sent yet"
              body="Messages queued from the Send Message tab land here with their delivery status."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Date", "Type", "Trigger / Subject", "Channel", "Recipients", "Status"].map(
                      (header) => (
                        <th
                          key={header}
                          className="eyebrow px-4 py-3 text-left font-normal"
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {overview.history.map((row) => (
                    <tr key={row._id}>
                      <td className="figure px-4 py-2.5 text-xs text-muted-foreground">
                        {formatDate(row.at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        {row.subject ?? row.trigger}
                      </td>
                      <td className="px-4 py-2.5 text-xs uppercase text-muted-foreground">
                        {row.channel}
                      </td>
                      <td className="figure px-4 py-2.5 text-sm">
                        {row.recipients}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusChip status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template preview dialog */}
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="shadow-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="tracking-tight">
              {preview?.name ?? "Template"}
            </DialogTitle>
            <DialogDescription>
              {preview?.subject ?? "System template preview"}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="whitespace-pre-wrap text-sm leading-6">
              {preview?.body}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsageStat({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className="figure mt-2 text-2xl font-medium">
        {used}
        <span className="text-base text-muted-foreground">/{limit}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))}%`,
          }}
        />
      </div>
    </div>
  );
}
