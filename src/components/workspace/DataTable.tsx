import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
};

const PAGE_SIZES = [20, 50, 100] as const;

/**
 * The table every module shares: clickable column headers toggle sort, the
 * footer paginates 20/50/100 per page with Previous/Next plus page numbers,
 * and an optional row action slot keeps the three-dot menus consistent.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  initialSort,
  pageSize: initialPageSize = 20,
  actions,
  toolbar,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  initialSort?: { key: string; direction: "asc" | "desc" };
  pageSize?: number;
  /** Rendered at the end of each row (three-dot menu etc.). */
  actions?: (row: T) => ReactNode;
  toolbar?: ReactNode;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((entry) => entry.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor;
      }
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  function toggleSort(key: string) {
    setPage(0);
    setSort((current) => {
      if (current?.key !== key) return { key, direction: "asc" };
      return current.direction === "asc"
        ? { key, direction: "desc" }
        : null;
    });
  }

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="flex flex-col gap-3">
      {toolbar}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "eyebrow select-none",
                    column.align === "right" && "text-right",
                    column.className,
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.header}
                      {sort?.key === column.key ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-50" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
              {actions && (
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      "align-middle",
                      column.align === "right" && "text-right",
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className="text-right">{actions(row)}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="figure">
            {sorted.length} row{sorted.length === 1 ? "" : "s"}
          </span>
          <span className="text-border">·</span>
          <label className="flex items-center gap-1.5">
            Per page
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
              className="h-7 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 shadow-none"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          {Array.from({ length: pageCount })
            .slice(0, 7)
            .map((_, index) => (
              <Button
                key={index}
                size="sm"
                variant={index === currentPage ? "default" : "outline"}
                className="h-8 w-8 shadow-none"
                onClick={() => setPage(index)}
              >
                {index + 1}
              </Button>
            ))}
          {pageCount > 7 && (
            <span className="px-1 text-xs text-muted-foreground">…</span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 shadow-none"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
