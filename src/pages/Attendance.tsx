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
import { TrendLine } from "@/components/workspace/charts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatTime } from "@/lib/gym";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  LogIn,
  LogOut,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type LogRow = {
  _id: Id<"checkIns">;
  at: number;
  punchedOutAt: number | null;
  memberId: Id<"members">;
  memberCode: string;
  memberName: string;
  kind: string;
  status: string;
  feeStatus: string;
  source: string;
};

/**
 * Attendance: the four summary cards, the 30-day trend line, and the visit
 * log with punch in/out — plus manual check-in for walk-ups without a card.
 */
export default function Attendance() {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [feeStatus, setFeeStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [manualOpen, setManualOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const log = useQuery(api.checkIns.log, {
    search,
    kind,
    status,
    feeStatus,
    source,
  });
  const series = useQuery(api.checkIns.dailySeries, {});
  const punchOut = useMutation(api.checkIns.punchOut);
  const undo = useMutation(api.checkIns.undo);

  const seriesData = (series ?? []).map((point) => ({
    label: new Date(point.date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
    }),
    value: point.count,
  }));

  const columns: Column<LogRow>[] = [
    {
      key: "code",
      header: "ID",
      sortValue: (row) => row.memberCode,
      render: (row) => (
        <span className="figure text-xs text-muted-foreground">
          {row.memberCode}
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
      sortValue: (row) => row.memberName,
      render: (row) => (
        <span className="text-sm font-medium">{row.memberName}</span>
      ),
    },
    {
      key: "kind",
      header: "Type",
      sortValue: (row) => row.kind,
      render: (row) => <StatusChip status={row.kind} />,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      key: "fee",
      header: "Fee Status",
      sortValue: (row) => row.feeStatus,
      render: (row) => <StatusChip status={row.feeStatus} />,
    },
    {
      key: "date",
      header: "Date",
      sortValue: (row) => row.at,
      render: (row) => (
        <span className="figure text-xs text-muted-foreground">
          {formatDate(row.at)}
        </span>
      ),
    },
    {
      key: "time",
      header: "Time",
      sortValue: (row) => row.at,
      render: (row) => (
        <span className="figure text-xs">
          {formatTime(row.at)}
          {row.punchedOutAt && ` → ${formatTime(row.punchedOutAt)}`}
        </span>
      ),
    },
    {
      key: "punch",
      header: "Punch",
      render: (row) =>
        row.punchedOutAt ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5" />
            Out {formatTime(row.punchedOutAt)}
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 shadow-none"
            onClick={async () => {
              try {
                await punchOut({ checkInId: row._id });
                toast.success(`${row.memberName} punched out`);
              } catch (caught) {
                toast.error(
                  caught instanceof Error
                    ? caught.message
                    : "Could not punch out.",
                );
              }
            }}
          >
            <LogOut className="size-3.5" />
            Check-out
          </Button>
        ),
    },
    {
      key: "source",
      header: "Source",
      sortValue: (row) => row.source,
      render: (row) => <StatusChip status={row.source} />,
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Front desk"
        title="Attendance"
        lede="Every visit, who recorded it, and the punch state at the desk."
        actions={
          <Button onClick={() => setManualOpen(true)}>
            <Plus className="size-4" />
            Check-In
          </Button>
        }
      />

      <StatGrid>
        <Stat
          label="Today"
          value={log ? String(log.stats.today) : "—"}
          loading={log === undefined}
        />
        <Stat
          label="This Month"
          value={log ? String(log.stats.thisMonth) : "—"}
          loading={log === undefined}
        />
        <Stat
          label="Daily Average"
          value={log ? String(log.stats.dailyAverage30d) : "—"}
          loading={log === undefined}
          hint="Last 30 days"
        />
        <Stat
          label="Total"
          value={log ? String(log.stats.allTime) : "—"}
          loading={log === undefined}
          hint="All-time check-ins"
        />
      </StatGrid>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="eyebrow">Last 30 days</p>
          <p className="eyebrow">Daily check-ins</p>
        </div>
        <div className="px-4 py-4">
          {series === undefined ? (
            <SkeletonRows rows={2} />
          ) : (
            <TrendLine data={seriesData} />
          )}
        </div>
      </section>

      {log === undefined ? (
        <SkeletonRows rows={8} />
      ) : log.items.length === 0 ? (
        <EmptyState
          title="No visits match"
          body="Adjust the filters, or record a manual check-in for someone at the desk."
          action={
            <Button onClick={() => setManualOpen(true)}>
              <Plus className="size-4" />
              Check-In
            </Button>
          }
        />
      ) : (
        <DataTable<LogRow>
          columns={columns}
          rows={log.items as unknown as LogRow[]}
          rowKey={(row) => row._id}
          initialSort={{ key: "date", direction: "desc" }}
          toolbar={
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search member name or ID"
              />
              <div className="flex flex-wrap gap-2">
                <FilterSelect
                  value={kind}
                  onChange={setKind}
                  placeholder="All Types"
                  options={[
                    { value: "member", label: "Member" },
                    { value: "staff", label: "Staff" },
                  ]}
                />
                <FilterSelect
                  value={status}
                  onChange={setStatus}
                  placeholder="All Status"
                  options={[
                    { value: "active", label: "Active" },
                    { value: "expired", label: "Expired" },
                    { value: "inactive", label: "Inactive" },
                    { value: "frozen", label: "Frozen" },
                  ]}
                />
                <FilterSelect
                  value={feeStatus}
                  onChange={setFeeStatus}
                  placeholder="All Fee Status"
                  options={[
                    { value: "paid", label: "Paid" },
                    { value: "partial", label: "Partial" },
                    { value: "pending", label: "Pending" },
                  ]}
                />
                <FilterSelect
                  value={source}
                  onChange={setSource}
                  placeholder="All Sources"
                  options={[
                    { value: "machine", label: "Machine" },
                    { value: "manual", label: "Manual" },
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
                  setMenuFor((current) =>
                    current === row._id ? null : row._id,
                  )
                }
              >
                <MoreHorizontal className="size-4" />
              </Button>
              {menuFor === row._id && (
                <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md">
                  <button
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={async () => {
                      setMenuFor(null);
                      try {
                        await undo({ checkInId: row._id });
                        toast("Check-in removed");
                      } catch {
                        toast.error("Could not remove that check-in.");
                      }
                    }}
                  >
                    Remove check-in
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => setMenuFor(null)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}
        />
      )}

      <ManualCheckInDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        onDone={() => setMenuFor(null)}
      />
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

/** Manual check-in for a member at the desk without a machine scan. */
function ManualCheckInDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const members = useQuery(api.members.list, {});
  const checkIn = useMutation(api.checkIns.checkIn);
  const [memberId, setMemberId] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCheckIn() {
    if (!memberId) {
      toast.error("Pick a member first.");
      return;
    }
    setSaving(true);
    try {
      const result = await checkIn({
        memberId: memberId as Id<"members">,
        source: "manual",
      });
      const name = members?.items.find(
        (member) => String(member._id) === memberId,
      )?.name;
      toast.success(
        result.duplicate
          ? `${name} was just checked in`
          : `${name} checked in`,
      );
      onOpenChange(false);
      onDone();
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not check in.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Manual check-in</DialogTitle>
          <DialogDescription>
            Record a visit for someone at the desk whose scan didn&apos;t go
            through.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a member" />
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

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleCheckIn} disabled={saving || !memberId}>
            <LogIn className="size-4" />
            Check in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
