import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DATE_RANGE_PRESETS,
  formatDate,
  resolveDateRange,
  type DateRange,
  type DateRangePreset,
} from "@/lib/gym";
import { cn } from "@/lib/utils";
import { CalendarRange } from "lucide-react";
import { useState } from "react";

/** `<input type="date">` wants YYYY-MM-DD; the app displays DD/MM/YYYY. */
function toDateInput(ms: number) {
  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day).getTime();
}

/**
 * The date-range control shared by the dashboard and activity log: a row of
 * presets, plus a Custom mode with two date fields and an explicit apply.
 */
export function DateRangeFilter({
  preset,
  onPresetChange,
  range,
  onRangeChange,
  className,
}: {
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  className?: string;
}) {
  const [customFrom, setCustomFrom] = useState(() => toDateInput(range.from));
  const [customTo, setCustomTo] = useState(() => toDateInput(range.to));

  function choosePreset(value: DateRangePreset) {
    onPresetChange(value);
    if (value !== "custom") {
      onRangeChange(resolveDateRange(value));
    }
  }

  function applyCustom() {
    const from = fromDateInput(customFrom);
    const to = fromDateInput(customTo);
    if (from === undefined || to === undefined) return;
    onRangeChange(resolveDateRange("custom", Date.now(), { from, to: to + 86_400_000 - 1 }));
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <CalendarRange className="mr-1 size-4 text-muted-foreground" />
        {DATE_RANGE_PRESETS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={preset === option.value ? "default" : "outline"}
            className="h-7 shadow-none"
            onClick={() => choosePreset(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(event) => setCustomFrom(event.target.value)}
            className="h-8 w-40 shadow-none"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={(event) => setCustomTo(event.target.value)}
            className="h-8 w-40 shadow-none"
          />
          <Button size="sm" variant="outline" className="h-8 shadow-none" onClick={applyCustom}>
            Apply
          </Button>
          <span className="figure text-xs text-muted-foreground">
            {formatDate(range.from)} → {formatDate(range.to)}
          </span>
        </div>
      )}
    </div>
  );
}
