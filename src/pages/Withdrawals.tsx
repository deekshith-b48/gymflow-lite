import { DataTable, type Column } from "@/components/workspace/DataTable";
import {
  EmptyState,
  PageHeader,
  SkeletonRows,
  Stat,
  StatGrid,
} from "@/components/workspace/primitives";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatMoney } from "@/lib/gym";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type WithdrawalRow = {
  _id: Id<"withdrawals">;
  date: number;
  amountCents: number;
  description?: string;
  withdrawnByName?: string;
  recordedByName?: string;
};

/**
 * Cash draws with the net-profit math on top: revenue − expenses − withdrawn,
 * so the owner sees what is actually left before taking money out.
 */
export default function Withdrawals() {
  const [adding, setAdding] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const withdrawals = useQuery(api.finance.listWithdrawals, {});
  const deleteWithdrawal = useMutation(api.finance.deleteWithdrawal);
  const stats = withdrawals?.stats;

  const columns: Column<WithdrawalRow>[] = [
    {
      key: "date",
      header: "Date",
      sortValue: (row) => row.date,
      render: (row) => (
        <span className="figure text-xs text-muted-foreground">
          {formatDate(row.date)}
        </span>
      ),
    },
    {
      key: "by",
      header: "Withdrawn By",
      sortValue: (row) => row.withdrawnByName ?? "",
      render: (row) => (
        <span className="text-sm">{row.withdrawnByName ?? "Owner"}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (row) => row.amountCents,
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.amountCents)}</span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.description || "—"}
        </span>
      ),
    },
    {
      key: "recorded",
      header: "Recorded By",
      sortValue: (row) => row.recordedByName ?? "",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.recordedByName ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Finance"
        title="Withdrawals"
        lede="Cash taken out of the till, and what it does to the gym's net profit."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Record withdrawal
          </Button>
        }
      />

      <StatGrid>
        <Stat
          label="Total Revenue"
          value={stats ? formatMoney(stats.totalRevenueCents) : "—"}
          loading={stats === undefined}
          hint="Fees + sales"
          tone="good"
        />
        <Stat
          label="Total Expenses"
          value={stats ? formatMoney(stats.totalExpensesCents) : "—"}
          loading={stats === undefined}
        />
        <Stat
          label="Net Profit"
          value={stats ? formatMoney(stats.netProfitCents) : "—"}
          loading={stats === undefined}
          hint="Revenue − expenses − withdrawn"
          tone={stats && stats.netProfitCents < 0 ? "alert" : "default"}
        />
        <Stat
          label="Withdrawn"
          value={stats ? formatMoney(stats.totalWithdrawnCents) : "—"}
          loading={stats === undefined}
        />
      </StatGrid>

      {withdrawals === undefined ? (
        <SkeletonRows rows={5} />
      ) : withdrawals.items.length === 0 ? (
        <EmptyState
          title="No withdrawals recorded"
          body="When cash leaves the till, record it here so the net profit figure stays true."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Record withdrawal
            </Button>
          }
        />
      ) : (
        <DataTable<WithdrawalRow>
          columns={columns}
          rows={withdrawals.items as unknown as WithdrawalRow[]}
          rowKey={(row) => row._id}
          initialSort={{ key: "date", direction: "desc" }}
          actions={(row) => (
            <div className="relative">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Row actions"
                onClick={() =>
                  setMenuFor((current) => (current === row._id ? null : row._id))
                }
              >
                ⋯
              </Button>
              {menuFor === row._id && (
                <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md">
                  <button
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-rose-300 hover:bg-accent"
                    onClick={async () => {
                      setMenuFor(null);
                      try {
                        await deleteWithdrawal({ withdrawalId: row._id });
                        toast("Withdrawal deleted");
                      } catch {
                        toast.error("Could not delete that withdrawal.");
                      }
                    }}
                  >
                    Delete withdrawal
                  </button>
                </div>
              )}
            </div>
          )}
        />
      )}

      <RecordWithdrawalDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function rupeesToCents(value: string) {
  const rupees = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

function todayInput() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return Date.now();
  return new Date(year, month - 1, day, 12).getTime();
}

function RecordWithdrawalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createWithdrawal = useMutation(api.finance.createWithdrawal);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amountCents = rupeesToCents(String(form.get("amount") ?? "0"));
    if (amountCents <= 0) {
      toast.error("Enter an amount.");
      return;
    }
    setSaving(true);
    try {
      await createWithdrawal({
        date: fromInput(String(form.get("date"))),
        amountCents,
        description: String(form.get("description") ?? "").trim() || undefined,
        withdrawnByName:
          String(form.get("withdrawnBy") ?? "").trim() || undefined,
      });
      toast.success("Withdrawal recorded");
      onOpenChange(false);
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not record the withdrawal.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-none sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="tracking-tight">
              Record withdrawal
            </DialogTitle>
            <DialogDescription>
              Cash leaving the till — it comes straight off the net profit.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="wd-amount">Amount (PKR) *</Label>
                <Input
                  id="wd-amount"
                  name="amount"
                  inputMode="decimal"
                  placeholder="0"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="wd-date">Date *</Label>
                <Input
                  id="wd-date"
                  name="date"
                  type="date"
                  defaultValue={todayInput()}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="wd-by">Withdrawn by</Label>
              <Input id="wd-by" name="withdrawnBy" placeholder="Owner name" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="wd-desc">Description</Label>
              <Textarea
                id="wd-desc"
                name="description"
                rows={2}
                className="resize-none"
                placeholder="Rent to plaza, personal draw…"
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Record withdrawal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
