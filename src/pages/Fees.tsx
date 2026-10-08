import { DataTable, type Column } from "@/components/workspace/DataTable";
import {
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonRows,
  Stat,
  StatGrid,
  StatusChip,
} from "@/components/workspace/primitives";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  formatDate,
  formatMoney,
  PAY_METHODS,
  paymentStatus,
} from "@/lib/gym";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type FeeRow = {
  _id: Id<"feeRecords">;
  memberCode?: string;
  memberName: string;
  packageName?: string;
  kind: string;
  periodStart: number;
  periodEnd: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  method: string;
  status: string;
  paymentDate?: number;
  createdAt: number;
  notes?: string;
};

const KIND_LABELS: Record<string, string> = {
  membership: "Membership",
  addon: "Add-on",
  pt: "Personal Training",
};

/**
 * The fee ledger: summary cards, search/status/kind filters and the full
 * record table with balance highlighted red until it clears.
 */
export default function Fees() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [adding, setAdding] = useState(false);

  const fees = useQuery(api.finance.listFees, {
    search,
    status,
    kind,
  });
  const stats = fees?.stats;

  const columns: Column<FeeRow>[] = [
    {
      key: "code",
      header: "Member ID",
      sortValue: (row) => row.memberCode ?? "",
      render: (row) => (
        <span className="figure text-xs text-muted-foreground">
          {row.memberCode ?? "—"}
        </span>
      ),
    },
    {
      key: "member",
      header: "Member",
      sortValue: (row) => row.memberName,
      render: (row) => <span className="text-sm font-medium">{row.memberName}</span>,
    },
    {
      key: "package",
      header: "Package",
      sortValue: (row) => row.packageName ?? "",
      render: (row) => (
        <span className="text-sm">
          {row.packageName ?? KIND_LABELS[row.kind] ?? row.kind}
        </span>
      ),
    },
    {
      key: "period",
      header: "Period",
      sortValue: (row) => row.periodStart,
      render: (row) => (
        <span className="figure whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(row.periodStart)} → {formatDate(row.periodEnd)}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortValue: (row) => row.totalCents,
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.totalCents)}</span>
      ),
    },
    {
      key: "paid",
      header: "Paid",
      align: "right",
      sortValue: (row) => row.paidCents,
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.paidCents)}</span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      sortValue: (row) => row.balanceCents,
      render: (row) => (
        <span
          className={`figure text-sm ${
            row.balanceCents > 0 ? "text-rose-300" : "text-muted-foreground"
          }`}
        >
          {formatMoney(row.balanceCents)}
        </span>
      ),
    },
    {
      key: "method",
      header: "Method",
      sortValue: (row) => row.method,
      render: (row) => <StatusChip status={row.method} />,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      key: "date",
      header: "Payment Date",
      sortValue: (row) => row.paymentDate ?? row.createdAt,
      render: (row) => (
        <span className="figure text-xs text-muted-foreground">
          {formatDate(row.paymentDate ?? row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Billing"
        title="Fees"
        lede="Every collection, partial payment and outstanding balance."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add fee record
          </Button>
        }
      />

      <StatGrid>
        <Stat
          label="Collected This Month"
          value={stats ? formatMoney(stats.collectedThisMonthCents) : "—"}
          loading={stats === undefined}
          tone="good"
        />
        <Stat
          label="Pending"
          value={stats ? formatMoney(stats.pendingCents) : "—"}
          loading={stats === undefined}
          tone={stats && stats.pendingCents > 0 ? "alert" : "default"}
        />
        <Stat
          label="Partial Balance Due"
          value={stats ? formatMoney(stats.partialBalanceCents) : "—"}
          loading={stats === undefined}
        />
        <Stat
          label="Total Collected"
          value={stats ? formatMoney(stats.totalCollectedCents) : "—"}
          loading={stats === undefined}
        />
      </StatGrid>

      {fees === undefined ? (
        <SkeletonRows rows={7} />
      ) : fees.items.length === 0 ? (
        <EmptyState
          title="No fee records yet"
          body="Record the first collection and the ledger, dues and dashboard start tracking."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add fee record
            </Button>
          }
        />
      ) : (
        <DataTable<FeeRow>
          columns={columns}
          rows={fees.items as unknown as FeeRow[]}
          rowKey={(row) => row._id}
          initialSort={{ key: "date", direction: "desc" }}
          toolbar={
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by member name or ID"
              />
              <div className="flex flex-wrap gap-2">
                <FilterSelect
                  value={status}
                  onChange={setStatus}
                  placeholder="All Status"
                  options={[
                    { value: "paid", label: "Paid" },
                    { value: "partial", label: "Partial" },
                    { value: "pending", label: "Pending" },
                  ]}
                />
                <FilterSelect
                  value={kind}
                  onChange={setKind}
                  placeholder="All Types"
                  options={[
                    { value: "membership", label: "Membership" },
                    { value: "addon", label: "Add-on" },
                    { value: "pt", label: "Personal Training" },
                  ]}
                />
              </div>
            </div>
          }
        />
      )}

      <AddFeeDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-32 bg-card shadow-none">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Amounts are typed in rupees; storage is paisa (1/100 of a rupee). */
function rupeesToCents(value: string) {
  const rupees = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

function toDateInput(ms: number) {
  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromDateInput(value: string, endOfDay = false) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const date = new Date(year, month - 1, day);
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date.getTime();
}

/**
 * Add fee record: pick a member, see their unpaid fees, the package-prefilled
 * breakdown, then how much was paid and by which method.
 */
export function AddFeeDialog({
  open,
  onOpenChange,
  presetMemberId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetMemberId?: Id<"members">;
}) {
  const members = useQuery(api.members.list, {});
  const packages = useQuery(api.catalogAdmin.listPackages, {});
  const trainers = useQuery(api.catalogAdmin.listTrainers, {});
  const createFee = useMutation(api.finance.createFee);

  const [memberId, setMemberId] = useState<string>(presetMemberId ?? "");
  const [kind, setKind] = useState<"membership" | "addon" | "pt">("membership");
  const [packageId, setPackageId] = useState<string>("");
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [saving, setSaving] = useState(false);

  const openFees = useQuery(
    api.finance.memberOpenFees,
    memberId ? { memberId: memberId as Id<"members"> } : "skip",
  );

  const selectedMember = members?.items.find(
    (member) => String(member._id) === memberId,
  );
  const selectedPackage =
    packages?.items.find((pkg) => String(pkg._id) === packageId) ?? null;

  const packageFeeCents = selectedPackage
    ? kind === "pt"
      ? selectedPackage.ptFeeCents
      : selectedPackage.gymFeeCents
    : 0;
  const discountCents =
    applyDiscount && selectedPackage
      ? Math.round(
          (kind === "pt"
            ? selectedPackage.ptFeeCents
            : selectedPackage.gymFeeCents) * 0.1,
        )
      : 0;
  const totalCents = Math.max(0, packageFeeCents - discountCents);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberId) {
      toast.error("Pick a member first.");
      return;
    }
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const paidCents = rupeesToCents(String(form.get("paid") ?? "0"));
    const periodStart = fromDateInput(String(form.get("periodStart") ?? ""));
    const periodEnd = fromDateInput(String(form.get("periodEnd") ?? ""), true);

    if (periodStart === undefined || periodEnd === undefined) {
      toast.error("Both period dates are required.");
      setSaving(false);
      return;
    }
    if (totalCents <= 0 && kind !== "membership") {
      toast.error("Pick a package so the fee can be calculated.");
      setSaving(false);
      return;
    }

    try {
      await createFee({
        memberId: memberId as Id<"members">,
        kind,
        packageId: packageId ? (packageId as Id<"packages">) : undefined,
        trainerId:
          form.get("trainer") && String(form.get("trainer")) !== "none"
            ? (String(form.get("trainer")) as Id<"trainers">)
            : undefined,
        periodStart,
        periodEnd,
        packageFeeCents,
        ptFeeCents: kind === "pt" ? packageFeeCents : undefined,
        discountCents: discountCents || undefined,
        totalCents: totalCents || paidCents,
        paidCents: Math.min(paidCents, totalCents || paidCents),
        method: String(form.get("method") ?? "cash") as
          | "cash"
          | "bank"
          | "card"
          | "online",
        paymentDate: form.get("paymentDate")
          ? fromDateInput(String(form.get("paymentDate")))
          : undefined,
        notes: String(form.get("notes") ?? "").trim() || undefined,
      });
      const status = paymentStatus(totalCents || paidCents, paidCents);
      toast.success(
        `Fee recorded for ${selectedMember?.name ?? "member"} — ${status}`,
      );
      onOpenChange(false);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not record the fee.",
      );
    } finally {
      setSaving(false);
    }
  }

  const today = new Date();
  const defaultStart = toDateInput(today.getTime());
  const end = new Date();
  end.setMonth(end.getMonth() + (selectedPackage?.durationMonths ?? 1));
  const defaultEnd = toDateInput(end.getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-none sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="tracking-tight">Add fee record</DialogTitle>
            <DialogDescription>
              Pick the member, confirm the period and record what was paid.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="fee-member">Member *</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger id="fee-member" className="w-full">
                  <SelectValue placeholder="Select or find a member" />
                </SelectTrigger>
                <SelectContent>
                  {(members?.items ?? []).map((member) => (
                    <SelectItem key={member._id} value={String(member._id)}>
                      {member.memberCode ? `${member.memberCode} · ` : ""}
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {openFees && openFees.count > 0 && (
              <Alert variant="default" className="border-amber-400/40 bg-amber-400/10">
                <AlertTriangle className="size-4 text-amber-300" />
                <AlertTitle className="text-amber-200">
                  This member has {openFees.count} unpaid fee
                  {openFees.count === 1 ? "" : "s"}
                </AlertTitle>
                <AlertDescription className="text-amber-200/80">
                  {openFees.items
                    .slice(0, 2)
                    .map(
                      (item) =>
                        `${formatDate(item.periodStart)} → ${formatDate(item.periodEnd)}: ${formatMoney(item.balanceCents)} outstanding (${item.status})`,
                    )
                    .join(" · ")}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="fee-kind">Type *</Label>
                <Select
                  value={kind}
                  onValueChange={(value) => setKind(value as typeof kind)}
                >
                  <SelectTrigger id="fee-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="membership">Membership</SelectItem>
                    <SelectItem value="addon">Add-on</SelectItem>
                    <SelectItem value="pt">Personal Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fee-package">Package</Label>
                <Select value={packageId} onValueChange={setPackageId}>
                  <SelectTrigger id="fee-package" className="w-full">
                    <SelectValue placeholder="Auto-filled from package" />
                  </SelectTrigger>
                  <SelectContent>
                    {(packages?.items ?? [])
                      .filter((pkg) => pkg.status === "active")
                      .map((pkg) => (
                        <SelectItem key={pkg._id} value={String(pkg._id)}>
                          {pkg.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedPackage && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {kind === "pt" ? "PT fee" : "Package fee"} (PKR)
                  </span>
                  <span className="figure">{formatMoney(packageFeeCents)}</span>
                </div>
                <label className="mt-2.5 flex items-center gap-2">
                  <Checkbox
                    checked={applyDiscount}
                    onCheckedChange={(checked) =>
                      setApplyDiscount(checked === true)
                    }
                  />
                  <span className="text-muted-foreground">
                    Apply package discount (10%)
                  </span>
                  {discountCents > 0 && (
                    <span className="figure ml-auto text-amber-300">
                      −{formatMoney(discountCents)}
                    </span>
                  )}
                </label>
                <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5 font-medium">
                  <span>Total (PKR)</span>
                  <span className="figure">{formatMoney(totalCents)}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {selectedPackage.durationMonths} period
                  {selectedPackage.durationMonths === 1 ? "" : "s"} (pay in
                  advance)
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="fee-paid">Amount paid (PKR) *</Label>
                <Input
                  id="fee-paid"
                  name="paid"
                  inputMode="decimal"
                  placeholder="0"
                  defaultValue={totalCents > 0 ? String(totalCents / 100) : ""}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fee-method">Payment method</Label>
                <Select name="method" defaultValue="cash">
                  <SelectTrigger id="fee-method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fee-start">Period start *</Label>
                <Input
                  id="fee-start"
                  name="periodStart"
                  type="date"
                  defaultValue={defaultStart}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fee-end">Period end *</Label>
                <Input
                  id="fee-end"
                  name="periodEnd"
                  type="date"
                  defaultValue={defaultEnd}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fee-date">Payment date (optional)</Label>
                <Input
                  id="fee-date"
                  name="paymentDate"
                  type="date"
                  defaultValue={defaultStart}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fee-trainer">Trainer (PT fees)</Label>
                <Select name="trainer" defaultValue="none">
                  <SelectTrigger id="fee-trainer" className="w-full">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(trainers?.items ?? []).map((trainer) => (
                      <SelectItem key={trainer._id} value={String(trainer._id)}>
                        {trainer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fee-notes">Notes</Label>
              <Textarea
                id="fee-notes"
                name="notes"
                rows={2}
                className="resize-none"
                placeholder="Receipt number, discount reason…"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !memberId}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
