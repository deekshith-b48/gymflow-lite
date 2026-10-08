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
import { EXPENSE_CATEGORIES, formatDate, formatMoney } from "@/lib/gym";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ExpenseRow = {
  _id: Id<"expenses">;
  date: number;
  category: string;
  description?: string;
  amountCents: number;
  status: string;
  loggedByName?: string;
};

/** Operating expenses: rent, salaries, utilities, PT commission and more. */
export default function Expenses() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const expenses = useQuery(api.finance.listExpenses, {
    search,
    category,
    status,
  });
  const deleteExpense = useMutation(api.finance.deleteExpense);
  const stats = expenses?.stats;

  const columns: Column<ExpenseRow>[] = [
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
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
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
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      key: "by",
      header: "Logged By",
      sortValue: (row) => row.loggedByName ?? "",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.loggedByName ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Finance"
        title="Expenses"
        lede="Everything the gym spends — logged against a category for the breakdown chart."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add expense
          </Button>
        }
      />

      <StatGrid>
        <Stat
          label="This Month"
          value={stats ? formatMoney(stats.thisMonthCents) : "—"}
          loading={stats === undefined}
        />
        <Stat
          label="This Year"
          value={stats ? formatMoney(stats.thisYearCents) : "—"}
          loading={stats === undefined}
          hint={String(new Date().getFullYear())}
        />
        <Stat
          label="Top Category"
          value={stats?.topCategory ?? "—"}
          loading={stats === undefined}
          hint={
            stats?.topCategoryCents
              ? `${formatMoney(stats.topCategoryCents)} this month`
              : undefined
          }
        />
        <Stat
          label="Pending"
          value={stats ? formatMoney(stats.pendingCents) : "—"}
          loading={stats === undefined}
          tone={stats && stats.pendingCents > 0 ? "alert" : "default"}
        />
      </StatGrid>

      {expenses === undefined ? (
        <SkeletonRows rows={6} />
      ) : expenses.items.length === 0 ? (
        <EmptyState
          title="No expenses recorded"
          body="Log rent, salaries or utilities and the dashboard's expense breakdown starts tracking."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add expense
            </Button>
          }
        />
      ) : (
        <DataTable<ExpenseRow>
          columns={columns}
          rows={expenses.items as unknown as ExpenseRow[]}
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
                  options={EXPENSE_CATEGORIES.map((entry) => ({
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
                        await deleteExpense({ expenseId: row._id });
                        toast("Expense deleted");
                      } catch {
                        toast.error("Could not delete that expense.");
                      }
                    }}
                  >
                    Delete expense
                  </button>
                </div>
              )}
            </div>
          )}
        />
      )}

      <AddExpenseDialog open={adding} onOpenChange={setAdding} />
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

function AddExpenseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createExpense = useMutation(api.finance.createExpense);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amountCents = rupeesToCents(String(form.get("amount") ?? "0"));
    if (amountCents <= 0) {
      toast.error("Enter an expense amount.");
      return;
    }
    setSaving(true);
    try {
      await createExpense({
        date: fromInput(String(form.get("date"))),
        category: String(form.get("category")),
        description: String(form.get("description") ?? "").trim() || undefined,
        amountCents,
        status: String(form.get("status")) as "paid" | "pending",
      });
      toast.success("Expense logged");
      onOpenChange(false);
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not log the expense.",
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
            <DialogTitle className="tracking-tight">Add expense</DialogTitle>
            <DialogDescription>
              Categorise it so the breakdown chart stays honest.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="expense-category">Category *</Label>
              <Select name="category" defaultValue="Other">
                <SelectTrigger id="expense-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="expense-desc">Description</Label>
              <Input
                id="expense-desc"
                name="description"
                placeholder="Treadmill servicing, new dumbbell set…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="expense-amount">Amount (PKR) *</Label>
                <Input
                  id="expense-amount"
                  name="amount"
                  inputMode="decimal"
                  placeholder="0"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expense-date">Date *</Label>
                <Input
                  id="expense-date"
                  name="date"
                  type="date"
                  defaultValue={todayInput()}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expense-status">Status</Label>
                <Select name="status" defaultValue="paid">
                  <SelectTrigger id="expense-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
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
              Log expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
