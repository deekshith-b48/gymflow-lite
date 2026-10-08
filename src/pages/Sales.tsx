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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  formatDate,
  formatMoney,
  PAY_METHODS,
  SALE_CATEGORIES,
} from "@/lib/gym";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type SaleRow = {
  _id: Id<"sales">;
  date: number;
  category: string;
  description?: string;
  amountCents: number;
  method: string;
  status: string;
  recordedByName?: string;
};

/** POS-style sales log: category filters, methods, who recorded each sale. */
export default function Sales() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const sales = useQuery(api.finance.listSales, { search, category, status });
  const deleteSale = useMutation(api.finance.deleteSale);
  const stats = sales?.stats;

  const columns: Column<SaleRow>[] = [
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
      key: "category",
      header: "Category",
      sortValue: (row) => row.category,
      render: (row) => (
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${CATEGORY_TONES[row.category] ?? "border-border bg-muted text-muted-foreground"}`}
        >
          {row.category}
        </span>
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
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (row) => row.amountCents,
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.amountCents)}</span>
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
      key: "by",
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
        eyebrow="Point of sale"
        title="Sales"
        lede="Supplements, accessories, apparel and beverages sold at the counter."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add sale
          </Button>
        }
      />

      <StatGrid>
        <Stat
          label="This Month"
          value={stats ? formatMoney(stats.thisMonthCents) : "—"}
          loading={stats === undefined}
          tone="good"
        />
        <Stat
          label="Sales Count"
          value={stats ? String(stats.count) : "—"}
          loading={stats === undefined}
          hint="This month"
        />
        <Stat
          label="Top Category"
          value={stats?.topCategory ?? "—"}
          loading={stats === undefined}
          hint={stats?.topCategoryCents ? formatMoney(stats.topCategoryCents) : undefined}
        />
        <Stat
          label="Pending"
          value={stats ? formatMoney(stats.pendingCents) : "—"}
          loading={stats === undefined}
          tone={stats && stats.pendingCents > 0 ? "alert" : "default"}
        />
      </StatGrid>

      {sales === undefined ? (
        <SkeletonRows rows={6} />
      ) : sales.items.length === 0 ? (
        <EmptyState
          title="No sales recorded"
          body="Log the first counter sale and the sales, categories and dashboard revenue pick it up."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add sale
            </Button>
          }
        />
      ) : (
        <DataTable<SaleRow>
          columns={columns}
          rows={sales.items as unknown as SaleRow[]}
          rowKey={(row) => row._id}
          initialSort={{ key: "date", direction: "desc" }}
          toolbar={
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search description, category or staff"
              />
              <div className="flex flex-wrap gap-2">
                <FilterSelect
                  value={category}
                  onChange={setCategory}
                  placeholder="All Categories"
                  options={SALE_CATEGORIES.map((entry) => ({
                    value: entry,
                    label: entry,
                  }))}
                />
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
              </div>
            </div>
          }
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
                        await deleteSale({ saleId: row._id });
                        toast("Sale deleted");
                      } catch {
                        toast.error("Could not delete that sale.");
                      }
                    }}
                  >
                    Delete sale
                  </button>
                </div>
              )}
            </div>
          )}
        />
      )}

      <AddSaleDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

const CATEGORY_TONES: Record<string, string> = {
  Supplements: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  Accessories: "border-sky-400/35 bg-sky-400/10 text-sky-300",
  Apparel: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  Beverages: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
};

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
      <SelectTrigger className="h-9 w-auto min-w-36 bg-card shadow-none">
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

function AddSaleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createSale = useMutation(api.finance.createSale);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amountCents = rupeesToCents(String(form.get("amount") ?? "0"));
    if (amountCents <= 0) {
      toast.error("Enter a sale amount.");
      return;
    }
    setSaving(true);
    try {
      await createSale({
        date: fromInput(String(form.get("date"))),
        category: String(form.get("category")),
        description: String(form.get("description") ?? "").trim() || undefined,
        amountCents,
        method: String(form.get("method")) as "cash" | "bank" | "card" | "online",
        status: String(form.get("status")) as "paid" | "partial" | "pending",
      });
      toast.success("Sale recorded");
      onOpenChange(false);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not record the sale.",
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
            <DialogTitle className="tracking-tight">Add sale</DialogTitle>
            <DialogDescription>
              Record a counter sale — it lands in revenue immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="sale-category">Category *</Label>
              <Select name="category" defaultValue="Supplements">
                <SelectTrigger id="sale-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALE_CATEGORIES.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sale-desc">Description</Label>
              <Input
                id="sale-desc"
                name="description"
                placeholder="Whey protein 2kg, lifting grips…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="sale-amount">Amount (PKR) *</Label>
                <Input
                  id="sale-amount"
                  name="amount"
                  inputMode="decimal"
                  placeholder="0"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sale-method">Method</Label>
                <Select name="method" defaultValue="cash">
                  <SelectTrigger id="sale-method" className="w-full">
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
                <Label htmlFor="sale-date">Date *</Label>
                <Input
                  id="sale-date"
                  name="date"
                  type="date"
                  defaultValue={todayInput()}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sale-status">Status</Label>
                <Select name="status" defaultValue="paid">
                  <SelectTrigger id="sale-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              Record sale
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
