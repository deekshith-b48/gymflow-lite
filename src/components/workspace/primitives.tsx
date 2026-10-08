import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel, statusTone } from "@/lib/gym";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Search } from "lucide-react";

/** The eyebrow + title + lede header every module page opens with. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight">{title}</h1>
        {lede && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{lede}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function StatGrid({
  children,
  cols = 4,
  className,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const columns = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  } as const;
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border",
        columns[cols],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One KPI tile: small caps label, big figure, optional hint below. */
export function Stat({
  label,
  value,
  hint,
  tone,
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "alert" | "good";
  loading?: boolean;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="eyebrow">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p
          className={cn(
            "figure mt-2 text-2xl font-medium",
            tone === "alert" && "text-rose-300",
            tone === "good" && "text-primary",
          )}
        >
          {value}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Colour-coded status pill — Active green, Partial amber, Expired red… */
export function StatusChip({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border font-mono uppercase tracking-wide", statusTone(status))}
    >
      {statusLabel(status)}
    </Badge>
  );
}

/** Search box used by every module's filter bar. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative flex-1", className)}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9 shadow-none"
        autoComplete="off"
      />
    </div>
  );
}

/** The shared empty state: says what is missing and offers the next move. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Loading placeholders in table shape, used while a query hydrates. */
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}
