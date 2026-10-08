import { AddFeeDialog } from "@/pages/Fees";
import { MemberFormDialog } from "@/components/MemberFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/workspace/primitives";
import { DataTable, type Column } from "@/components/workspace/DataTable";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  cycleProgress,
  daysUntil,
  duesBadgeClass,
  duesTextClass,
  formatDate,
  formatDateTime,
  formatMoney,
  formatRecency,
  formatRenewal,
  initials,
  planDurationDays,
} from "@/lib/gym";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  Loader2,
  LogIn,
  Mail,
  Pencil,
  Phone,
  Snowflake,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { toast } from "sonner";

/**
 * The edit dialog still speaks the original three-state lifecycle (active,
 * paused, cancelled); the richer states — frozen, expired, inactive — are set
 * by the dedicated lifecycle actions, so opening a member in that dialog maps
 * an exotic state onto its closest editable equivalent.
 */
function dialogStatus(status: string): "active" | "paused" | "cancelled" {
  if (status === "active") return "active";
  if (status === "cancelled") return "cancelled";
  return "paused";
}

/**
 * The member's home screen: profile header, the four financial summary
 * cards, then Payments and Attendance behind tabs — with freeze, edit and
 * add-payment within one tap of the top.
 */
export default function MemberDetail() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = useQuery(
    api.members.get,
    memberId ? { memberId: memberId as Id<"members"> } : "skip",
  );
  const feeHistory = useQuery(
    api.finance.memberFees,
    memberId ? { memberId: memberId as Id<"members"> } : "skip",
  );

  const checkIn = useMutation(api.checkIns.checkIn);
  const settleDues = useMutation(api.members.settleDues);
  const removeMember = useMutation(api.members.remove);
  const setLifecycle = useMutation(api.members.setLifecycle);

  if (data === undefined) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-sm font-medium">That member is gone</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The record was deleted, or the link is out of date.
        </p>
        <Button asChild variant="outline" className="mt-5 shadow-none">
          <Link to="/dashboard/members">Back to the roster</Link>
        </Button>
      </div>
    );
  }

  const { member, checkIns, stats } = data;
  const owed = member.duesAmountCents > 0;
  const daysLeft = Math.max(0, daysUntil(member.renewsAt));
  const progress = cycleProgress(member.planStartedAt, member.renewsAt);
  const isFrozen = member.status === "frozen";

  async function handleCheckIn() {
    setBusy(true);
    try {
      const result = await checkIn({ memberId: member._id });
      toast.success(
        result.duplicate
          ? `${member.name} was just checked in`
          : `${member.name} checked in`,
      );
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not check in.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSettle() {
    setBusy(true);
    try {
      await settleDues({ memberId: member._id });
      toast.success(`Dues settled for ${member.name}`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not record payment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFreeze() {
    setBusy(true);
    try {
      const next = isFrozen ? "active" : "frozen";
      await setLifecycle({ memberId: member._id, status: next });
      toast.success(
        isFrozen
          ? `${member.name}'s membership unfrozen`
          : `${member.name}'s membership frozen`,
      );
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not update status.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    try {
      await removeMember({ memberId: member._id });
      toast(`${member.name} removed from the roster`);
      navigate("/dashboard/members");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not remove member.",
      );
    }
  }

  const feeColumns: Column<{
    _id: string;
    kind: string;
    packageName: string | null;
    periodStart: number;
    periodEnd: number;
    totalCents: number;
    packageFeeCents: number;
    ptFeeCents: number;
    discountCents: number;
    paidCents: number;
    balanceCents: number;
    method: string;
    status: string;
    paymentDate: number;
  }>[] = [
    {
      key: "type",
      header: "Type",
      render: (row) => (
        <span className="text-sm capitalize">
          {row.kind === "addon"
            ? row.packageName ?? "Add-on"
            : row.kind === "pt"
              ? "Personal Training"
              : row.packageName ?? "Membership"}
        </span>
      ),
    },
    {
      key: "period",
      header: "Period",
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
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.totalCents)}</span>
      ),
    },
    {
      key: "paid",
      header: "Paid",
      align: "right",
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.paidCents)}</span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (row) => (
        <span
          className={cn(
            "figure text-sm",
            row.balanceCents > 0 ? "text-rose-300" : "text-muted-foreground",
          )}
        >
          {formatMoney(row.balanceCents)}
        </span>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (row) => <StatusChip status={row.method} />,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      key: "date",
      header: "Payment Date",
      sortValue: (row) => row.paymentDate,
      render: (row) => (
        <span className="figure text-xs text-muted-foreground">
          {formatDate(row.paymentDate)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <Link
        to="/dashboard/members"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Roster
      </Link>

      {/* Profile header */}
      <header className="flex items-start gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-base">
          {initials(member.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">{member.name}</h1>
            <StatusChip status={member.status} />
            <span className="figure text-xs text-muted-foreground">
              {member.memberCode ?? ""}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{member.planLabel}</span>
            <span aria-hidden>·</span>
            <span>Member since {formatDate(member.joinedAt)}</span>
            {member.phone && (
              <>
                <span aria-hidden>·</span>
                <span className="figure">+92 {member.phone}</span>
              </>
            )}
            {member.email && (
              <>
                <span aria-hidden>·</span>
                <span>{member.email}</span>
              </>
            )}
            {member.cnic && (
              <>
                <span aria-hidden>·</span>
                <span className="figure">CNIC {member.cnic}</span>
              </>
            )}
            {member.gender && (
              <>
                <span aria-hidden>·</span>
                <span className="capitalize">{member.gender}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Financial summary cards */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
        <div className="bg-card px-5 py-4">
          <p className="eyebrow">Total Paid</p>
          <p className="figure mt-2 text-2xl font-medium">
            {feeHistory
              ? formatMoney(feeHistory.stats.totalPaidCents)
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Across all payment records
          </p>
        </div>
        <div className="bg-card px-5 py-4">
          <p className="eyebrow">Outstanding</p>
          <p
            className={cn(
              "figure mt-2 text-2xl font-medium",
              feeHistory && feeHistory.stats.outstandingCents > 0
                ? "text-rose-300"
                : "",
            )}
          >
            {feeHistory
              ? formatMoney(feeHistory.stats.outstandingCents)
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Registration + payments
          </p>
        </div>
        <div className="bg-card px-5 py-4">
          <p className="eyebrow">Package Expiry</p>
          <p className="figure mt-2 text-2xl font-medium">
            {formatDate(member.renewsAt)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {daysUntil(member.renewsAt) < 0
              ? `Expired ${Math.abs(daysUntil(member.renewsAt))}d ago`
              : `${daysLeft} days remaining`}
          </p>
        </div>
        <div className="bg-card px-5 py-4">
          <p className="eyebrow">Total Check-ins</p>
          <p className="figure mt-2 text-2xl font-medium">{stats.totalVisits}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.lastVisitAt
              ? `Last: ${formatDateTime(stats.lastVisitAt)}`
              : "No visits yet"}
          </p>
        </div>
      </div>

      {/* Plan & dues */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5">
          <div>
            <p className="eyebrow">Plan &amp; dues</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {member.planLabel}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="figure">
                {formatMoney(member.planPriceCents)}
              </span>{" "}
              per {planDurationDays(member.plan)} days ·{" "}
              {formatRenewal(member.renewsAt)}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[10.5px] tracking-wide",
              duesBadgeClass(member.dues.state),
            )}
          >
            {member.dues.label}
          </span>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-2">
          <div className="bg-card px-5 py-4">
            <p className="eyebrow">Balance</p>
            <p
              className={cn(
                "figure mt-1.5 text-3xl font-medium",
                duesTextClass(member.dues.state),
              )}
            >
              {formatMoney(member.duesAmountCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {owed
                ? member.duesDueAt
                  ? `Due ${formatDate(member.duesDueAt)}`
                  : "No due date on file"
                : "Paid up for this cycle"}
            </p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="eyebrow">Cycle</p>
            <p className="figure mt-1.5 text-3xl font-medium">
              {daysLeft}
              <span className="ml-1 text-base text-muted-foreground">
                days left
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Started {formatDate(member.planStartedAt)}
            </p>
          </div>
        </div>

        <div className="h-px w-full bg-border">
          <div
            className="h-px bg-foreground"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <Button onClick={() => setAddingPayment(true)}>
            <CreditCard className="size-4" />
            Add payment
          </Button>

          <Button
            variant="outline"
            className="gap-2 shadow-none"
            onClick={handleFreeze}
            disabled={busy}
          >
            <Snowflake className="size-4" />
            {isFrozen ? "Unfreeze" : "Freeze membership"}
          </Button>

          <Button
            variant="outline"
            className="gap-2 shadow-none"
            onClick={handleCheckIn}
            disabled={busy || stats.checkedInToday}
          >
            <LogIn className="size-4" />
            {stats.checkedInToday ? "Checked in today" : "Check in"}
          </Button>

          <Button
            variant="ghost"
            className="gap-2"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" />
            Edit member
          </Button>

          {owed && (
            <Button variant="ghost" onClick={handleSettle} disabled={busy}>
              <BadgeCheck className="size-4" />
              Mark dues paid
            </Button>
          )}

          <Button
            variant="ghost"
            className="ml-auto gap-2 text-muted-foreground hover:text-rose-300"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        </div>
      </section>

      {/* Contact grid */}
      <section className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        <div className="bg-card px-5 py-4">
          <p className="eyebrow">Email</p>
          <p className="mt-1.5 flex items-center gap-2 text-sm">
            <Mail className="size-3.5 text-muted-foreground" />
            {member.email ?? "—"}
          </p>
        </div>
        <div className="bg-card px-5 py-4">
          <p className="eyebrow">Phone</p>
          <p className="mt-1.5 flex items-center gap-2 text-sm">
            <Phone className="size-3.5 text-muted-foreground" />
            {member.phone ? `+92 ${member.phone}` : "—"}
          </p>
        </div>
        <div className="bg-card px-5 py-4">
          <p className="eyebrow">Package</p>
          <p className="mt-1.5 text-sm">{member.planLabel}</p>
        </div>
        {member.note && (
          <div className="bg-card px-5 py-4 sm:col-span-3">
            <p className="eyebrow">Note</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {member.note}
            </p>
          </div>
        )}
      </section>

      {/* Tabs: Payments / Attendance */}
      <Tabs defaultValue="payments" className="flex flex-col gap-5">
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          {feeHistory === undefined ? (
            <p className="text-sm text-muted-foreground">Loading payments…</p>
          ) : feeHistory.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm font-medium">No payments yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Record the first fee and this member's payment history fills in.
              </p>
              <Button className="mt-4" onClick={() => setAddingPayment(true)}>
                <CreditCard className="size-4" />
                Add payment
              </Button>
            </div>
          ) : (
            <DataTable
              columns={feeColumns}
              rows={feeHistory.items}
              rowKey={(row) => row._id}
              initialSort={{ key: "date", direction: "desc" }}
            />
          )}
        </TabsContent>

        <TabsContent value="attendance">
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="eyebrow">Check-in history</p>
              <p className="eyebrow">{stats.visits30d} in the last 30 days</p>
            </div>
            {checkIns.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No visits logged yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {checkIns.map((visit) => (
                  <li
                    key={visit._id}
                    className="flex items-center justify-between px-5 py-2.5"
                  >
                    <span className="figure text-sm">
                      {formatDateTime(visit.at)}
                    </span>
                    <span className="eyebrow">{formatRecency(visit.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <MemberFormDialog
        open={editing}
        onOpenChange={setEditing}
        member={{ ...member, status: dialogStatus(member.status) }}
      />

      <AddFeeDialog
        open={addingPayment}
        onOpenChange={setAddingPayment}
        presetMemberId={member._id}
      />

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their plan, dues and {stats.totalVisits} logged visits are deleted
              with them. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep member</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
