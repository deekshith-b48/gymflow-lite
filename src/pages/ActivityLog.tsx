import {
  EmptyState,
  PageHeader,
  SearchInput,
  SkeletonRows,
  StatusChip,
} from "@/components/workspace/primitives";
import { DataTable, type Column } from "@/components/workspace/DataTable";
import { DateRangeFilter } from "@/components/workspace/DateRangeFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import {
  formatDateTime,
  resolveDateRange,
  type DateRangePreset,
} from "@/lib/gym";
import { useQuery } from "convex/react";
import { useState } from "react";

const CATEGORIES = [
  { value: "members", label: "Members" },
  { value: "payments", label: "Payments" },
  { value: "expenses", label: "Expenses" },
  { value: "sales", label: "Sales" },
  { value: "withdrawals", label: "Withdrawals" },
  { value: "packages", label: "Packages" },
  { value: "addons", label: "Add-ons" },
  { value: "roles", label: "Roles" },
  { value: "staff", label: "Staff" },
  { value: "settings", label: "Gym Settings" },
  { value: "auth", label: "Authentication" },
  { value: "attendance", label: "Attendance" },
  { value: "other", label: "Other" },
];

const EVENTS = [
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "auth", label: "Auth" },
  { value: "other", label: "Other" },
];

/** Quick periods beside the custom range, matching the spec's filter row. */
const QUICK_PERIODS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last15", label: "Last 15 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "lastMonth", label: "Last Month" },
  { value: "thisYear", label: "This Year" },
];

type LogRow = {
  _id: string;
  at: number;
  userName: string;
  userEmail?: string | null;
  event: string;
  category: string;
  activity: string;
};

/** The full audit trail: search, module, event and period filters. */
export default function ActivityLog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [event, setEvent] = useState("all");
  const [preset, setPreset] = useState<DateRangePreset>("last30");
  const [range, setRange] = useState(() => resolveDateRange("last30"));

  const activity = useQuery(api.activity.list, {
    search,
    category,
    event,
    from: range.from,
    to: range.to,
  });

  const columns: Column<LogRow>[] = [
    {
      key: "at",
      header: "Date/Time",
      sortValue: (row) => row.at,
      render: (row) => (
        <span className="figure whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(row.at)}
        </span>
      ),
    },
    {
      key: "user",
      header: "User",
      sortValue: (row) => row.userName,
      render: (row) => (
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {row.userName}
          </span>
          {row.userEmail && (
            <span className="block truncate text-xs text-muted-foreground">
              {row.userEmail}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "event",
      header: "Event",
      sortValue: (row) => row.event,
      render: (row) => <StatusChip status={row.event} />,
    },
    {
      key: "category",
      header: "Module",
      sortValue: (row) => row.category,
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {CATEGORIES.find((entry) => entry.value === row.category)?.label ??
            row.category}
        </span>
      ),
    },
    {
      key: "activity",
      header: "Activity",
      render: (row) => <span className="text-sm">{row.activity}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Audit"
        title="Activity Log"
        lede="Who did what, when — every mutation in the workspace leaves a row."
      />

      <DateRangeFilter
        preset={preset}
        onPresetChange={setPreset}
        range={range}
        onRangeChange={setRange}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search activity, user or email"
        />
        <div className="flex flex-wrap gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-auto min-w-40 bg-card shadow-none">
              <SelectValue placeholder="All activity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activity</SelectItem>
              {CATEGORIES.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={event} onValueChange={setEvent}>
            <SelectTrigger className="h-9 w-auto min-w-32 bg-card shadow-none">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {EVENTS.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={preset}
            onValueChange={(value) => {
              setPreset(value as DateRangePreset);
              setRange(resolveDateRange(value as DateRangePreset));
            }}
          >
            <SelectTrigger className="h-9 w-auto min-w-36 bg-card shadow-none">
              <SelectValue placeholder="Quick period" />
            </SelectTrigger>
            <SelectContent>
              {QUICK_PERIODS.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {activity === undefined ? (
        <SkeletonRows rows={8} />
      ) : activity.items.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          body="Widen the date range or clear the filters — activity rows appear as soon as your team starts working."
        />
      ) : (
        <DataTable<LogRow>
          columns={columns}
          rows={activity.items as unknown as LogRow[]}
          rowKey={(row) => row._id}
          initialSort={{ key: "at", direction: "desc" }}
          pageSize={50}
        />
      )}
    </div>
  );
}
