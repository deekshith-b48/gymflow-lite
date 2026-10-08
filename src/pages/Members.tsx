import { MemberFormDialog } from "@/components/MemberFormDialog";
import { DataTable, type Column } from "@/components/workspace/DataTable";
import {
  EmptyState,
  PageHeader,
  SkeletonRows,
  Stat,
  StatGrid,
  StatusChip,
  SearchInput,
} from "@/components/workspace/primitives";
import { Button } from "@/components/ui/button";
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
  daysUntil,
  formatMoney,
  initials,
  MEMBER_STATUS_OPTIONS,
} from "@/lib/gym";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

type RosterRow = {
  _id: Id<"members">;
  name: string;
  email?: string;
  phone?: string;
  memberCode?: string;
  status: string;
  planLabel: string;
  memberType?: "member" | "staff";
  addOns?: string[];
  regFeeCents?: number;
  renewsAt: number;
  planPriceCents: number;
  duesAmountCents: number;
  dues: { state: string; label: string };
  lastCheckInAt: number | null;
};

function feeStatusOf(row: RosterRow) {
  if (row.duesAmountCents <= 0) return "paid";
  return row.dues.state === "overdue" ? "pending" : "partial";
}

/**
 * The roster as a data table: summary cards on top, search + status/type/
 * package/expiring filters, sortable columns and 20-per-page pagination.
 */
export default function Members() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [packageName, setPackage] = useState("all");
  const [expiring, setExpiring] = useState("all");
  const [adding, setAdding] = useState(false);

  const roster = useQuery(api.members.list, {
    search,
    status,
    type,
    package: packageName,
    expiring,
  });

  const stats = roster?.stats;

  const columns: Column<RosterRow>[] = [
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
      key: "name",
      header: "Member",
      sortValue: (row) => row.name,
      render: (row) => (
        <Link
          to={`/dashboard/members/${row._id}`}
          className="flex items-center gap-2.5"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[10px] font-medium">
            {initials(row.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {row.name}
            </span>
            {row.email && (
              <span className="block truncate text-xs text-muted-foreground">
                {row.email}
              </span>
            )}
          </span>
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      key: "package",
      header: "Package",
      sortValue: (row) => row.planLabel,
      render: (row) => <span className="text-sm">{row.planLabel}</span>,
    },
    {
      key: "addons",
      header: "Add-ons",
      render: (row) =>
        row.addOns?.length ? (
          <span className="text-xs text-muted-foreground">
            {row.addOns.join(", ")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">None</span>
        ),
    },
    {
      key: "fee",
      header: "Fee Status",
      sortValue: (row) => feeStatusOf(row),
      render: (row) => <StatusChip status={feeStatusOf(row)} />,
    },
    {
      key: "due",
      header: "Next Due",
      sortValue: (row) => row.renewsAt,
      render: (row) => {
        const days = daysUntil(row.renewsAt);
        return (
          <span
            className={`figure text-xs ${days < 0 ? "text-rose-300" : "text-muted-foreground"}`}
          >
            {new Date(row.renewsAt).toLocaleDateString("en-GB")}
          </span>
        );
      },
    },
    {
      key: "feeAmount",
      header: "Package Fee",
      align: "right",
      sortValue: (row) => row.planPriceCents,
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.planPriceCents)}</span>
      ),
    },
    {
      key: "regFee",
      header: "Reg. Fee",
      align: "right",
      sortValue: (row) => row.regFeeCents ?? 0,
      render: (row) => (
        <span className="figure text-sm">
          {formatMoney(row.regFeeCents ?? 0)}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => (
        <span className="figure text-xs text-muted-foreground">
          {row.phone ? `+92 ${row.phone}` : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Roster"
        title="Members"
        lede={
          stats
            ? `${stats.active} active · ${stats.overdue} behind on dues`
            : "Loading the roster…"
        }
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add member
          </Button>
        }
      />

      <StatGrid>
        <Stat
          label="Total Members"
          value={stats ? String(stats.total) : "—"}
          loading={stats === undefined}
        />
        <Stat
          label="Active Members"
          value={stats ? String(stats.active) : "—"}
          loading={stats === undefined}
          tone="good"
        />
        <Stat
          label="New This Month"
          value={stats ? String(stats.newThisMonth) : "—"}
          loading={stats === undefined}
        />
        <Stat
          label="Reg. Fee Collected"
          value={stats ? formatMoney(stats.regFeeCollectedCents) : "—"}
          loading={stats === undefined}
        />
      </StatGrid>

      {roster === undefined ? (
        <SkeletonRows rows={7} />
      ) : roster.items.length === 0 ? (
        <EmptyState
          title="No members here yet"
          body={
            search || status !== "all" || type !== "all" || packageName !== "all"
              ? "Nothing matches that filter. Try a broader search."
              : "Add the first member and the roster, dues and check-in log start filling in."
          }
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add member
            </Button>
          }
        />
      ) : (
        <DataTable<RosterRow>
          columns={columns}
          rows={roster.items as unknown as RosterRow[]}
          rowKey={(row) => row._id}
          initialSort={{ key: "name", direction: "asc" }}
          toolbar={
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by name, ID, email or phone"
              />
              <div className="flex flex-wrap gap-2">
                <FilterSelect
                  value={status}
                  onChange={setStatus}
                  placeholder="All Status"
                  options={MEMBER_STATUS_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
                <FilterSelect
                  value={type}
                  onChange={setType}
                  placeholder="All Type"
                  options={[
                    { value: "member", label: "Member" },
                    { value: "staff", label: "Staff" },
                  ]}
                />
                <FilterSelect
                  value={packageName}
                  onChange={setPackage}
                  placeholder="All Packages"
                  options={(stats?.packageNames ?? []).map((name) => ({
                    value: name,
                    label: name,
                  }))}
                />
                <FilterSelect
                  value={expiring}
                  onChange={setExpiring}
                  placeholder="Expiring"
                  options={[
                    { value: "7", label: "Expiring in 7 days" },
                    { value: "30", label: "Expiring in 30 days" },
                  ]}
                />
              </div>
            </div>
          }
          actions={(row) => (
            <Button asChild size="sm" variant="ghost" className="h-8">
              <Link to={`/dashboard/members/${row._id}`}>Open</Link>
            </Button>
          )}
        />
      )}

      <MemberFormDialog open={adding} onOpenChange={setAdding} />
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
