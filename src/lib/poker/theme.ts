/** Paños disponibles: cada uno redefine las variables CSS del fieltro. */
export type FeltTheme = {
  id: string;
  label: string;
  vars: { felt: string; deep: string; line: string };
};

export const FELT_THEMES: FeltTheme[] = [
  {
    id: "esmeralda",
    label: "Esmeralda",
    vars: {
      felt: "oklch(0.36 0.08 158)",
      deep: "oklch(0.24 0.06 160)",
      line: "oklch(0.5 0.08 155)",
    },
  },
  {
    id: "zafiro",
    label: "Zafiro",
    vars: {
      felt: "oklch(0.38 0.09 245)",
      deep: "oklch(0.24 0.07 250)",
      line: "oklch(0.52 0.1 245)",
    },
  },
  {
    id: "borgona",
    label: "Borgoña",
    vars: {
      felt: "oklch(0.36 0.11 20)",
      deep: "oklch(0.22 0.08 20)",
      line: "oklch(0.5 0.12 22)",
    },
  },
  {
    id: "medianoche",
    label: "Medianoche",
    vars: {
      felt: "oklch(0.3 0.05 285)",
      deep: "oklch(0.18 0.04 285)",
      line: "oklch(0.44 0.07 288)",
    },
  },
  {
    id: "grafito",
    label: "Grafito",
    vars: {
      felt: "oklch(0.32 0.01 250)",
      deep: "oklch(0.19 0.01 250)",
      line: "oklch(0.46 0.01 250)",
    },
  },
];

export const DEFAULT_FELT_THEME = "esmeralda";

export function applyFeltTheme(id: string | null | undefined) {
  if (typeof document === "undefined") return;
  const theme = FELT_THEMES.find((t) => t.id === id) ?? FELT_THEMES[0]!;
  const root = document.documentElement;
  root.style.setProperty("--felt", theme.vars.felt);
  root.style.setProperty("--felt-deep", theme.vars.deep);
  root.style.setProperty("--felt-line", theme.vars.line);
}
