import { DataTable, type Column } from "@/components/workspace/DataTable";
import {
  SkeletonRows,
  Stat,
  StatGrid,
  StatusChip,
} from "@/components/workspace/primitives";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatMoney, initials } from "@/lib/gym";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Loader2, Mail, Phone, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

type PaymentRow = {
  _id: string;
  memberName: string;
  periodStart: number;
  periodEnd: number;
  ptFeeCents: number;
  commissionBps: number;
  trainerShareCents: number;
  gymShareCents: number;
  status: string;
};

/**
 * A trainer's profile: assigned members, what they earn this month, and the
 * PT payment history split between their share and the gym's.
 */
export default function TrainerDetail() {
  const { trainerId } = useParams<{ trainerId: string }>();
  const navigate = useNavigate();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = useQuery(
    api.catalogAdmin.getTrainer,
    trainerId ? { trainerId: trainerId as Id<"trainers"> } : "skip",
  );
  const removeTrainer = useMutation(api.catalogAdmin.removeTrainer);

  if (data === undefined) {
    return <SkeletonRows rows={5} />;
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-sm font-medium">That trainer is gone</p>
        <Button asChild variant="outline" className="mt-5 shadow-none">
          <Link to="/dashboard/trainers">Back to trainers</Link>
        </Button>
      </div>
    );
  }

  const { trainer, assigned, payments, financial } = data;

  async function handleDelete() {
    setBusy(true);
    try {
      await removeTrainer({ trainerId: trainer._id });
      toast(`${trainer.name} removed`);
      navigate("/dashboard/trainers");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not remove trainer.",
      );
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<PaymentRow>[] = [
    {
      key: "member",
      header: "Member",
      sortValue: (row) => row.memberName,
      render: (row) => <span className="text-sm font-medium">{row.memberName}</span>,
    },
    {
      key: "period",
      header: "Period",
      sortValue: (row) => row.periodStart,
      render: (row) => (
        <span className="figure whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(row.periodStart)} – {formatDate(row.periodEnd)}
        </span>
      ),
    },
    {
      key: "fee",
      header: "PT Fee",
      align: "right",
      sortValue: (row) => row.ptFeeCents,
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.ptFeeCents)}</span>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      sortValue: (row) => row.commissionBps,
      render: (row) => (
        <span className="figure text-sm">{row.commissionBps / 100}%</span>
      ),
    },
    {
      key: "share",
      header: "Trainer Share",
      align: "right",
      sortValue: (row) => row.trainerShareCents,
      render: (row) => (
        <span className="figure text-sm text-primary">
          {formatMoney(row.trainerShareCents)}
        </span>
      ),
    },
    {
      key: "gym",
      header: "Gym Share",
      align: "right",
      sortValue: (row) => row.gymShareCents,
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.gymShareCents)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      render: (row) => <StatusChip status={row.status} />,
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <Link
        to="/dashboard/trainers"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Trainers
      </Link>

      {/* Profile header */}
      <header className="flex items-start gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-base">
          {initials(trainer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">{trainer.name}</h1>
            <StatusChip status={trainer.status} />
            {trainer.specialty && (
              <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {trainer.specialty}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {trainer.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" />
                {trainer.email}
              </span>
            )}
            {trainer.phone && (
              <span className="figure inline-flex items-center gap-1.5">
                <Phone className="size-3.5" />
                +92 {trainer.phone}
              </span>
            )}
            <span>Joined {formatDate(trainer.joinedAt)}</span>
          </div>
        </div>
        <Button
          variant="outline"
          className="border-rose-500/40 text-rose-300 shadow-none hover:bg-rose-500/10 hover:text-rose-200"
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="size-4" />
          Delete trainer
        </Button>
      </header>

      {/* Financial cards */}
      <StatGrid>
        <Stat
          label="Assigned Members"
          value={String(financial.assignedCount)}
          hint={`${trainer.name.split(" ")[0]}'s roster`}
        />
        <Stat
          label="Monthly Salary"
          value={formatMoney(financial.salaryCents)}
          hint="Fixed"
        />
        <Stat
          label="Commission Earned"
          value={formatMoney(financial.commissionCents)}
          hint={`${trainer.commissionBps / 100}% of fees collected this month`}
          tone="good"
        />
        <Stat
          label="Gym PT Revenue"
          value={formatMoney(financial.gymRevenueCents)}
          hint="Gym's share after commission"
        />
      </StatGrid>

      {/* Payment breakdown */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="eyebrow">Payment breakdown · this month</p>
        </div>
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-muted-foreground">Fixed salary</span>
            <span className="figure">{formatMoney(financial.salaryCents)}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              {trainer.commissionBps / 100}% commission
            </span>
            <span className="figure text-primary">
              {formatMoney(financial.commissionCents)}
            </span>
          </div>
          <div className="flex items-center justify-between bg-muted/40 px-5 py-3.5 text-sm font-semibold">
            <span>Total this month</span>
            <span className="figure">
              {formatMoney(financial.totalThisMonthCents)}
            </span>
          </div>
        </div>
      </section>

      {/* Assigned members */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="eyebrow">Assigned members</p>
          <p className="eyebrow">{assigned.length} total</p>
        </div>
        {assigned.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No members assigned yet — pick a trainer when adding a member or
            recording a PT fee.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {assigned.map((member) => (
              <li
                key={member._id}
                className="flex items-center justify-between px-5 py-2.5"
              >
                <Link
                  to={`/dashboard/members/${member._id}`}
                  className="flex items-center gap-2.5 text-sm hover:text-foreground"
                >
                  <span className="flex size-7 items-center justify-center rounded-full border border-border bg-muted font-mono text-[10px]">
                    {initials(member.name)}
                  </span>
                  <span className="font-medium">{member.name}</span>
                  {member.memberCode && (
                    <span className="figure text-xs text-muted-foreground">
                      {member.memberCode}
                    </span>
                  )}
                </Link>
                <StatusChip status={member.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PT payment history */}
      <section className="flex flex-col gap-4">
        <p className="eyebrow">PT payment history</p>
        {payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No PT fees recorded yet. Record one from the Fees module with this
              trainer attached.
            </p>
            <Button asChild variant="outline" className="mt-4 shadow-none">
              <Link to="/dashboard/fees">Open fees</Link>
            </Button>
          </div>
        ) : (
          <DataTable<PaymentRow>
            columns={columns}
            rows={payments as unknown as PaymentRow[]}
            rowKey={(row) => row._id}
            initialSort={{ key: "period", direction: "desc" }}
          />
        )}
      </section>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {trainer.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their trainer record is removed. Recorded PT fee history stays in
              the ledger for the books.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep trainer</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Delete trainer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
