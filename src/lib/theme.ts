/**
 * Accent theming: seven presets plus any custom colour, applied by writing the
 * theme's `--primary`, `--ring` and chart variables straight onto the root.
 * The whole UI recolours instantly because every surface reads those tokens.
 */

export type Accent = {
  key: string;
  label: string;
  /** oklch triplet used for the primary button/badge background. */
  primary: string;
  primaryForeground: string;
  chart: string;
};

export const ACCENT_PRESETS: Accent[] = [
  {
    key: "lime",
    label: "Lime",
    primary: "oklch(0.87 0.196 129)",
    primaryForeground: "oklch(0.16 0.03 130)",
    chart: "oklch(0.87 0.196 129)",
  },
  {
    key: "blue",
    label: "Blue",
    primary: "oklch(0.72 0.14 250)",
    primaryForeground: "oklch(0.16 0.04 250)",
    chart: "oklch(0.72 0.14 250)",
  },
  {
    key: "purple",
    label: "Purple",
    primary: "oklch(0.68 0.19 300)",
    primaryForeground: "oklch(0.98 0.01 300)",
    chart: "oklch(0.68 0.19 300)",
  },
  {
    key: "green",
    label: "Green",
    primary: "oklch(0.75 0.17 160)",
    primaryForeground: "oklch(0.16 0.03 160)",
    chart: "oklch(0.75 0.17 160)",
  },
  {
    key: "pink",
    label: "Pink",
    primary: "oklch(0.72 0.18 350)",
    primaryForeground: "oklch(0.16 0.03 350)",
    chart: "oklch(0.72 0.18 350)",
  },
  {
    key: "orange",
    label: "Orange",
    primary: "oklch(0.78 0.17 60)",
    primaryForeground: "oklch(0.18 0.04 60)",
    chart: "oklch(0.78 0.17 60)",
  },
  {
    key: "red",
    label: "Red",
    primary: "oklch(0.68 0.19 25)",
    primaryForeground: "oklch(0.98 0.01 25)",
    chart: "oklch(0.68 0.19 25)",
  },
];

function hexToOklch(hex: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const toLinear = (channel: number) =>
    channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  const [rl, gl, bl] = [toLinear(r), toLinear(g), toLinear(b)];

  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  const L = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const bb = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;

  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return `oklch(${(L * 100).toFixed(1)} ${C.toFixed(3)} ${H.toFixed(0)})`;
}

/** Apply an accent (preset key or #hex) across the whole app, live. */
export function applyAccent(accent: string) {
  const preset = ACCENT_PRESETS.find((entry) => entry.key === accent);
  const primary = preset
    ? preset.primary
    : accent.startsWith("#")
      ? (hexToOklch(accent) ?? ACCENT_PRESETS[0].primary)
      : ACCENT_PRESETS[0].primary;
  const foreground = preset
    ? preset.primaryForeground
    : "oklch(0.16 0.03 130)";
  const chart = preset ? preset.chart : primary;

  const root = document.documentElement;
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-foreground", foreground);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--chart-1", chart);
  root.style.setProperty("--sidebar-primary", primary);
}

/** Apply the default mode: system follows the OS, others force the class. */
export function applyMode(mode: "system" | "light" | "dark") {
  const root = document.documentElement;
  if (mode === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
    return;
  }
  root.classList.toggle("dark", mode === "dark");
}
