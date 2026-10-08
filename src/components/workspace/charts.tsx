import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatMoney } from "@/lib/gym";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export type Slice = { label: string; value: number; tone?: string };

/** Donut chart used by every breakdown panel: slices + centre total. */
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  format = "money",
  className,
}: {
  data: Slice[];
  centerLabel?: string;
  centerValue?: string;
  format?: "money" | "count";
  className?: string;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className={cn("relative w-full", className)}>
      <ChartContainer config={{}} className="mx-auto h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((slice, index) => (
                <Cell
                  key={slice.label}
                  fill={slice.tone ?? SERIES[index % SERIES.length]}
                />
              ))}
            </Pie>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    format === "money"
                      ? formatMoney(Number(value))
                      : String(value)
                  }
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>

      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="figure text-lg font-medium">
            {centerValue ??
              (format === "money" ? formatMoney(total) : String(total))}
          </p>
          <p className="eyebrow mt-0.5">{centerLabel}</p>
        </div>
      )}

      <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{
                background: slice.tone ?? SERIES[index % SERIES.length],
              }}
            />
            <span className="text-xs text-muted-foreground">{slice.label}</span>
            <span className="figure text-xs text-foreground">
              {format === "money" ? formatMoney(slice.value) : slice.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars: expense breakdown, package popularity. */
export function HorizontalBars({
  data,
  format = "money",
  className,
}: {
  data: { label: string; value: number }[];
  format?: "money" | "count";
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <ChartContainer config={{}} className="h-auto w-full" style={{ height: Math.max(160, data.length * 36) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    format === "money" ? formatMoney(Number(value)) : String(value)
                  }
                />
              }
            />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

/** Vertical bars: rush-hour attendance, package popularity by count. */
export function VerticalBars({
  data,
  className,
  highlightPeak = false,
}: {
  data: { label: string; value: number }[];
  className?: string;
  highlightPeak?: boolean;
}) {
  const peak = Math.max(...data.map((entry) => entry.value), 0);
  return (
    <ChartContainer
      config={{}}
      className={cn("h-48 w-full", className)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.label}
                fill={
                  highlightPeak && entry.value === peak
                    ? "var(--chart-2)"
                    : "var(--chart-1)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

/** Multi-series line chart: revenue vs expenses over six months. */
export function MultiLineChart({
  data,
  series,
  className,
}: {
  data: { label: string; [key: string]: string | number }[];
  series: { key: string; name: string; color: string }[];
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <ChartContainer config={{}} className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -10, right: 12, top: 8, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) =>
                value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
              }
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
            />
            {series.map((entry) => (
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.name}
                stroke={entry.color}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

/** Single-series line with area feel: last 30 days of check-ins. */
export function TrendLine({
  data,
  className,
  format = "count",
}: {
  data: { label: string; value: number }[];
  className?: string;
  format?: "count" | "money";
}) {
  return (
    <ChartContainer config={{}} className={cn("h-48 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -18, right: 12, top: 8, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval={4}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) =>
                  format === "money" ? formatMoney(Number(value)) : String(value)
                }
              />
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
