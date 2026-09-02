"use client";

import { useMemo, useState } from "react";
import type { PnlMatrix, CatNode, SubNode, Scen, ByMarket } from "@/lib/bigquery";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type Country = "all" | "es" | "us";
const FIRST_MIN = 200; // ancho mínimo de la columna "Concept" (rellena el resto en desktop)
const COL_W = 82; // ancho de columna de datos
const FY_W = 108; // "Full Year" un poco más ancha
const colW = (c: Col) => (c.kind === "fy" ? FY_W : COL_W);

function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + "M";
  if (a >= 10_000) return Math.round(n / 1000).toLocaleString("en-US") + "k";
  if (a >= 1000) return (n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "k";
  return Math.round(n).toLocaleString("en-US");
}
const eur0 = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pct = (n: number | null) => (n == null || !isFinite(n) ? "–" : `${(n * 100).toFixed(1)}%`);
const growthStr = (n: number | null) => (n == null || !isFinite(n) ? "–" : `${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}%`);

type Growth = number | "ns" | null;

type Col =
  | { kind: "m"; idx: number; label: string }
  | { kind: "q"; idx: number; label: string }
  | { kind: "h"; idx: number; label: string }
  | { kind: "fy"; label: string };

const bgFor = (kind: Col["kind"]) =>
  kind === "q" ? "bg-[#f0f1f1]" : kind === "h" ? "bg-[#e6e8e8]" : kind === "fy" ? "bg-[#dee1e1]" : "";
const firstIdxOf = (c: Col) => (c.kind === "m" ? c.idx : c.kind === "q" ? c.idx * 3 : c.kind === "h" ? (c.idx === 0 ? 0 : 6) : 0);
const lastIdxOf = (c: Col) => (c.kind === "m" ? c.idx : c.kind === "q" ? c.idx * 3 + 2 : c.kind === "h" ? (c.idx === 0 ? 5 : 11) : 11);

const INDICATOR_NAMES: Record<string, string> = {
  rev: "Revenues",
  services: "Services",
  licensing: "Licensing",
  cogsNL: "COGS",
  labor: "Labor Cost",
  mgmt: "Management",
  bdev: "Business Development",
  ops: "Operations",
  opex: "OPEX",
  marginSvc: "Services Margin",
  ebitda: "EBITDA",
};

const pickCountry = (bm: ByMarket, country: Country) =>
  country === "es" ? bm.es : country === "us" ? bm.us : bm.es.map((v, i) => v + bm.us[i]);
function series(node: Scen, country: Country, lastActual: number, forecastOn: boolean): number[] {
  const a = pickCountry(node.act, country);
  const f = pickCountry(node.fc, country);
  return a.map((v, i) => (i <= lastActual - 1 ? v : forecastOn ? f[i] : 0));
}
const valueFor = (months: number[], col: Col): number => {
  const s = (a: number, b: number) => {
    let t = 0;
    for (let i = a; i <= b; i++) t += months[i];
    return t;
  };
  if (col.kind === "m") return months[col.idx];
  if (col.kind === "q") return s(col.idx * 3, col.idx * 3 + 2);
  if (col.kind === "h") return col.idx === 0 ? s(0, 5) : s(6, 11);
  return s(0, 11);
};
const addArr = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
const subArr = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
const z12 = () => new Array(12).fill(0);

// Métricas del Excel (sobre taxonomía BQ), dada una función de serie mensual por nodo.
function buildMetrics(m: PnlMatrix, seriesFn: (n: Scen) => number[]): Record<string, number[]> {
  const catSer = (key: string) => { const c = m.cats.find((x) => x.key === key); return c ? seriesFn(c) : z12(); };
  const subSer = (l1: string, l2: string) => { const c = m.cats.find((x) => x.key === l1); const s = c?.subs.find((x) => x.label === l2); return s ? seriesFn(s) : z12(); };
  const rev = catSer("Revenues");
  const services = subSer("Revenues", "Consulting");
  const licensing = subSer("Revenues", "Sofware SaaS");
  const ops = subSer("COGS", "Ops. Payroll");
  const bdev = subSer("COGS", "Bus.Dev. Payroll");
  const mgmt = subSer("SG&A", "Management Payroll");
  const labor = addArr(addArr(ops, bdev), mgmt);
  const cogsCat = catSer("COGS");
  const cogsNL = subArr(subArr(cogsCat, ops), bdev);
  const sgaCat = catSer("SG&A");
  const opex = subArr(sgaCat, mgmt);
  const ebitda = addArr(addArr(rev, cogsCat), sgaCat);
  return { rev, services, licensing, ops, bdev, mgmt, labor, cogsNL, opex, ebitda, marginSvc: addArr(services, ops) };
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span aria-hidden className="inline-block w-3 text-propel-ink transition-transform duration-150" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
      ▸
    </span>
  );
}
function ColGroup({ cols }: { cols: Col[] }) {
  return (
    <colgroup>
      <col />
      {cols.map((c, i) => (
        <col key={i} style={{ width: colW(c) }} />
      ))}
    </colgroup>
  );
}

export default function PnlWorkspace({ matrices }: { matrices: PnlMatrix[] }) {
  const years = matrices.map((m) => m.year);
  const [year, setYear] = useState<number>(years[0]);
  const [country, setCountry] = useState<Country>("all");
  const [forecastOn, setForecastOn] = useState(false);
  // Nivel de detalle de filas: L1 = solo categorías, L2 = + subcategorías, detail = hasta cuenta.
  const [level, setLevel] = useState<"L1" | "L2" | "detail">("L2");
  // Base del bloque "GR% vs ..." : año anterior (py) o forecast (fc).
  const [pyBase, setPyBase] = useState<"py" | "fc">("py");
  const [rows, setRows] = useState<Set<string>>(() => new Set(matrices[0].cats.map((c) => c.key)));
  const [quarters, setQuarters] = useState<Set<number>>(new Set());
  const [openedRatio, setOpenedRatio] = useState<{ label: string; col: Col; details: RatioDetails } | null>(null);
  const [openedChart, setOpenedChart] = useState<{ label: string; data: number[] } | null>(null);

  const matrix = matrices.find((m) => m.year === year) ?? matrices[0];
  const { cats, lastActualMonth } = matrix;

  const hasForecast = (c: Col) => lastIdxOf(c) >= lastActualMonth;
  const fullyOpen = (c: Col) => firstIdxOf(c) >= lastActualMonth;
  const colColor = (c: Col) =>
    forecastOn && hasForecast(c) ? "text-propel-ink" : !forecastOn && fullyOpen(c) ? "text-muted/40" : "";

  const allRowKeys = useMemo(() => {
    const s = new Set<string>();
    for (const c of cats) {
      s.add(c.key);
      for (const sub of c.subs) s.add(sub.key);
    }
    return s;
  }, [cats]);

  const cols = useMemo<Col[]>(() => {
    const out: Col[] = [];
    for (let q = 0; q < 4; q++) {
      if (quarters.has(q)) for (let m = q * 3; m <= q * 3 + 2; m++) out.push({ kind: "m", idx: m, label: MONTHS[m] });
      out.push({ kind: "q", idx: q, label: `Q${q + 1}` });
      if (q === 1) out.push({ kind: "h", idx: 0, label: "H1" });
      if (q === 3) out.push({ kind: "h", idx: 1, label: "H2" });
    }
    out.push({ kind: "fy", label: "Full Year" });
    return out;
  }, [quarters]);

  const toggleRow = (k: string) =>
    setRows((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const toggleQ = (q: number) =>
    setQuarters((p) => { const n = new Set(p); if (n.has(q)) n.delete(q); else n.add(q); return n; });
  const applyLevel = (lvl: "L1" | "L2" | "detail") => {
    setLevel(lvl);
    if (lvl === "L1") setRows(new Set());
    else if (lvl === "L2") setRows(new Set(cats.map((c) => c.key)));
    else setRows(new Set(allRowKeys));
  };

  // ===== métricas por año =====
  // Vista actual (blend según toggle global) — para eficiencia y "vs Q-1".
  const metricsByYear = useMemo(
    () => Object.fromEntries(matrices.map((m) => [m.year, buildMetrics(m, (n) => series(n, country, m.lastActualMonth, forecastOn))])),
    [matrices, country, forecastOn],
  );
  // Real puro (cerrado real, abiertos a 0) y Forecast puro — para el bloque "vs PY / vs Forecast".
  const actMetrics = useMemo(
    () => Object.fromEntries(matrices.map((m) => [m.year, buildMetrics(m, (n) => series(n, country, m.lastActualMonth, false))])),
    [matrices, country],
  );
  const fcMetrics = useMemo(
    () => Object.fromEntries(matrices.map((m) => [m.year, buildMetrics(m, (n) => pickCountry(n.fc, country))])),
    [matrices, country],
  );

  const grand = useMemo(() => {
    const t = z12();
    for (const c of cats) {
      const s = series(c, country, lastActualMonth, forecastOn);
      for (let i = 0; i < 12; i++) t[i] += s[i];
    }
    return t;
  }, [cats, country, lastActualMonth, forecastOn]);

  const mv = (yr: number, key: string, col: Col) => valueFor(metricsByYear[yr]?.[key] ?? z12(), col);
  const mvA = (yr: number, key: string, col: Col) => valueFor(actMetrics[yr]?.[key] ?? z12(), col);
  const mvF = (yr: number, key: string, col: Col) => valueFor(fcMetrics[yr]?.[key] ?? z12(), col);

  const revenueFY = valueFor(metricsByYear[year]?.rev ?? z12(), { kind: "fy", label: "" });
  const result = valueFor(grand, { kind: "fy", label: "" });
  const margin = revenueFY ? result / revenueFY : 0;
  const kpiSuffix = forecastOn ? "FY (actual+fcst)" : `YTD actual · Jan–${MONTHS[lastActualMonth - 1]}`;

  const blend = (node: Scen) => series(node, country, lastActualMonth, forecastOn);
  const cellClass = (c: Col, extra = "") => `px-3 py-2 text-right tabular-nums whitespace-nowrap ${bgFor(c.kind)} ${colColor(c)} ${extra}`;
  const onChart = (label: string, data: number[]) => setOpenedChart({ label, data });
  const rp: RowProps = { cols, rows, toggleRow, blend, cellClass, onChart };
  const tableMinWidth = FIRST_MIN + cols.reduce((s, c) => s + colW(c), 0);
  const tableStyle = { tableLayout: "auto" as const, width: "100%" };

  const priorYear = years.includes(year - 1) ? year - 1 : null;
  const prevCol = (c: Col): { yr: number; col: Col } => {
    if (c.kind === "m") return c.idx > 0 ? { yr: year, col: { kind: "m", idx: c.idx - 1, label: "" } } : { yr: year - 1, col: { kind: "m", idx: 11, label: "" } };
    if (c.kind === "q") return c.idx > 0 ? { yr: year, col: { kind: "q", idx: c.idx - 1, label: "" } } : { yr: year - 1, col: { kind: "q", idx: 3, label: "" } };
    if (c.kind === "h") return c.idx === 1 ? { yr: year, col: { kind: "h", idx: 0, label: "" } } : { yr: year - 1, col: { kind: "h", idx: 1, label: "" } };
    return { yr: year - 1, col: { kind: "fy", label: "" } };
  };
  // sin valor real en la P&L (cur 0) o sin base (prev 0) => no se calcula (queda en blanco, no -100%)
  // Growth con cap: sin valor => null ("–"); cambio de signo o >±1000% => "ns" (no significativo).
  const growthCalc = (cur: number, prev: number): Growth => {
    if (prev === 0 || cur === 0) return null;
    if (cur > 0 !== prev > 0) return "ns"; // cambio de signo → % sin sentido
    const r = cur / prev - 1;
    if (!isFinite(r)) return null;
    if (Math.abs(r) > 10) return "ns"; // >±1000% → no significativo
    return r;
  };
  const gPrev = (key: string) => (c: Col): Growth => {
    if (c.kind === "h") return null; // vs periodo anterior no aplica a semestres
    const p = prevCol(c);
    if (!years.includes(p.yr)) return null;
    return growthCalc(mv(year, key, c), mv(p.yr, key, p.col));
  };
  const gPY = (key: string) => (c: Col): Growth => {
    if (pyBase === "fc") return growthCalc(mvA(year, key, c), mvF(year, key, c)); // Real vs Forecast
    return priorYear == null ? null : growthCalc(mvA(year, key, c), mvA(priorYear, key, c)); // Real vs año anterior
  };

  // Helper functions for ratio details
  const getIndicatorName = (key: string): string => INDICATOR_NAMES[key] || key;

  const detailsPrev = (key: string, label?: string) => (c: Col): RatioDetails => {
    const current = mv(year, key, c);
    const p = prevCol(c);
    const previous = years.includes(p.yr) ? mv(p.yr, key, p.col) : 0;
    const growth = growthCalc(current, previous);
    const growthStr_ = typeof growth === "number" ? growthStr(growth) : growth === "ns" ? "n/s" : "–";
    const displayLabel = label || getIndicatorName(key);
    return {
      numeratorLabel: `${displayLabel} (current)`,
      numeratorValue: current,
      denominatorLabel: `${displayLabel} (previous)`,
      denominatorValue: previous,
      result: growthStr_,
      formula: `${displayLabel} (current) / ${displayLabel} (previous)`,
    };
  };

  const detailsPY = (key: string, label?: string) => (c: Col): RatioDetails => {
    let current: number, previous: number;
    if (pyBase === "fc") {
      current = mvA(year, key, c);
      previous = mvF(year, key, c);
    } else {
      current = mvA(year, key, c);
      previous = priorYear == null ? 0 : mvA(priorYear, key, c);
    }
    const growth = growthCalc(current, previous);
    const growthStr_ = typeof growth === "number" ? growthStr(growth) : growth === "ns" ? "n/s" : "–";
    const prevLabel = pyBase === "fc" ? "Forecast" : priorYear == null ? "PY (no data)" : `PY (${priorYear})`;
    const displayLabel = label || getIndicatorName(key);
    return {
      numeratorLabel: `${displayLabel} (current)`,
      numeratorValue: current,
      denominatorLabel: `${displayLabel} - ${prevLabel}`,
      denominatorValue: previous,
      result: growthStr_,
      formula: `${displayLabel} (current) / ${displayLabel} (${prevLabel})`,
    };
  };

  const detailsRatio = (numeratorLabel: string, denominatorLabel: string, numeratorKey?: string, denominatorKey?: string, absolute = false) => (c: Col): RatioDetails => {
    const num = mv(year, numeratorKey || numeratorLabel, c);
    const denom = mv(year, denominatorKey || denominatorLabel, c);
    const ratio = denom ? num / denom : null;
    const ratioStr = pct(ratio == null ? null : absolute ? Math.abs(ratio) : ratio);
    return {
      numeratorLabel,
      numeratorValue: num,
      denominatorLabel,
      denominatorValue: denom,
      result: ratioStr,
      formula: `${numeratorLabel} / ${denominatorLabel}`,
    };
  };

  const Header = ({ label }: { label: string }) => (
    <tr className="border-b border-line bg-pacer text-[11px] uppercase tracking-wider text-muted">
      <th className="sticky left-0 z-10 bg-pacer px-4 py-2.5 text-left font-medium">{label}</th>
      {cols.map((c, i) => (
        <th key={i} onClick={() => c.kind === "q" && toggleQ(c.idx)}
          className={`px-3 py-2.5 text-right font-medium whitespace-nowrap ${bgFor(c.kind)} ${colColor(c) || (c.kind === "q" || c.kind === "fy" ? "text-ink" : "")} ${c.kind === "q" ? "cursor-pointer" : ""}`}>
          {c.kind === "q" && <Chevron open={quarters.has(c.idx)} />} {c.label}
        </th>
      ))}
    </tr>
  );

  type Mode = "pct" | "growth" | "eur";
  type RatioDetails = { numeratorLabel?: string; numeratorValue: number | null; denominatorLabel?: string; denominatorValue?: number | null; result: string; formula: string };
  // good=true → subir es bueno (ingresos); good=false → subir es malo (costes)
  // absolute=true → se muestra la magnitud (p.ej. COGS vs Revenues = 15%, no -15%).
  // Color: negro normal; azul (text-propel-ink) cuando la columna es forecast; n/s en gris.
  const RatioRow = ({ label, get, mode = "pct", strong = false, absolute = false, signColor = false, getDetails }: { label: string; get: (c: Col) => Growth; mode?: Mode; strong?: boolean; absolute?: boolean; signColor?: boolean; getDetails?: (c: Col) => RatioDetails }) => {
    const ratioData = cols.map(c => {
      const v = get(c);
      return typeof v === "number" ? v : 0;
    });
    return (
      <tr className={`border-b border-line/60 ${strong ? "font-semibold text-ink" : "text-ink/90"}`}>
        <th className={`sticky left-0 z-10 bg-surface px-4 py-1.5 pl-6 text-left ${strong ? "font-semibold" : "font-normal"}`}>{label}</th>
        {cols.map((c, i) => {
          const v = get(c);
          const num = typeof v === "number" ? v : null;
          let txt: string;
          let color = colColor(c);
          if (mode === "growth") {
            if (v === "ns") { txt = "n/s"; color = "text-muted/50"; }
            else if (num == null) txt = "–";
            else txt = growthStr(num);
          } else if (mode === "eur") txt = num == null ? "–" : fmt(num);
          else txt = pct(num == null ? null : absolute ? Math.abs(num) : num);
          // color por signo (verde/rojo) solo si se pide y la columna no es forecast/vacía
          if (signColor && num != null && color === "") color = num >= 0 ? "text-nebula" : "text-hotlava";
          return (
            <td
              key={i}
              onClick={() => {
                const details = getDetails ? getDetails(c) : { numeratorValue: num, result: txt, formula: label };
                setOpenedRatio({ label, col: c, details });
              }}
              className={`cursor-pointer px-3 py-1.5 text-right tabular-nums whitespace-nowrap transition-colors hover:bg-pacer/20 ${bgFor(c.kind)} ${color}`}
            >
              {txt}
            </td>
          );
        })}
        <td className="px-0 py-1 text-center w-4">
          <button onClick={(e) => { e.stopPropagation(); onChart(label, ratioData); }} className="text-xs text-muted/50 hover:text-propel-ink transition-colors" title="View evolution">
            📈
          </button>
        </td>
      </tr>
    );
  };
  const Section = ({ title }: { title: string }) => (
    <tr>
      <th colSpan={cols.length + 1} className="sticky left-0 bg-surface px-4 pb-1 pt-4 text-left text-[11px] font-semibold uppercase tracking-wider text-propel-ink">{title}</th>
    </tr>
  );

  return (
    <div>
      {/* KPIs */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label={`Revenue · ${kpiSuffix}`} value={eur0(revenueFY)} accent />
        <Kpi label={`Net result · ${kpiSuffix}`} value={eur0(result)} tone={result >= 0 ? "pos" : "neg"} />
        <Kpi label={`Net margin · ${kpiSuffix}`} value={`${(margin * 100).toFixed(1)}%`} tone={result >= 0 ? "pos" : "neg"} />
      </div>

      {/* Ratio Details Bottom Sheet */}
      <BottomSheet
        isOpen={openedRatio !== null}
        onClose={() => setOpenedRatio(null)}
        title={openedRatio ? `${openedRatio.label} · ${openedRatio.col.label}` : "Ratio Details"}
      >
        {openedRatio && (
          <div className="space-y-2 flex flex-col items-center">
            <div className="rounded-lg border border-line p-3 w-full max-w-xs">
              {openedRatio.details.numeratorValue !== null && openedRatio.details.numeratorValue !== undefined && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted">{openedRatio.details.numeratorLabel || "Numerator"}</span>
                  <span className="font-mono text-sm font-semibold text-ink ml-2">{fmt(openedRatio.details.numeratorValue)}</span>
                </div>
              )}
              {openedRatio.details.denominatorValue !== null && openedRatio.details.denominatorValue !== undefined && (
                <div className="flex items-center justify-between border-t border-line/30 py-1">
                  <span className="text-xs text-muted">{openedRatio.details.denominatorLabel || "Denominator"}</span>
                  <span className="font-mono text-sm font-semibold text-ink ml-2">{fmt(openedRatio.details.denominatorValue)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t-2 border-line pt-1">
                <span className="text-xs font-medium text-ink">Result</span>
                <span className="font-mono text-base font-bold text-propel-ink ml-2">{openedRatio.details.result}</span>
              </div>
            </div>
            {openedRatio.details.formula && (
              <div className="rounded-lg bg-pacer/40 p-2.5 w-full max-w-xs text-center">
                <div className="font-mono text-xs text-ink/70">{openedRatio.details.formula}</div>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Chart Bottom Sheet */}
      <BottomSheet
        isOpen={openedChart !== null}
        onClose={() => setOpenedChart(null)}
        title={openedChart ? `Evolution: ${openedChart.label}` : "Chart"}
      >
        {openedChart && (
          <div className="flex justify-center">
            <AreaChart data={openedChart.data} label={openedChart.label} />
          </div>
        )}
      </BottomSheet>

      {/* controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">Country:</span>
            <div className="flex items-center gap-1">
              {([
                { v: "all", emoji: "🌍", title: "Consolidated (ES + US)" },
                { v: "es", emoji: "🇪🇸", title: "Spain" },
                { v: "us", emoji: "🇺🇸", title: "USA" },
              ] as { v: Country; emoji: string; title: string }[]).map((o) => (
                <button key={o.v} onClick={() => setCountry(o.v)} title={o.title} aria-label={o.title} aria-pressed={country === o.v}
                  className={`grid h-9 w-9 place-items-center rounded-lg text-lg transition-colors ${country === o.v ? "bg-propel/40 ring-1 ring-propel/60" : "hover:bg-pacer"}`}>
                  <span aria-hidden>{o.emoji}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">Year:</span>
            <div className="inline-flex overflow-hidden rounded-md border border-line">
              {years.map((y) => (
                <button key={y} onClick={() => setYear(y)} className={`px-3 py-1.5 text-xs font-medium tabular-nums transition-colors ${year === y ? "bg-nav text-white" : "bg-surface text-muted hover:text-ink"}`}>{y}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">Level:</span>
            <div className="inline-flex overflow-hidden rounded-md border border-line">
              {([
                { v: "L1", label: "L1", t: "Categories only" },
                { v: "L2", label: "L2", t: "Categories + subcategories" },
                { v: "detail", label: "Detail", t: "Full detail down to account" },
              ] as { v: "L1" | "L2" | "detail"; label: string; t: string }[]).map((o) => (
                <button key={o.v} onClick={() => applyLevel(o.v)} title={o.t} aria-pressed={level === o.v}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${level === o.v ? "bg-nav text-white" : "bg-surface text-muted hover:text-ink"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setForecastOn((v) => !v)} aria-pressed={forecastOn}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${forecastOn ? "border-propel bg-propel/20 text-propel-ink" : "border-line bg-surface text-muted hover:text-ink"}`}>
            {forecastOn ? "● Forecast on" : "Forecast"}
          </button>
        </div>
      </div>

      {/* single scroll container → all tables share column geometry */}
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        {/* P&L */}
        <table className="border-collapse text-sm" style={tableStyle}>
          <ColGroup cols={cols} />
          <thead><Header label="Concept" /></thead>
          <tbody>{cats.map((cat) => <CatRows key={cat.key} cat={cat} {...rp} />)}</tbody>
          <tfoot>
            <tr className="border-t-2 border-nav">
              <th className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-semibold text-ink">Net result</th>
              {cols.map((c, i) => {
                const v = valueFor(grand, c);
                const color = colColor(c) || (v >= 0 ? "text-nebula" : "text-hotlava");
                return <td key={i} className={`px-3 py-2.5 text-right font-bold tabular-nums whitespace-nowrap ${bgFor(c.kind)} ${color}`}>{fmt(v)}</td>;
              })}
            </tr>
          </tfoot>
        </table>

        {/* GROWTH RATIOS */}
        <table className="border-collapse border-t-8 border-pacer text-sm" style={tableStyle}>
          <ColGroup cols={cols} />
          <tbody>
            <Section title="Growth ratios · GR [%] vs Q-1" />
            <RatioRow label="Revenues" mode="growth" get={gPrev("rev")} getDetails={detailsPrev("rev")} />
            <RatioRow label="Services" mode="growth" get={gPrev("services")} getDetails={detailsPrev("services")} />
            <RatioRow label="Licensing" mode="growth" get={gPrev("licensing")} getDetails={detailsPrev("licensing")} />
            <RatioRow label="COGS" mode="growth" get={gPrev("cogsNL")} getDetails={detailsPrev("cogsNL")} />
            <RatioRow label="Labor Cost" mode="growth" get={gPrev("labor")} getDetails={detailsPrev("labor")} />
            <RatioRow label="Labor Cost Mgmt" mode="growth" get={gPrev("mgmt")} getDetails={detailsPrev("mgmt")} />
            <RatioRow label="Labor Cost B.Dev" mode="growth" get={gPrev("bdev")} getDetails={detailsPrev("bdev")} />
            <RatioRow label="Labor Cost Operations" mode="growth" get={gPrev("ops")} getDetails={detailsPrev("ops")} />
            <RatioRow label="Opex" mode="growth" get={gPrev("opex")} getDetails={detailsPrev("opex")} />
            <tr>
              <th colSpan={cols.length + 1} className="sticky left-0 bg-surface px-4 pb-1 pt-4 text-left">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-propel-ink">
                    Growth ratios · GR [%] {pyBase === "fc" ? "vs Forecast" : priorYear == null ? "vs PY (no data)" : `vs PY (${priorYear})`}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
                    {([
                      { v: "py", label: "vs PY" },
                      { v: "fc", label: "vs Forecast" },
                    ] as { v: "py" | "fc"; label: string }[]).map((o) => (
                      <button key={o.v} onClick={() => setPyBase(o.v)}
                        className={`rounded-md px-3 py-1 text-[11px] font-medium leading-none transition-colors ${pyBase === o.v ? "bg-nav text-white" : "text-muted hover:text-ink"}`}>
                        {o.label}
                      </button>
                    ))}
                  </span>
                </div>
              </th>
            </tr>
            <RatioRow label="Revenues" mode="growth" get={gPY("rev")} getDetails={detailsPY("rev")} />
            <RatioRow label="Licensing" mode="growth" get={gPY("licensing")} getDetails={detailsPY("licensing")} />
            <RatioRow label="COGS" mode="growth" get={gPY("cogsNL")} getDetails={detailsPY("cogsNL")} />
            <RatioRow label="Labor Cost" mode="growth" get={gPY("labor")} getDetails={detailsPY("labor")} />
            <RatioRow label="Labor Cost Mgmt" mode="growth" get={gPY("mgmt")} getDetails={detailsPY("mgmt")} />
            <RatioRow label="Labor Cost B.Dev" mode="growth" get={gPY("bdev")} getDetails={detailsPY("bdev")} />
            <RatioRow label="Labor Cost Operations" mode="growth" get={gPY("ops")} getDetails={detailsPY("ops")} />
            <RatioRow label="Opex" mode="growth" get={gPY("opex")} getDetails={detailsPY("opex")} />
          </tbody>
        </table>

        {/* EFFICIENCY RATIOS */}
        <table className="border-collapse border-t-8 border-pacer text-sm" style={tableStyle}>
          <ColGroup cols={cols} />
          <tbody>
            <Section title="Efficiency ratios · [%] Expenses vs Revenues" />
            <RatioRow label="COGS vs Revenues" absolute get={(c) => { const r = mv(year, "rev", c); return r ? mv(year, "cogsNL", c) / r : null; }} getDetails={detailsRatio("COGS", "Revenue", "cogsNL", "rev", true)} />
            <RatioRow label="Labor Cost vs Revenues" absolute get={(c) => { const r = mv(year, "rev", c); return r ? mv(year, "labor", c) / r : null; }} getDetails={detailsRatio("Labor Cost", "Revenue", "labor", "rev", true)} />
            <RatioRow label="Management vs Revenues" absolute get={(c) => { const r = mv(year, "rev", c); return r ? mv(year, "mgmt", c) / r : null; }} getDetails={detailsRatio("Management", "Revenue", "mgmt", "rev", true)} />
            <RatioRow label="Business Development vs Revenues" absolute get={(c) => { const r = mv(year, "rev", c); return r ? mv(year, "bdev", c) / r : null; }} getDetails={detailsRatio("Business Development", "Revenue", "bdev", "rev", true)} />
            <RatioRow label="Operations vs Revenues" absolute get={(c) => { const r = mv(year, "rev", c); return r ? mv(year, "ops", c) / r : null; }} getDetails={detailsRatio("Operations", "Revenue", "ops", "rev", true)} />
            <RatioRow label="Margin of services" mode="eur" get={(c) => mv(year, "marginSvc", c)} getDetails={(c) => { const val = mv(year, "marginSvc", c); return { numeratorLabel: "Services margin", numeratorValue: val, result: fmt(val), formula: "Services margin" }; }} />
            <RatioRow label="Margin of services [%]" strong get={(c) => { const s = mv(year, "services", c); return s ? mv(year, "marginSvc", c) / s : null; }} getDetails={detailsRatio("Services margin", "Services", "marginSvc", "services")} />
            <RatioRow label="OPEX vs Revenues" absolute get={(c) => { const r = mv(year, "rev", c); return r ? mv(year, "opex", c) / r : null; }} getDetails={detailsRatio("OPEX", "Revenue", "opex", "rev", true)} />
            <Section title="Efficiency ratios · [%] Distribution of Costs" />
            <RatioRow label="Mgmt vs Labor Costs" absolute get={(c) => { const l = mv(year, "labor", c); return l ? mv(year, "mgmt", c) / l : null; }} getDetails={detailsRatio("Management", "Labor Costs", "mgmt", "labor", true)} />
            <RatioRow label="Sales vs Labor Costs" absolute get={(c) => { const l = mv(year, "labor", c); return l ? mv(year, "bdev", c) / l : null; }} getDetails={detailsRatio("Business Development", "Labor Costs", "bdev", "labor", true)} />
            <RatioRow label="Operations vs Labor Costs" absolute get={(c) => { const l = mv(year, "labor", c); return l ? mv(year, "ops", c) / l : null; }} getDetails={detailsRatio("Operations", "Labor Costs", "ops", "labor", true)} />
            <Section title="[%] EBITDA" />
            <RatioRow label="EBITDA %" strong signColor get={(c) => { const r = mv(year, "rev", c); return r ? mv(year, "ebitda", c) / r : null; }} getDetails={detailsRatio("EBITDA", "Revenue", "ebitda", "rev")} />
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted/80">
        Amounts in € · {country === "all" ? "consolidated ES+US" : country === "es" ? "Spain only" : "USA only"}. Closed months (through {MONTHS[lastActualMonth - 1]} {year}) = <strong>actual</strong>; {forecastOn ? <>open months in <span className="font-semibold text-propel-ink">blue = forecast</span>.</> : <>open months at 0 (turn on <strong>Forecast</strong>).</>} Ratio tables share columns with the P&L — expand a Q and all expand. EBITDA = Revenues + COGS + SG&A (before D&A and financials). Margin of services = Consulting − Operations payroll.
      </p>
    </div>
  );
}

function BottomSheet({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      )}
      <div className={`fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] transform rounded-t-2xl border-t border-line bg-surface transition-transform duration-300 ease-out ${
        isOpen ? "translate-y-0" : "translate-y-full"
      }`}>
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </>
  );
}

function AreaChart({ data, label, height = 200 }: { data: number[]; label: string; height?: number }) {
  if (!data || data.length === 0) return null;

  const leftMargin = 50;
  const bottomMargin = 30;
  const width = 420;
  const chartWidth = width - leftMargin - 20;
  const chartHeight = height - bottomMargin - 20;

  const max = Math.max(...data.filter(v => isFinite(v)), 1);
  const min = Math.min(...data.filter(v => isFinite(v)), 0);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: leftMargin + (i / (data.length - 1)) * chartWidth,
    y: 20 + chartHeight - ((v - min) / range) * chartHeight,
    value: v,
  }));

  const pathData = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = pathData + ` L ${points[points.length - 1].x} ${20 + chartHeight} L ${leftMargin} ${20 + chartHeight} Z`;

  // Y-axis ticks (3 levels: min, middle, max)
  const yTicks = [
    { value: min, label: fmt(min) },
    { value: min + range * 0.5, label: fmt(min + range * 0.5) },
    { value: max, label: fmt(max) },
  ];

  // X-axis labels (all 12 months)
  const monthLabels = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={width} height={height} className="border border-line/30 rounded-lg bg-pacer/20">
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis gridlines and labels */}
        {yTicks.map((tick, i) => {
          const y = 20 + chartHeight - ((tick.value - min) / range) * chartHeight;
          return (
            <g key={`y-${i}`}>
              <line x1={leftMargin} y1={y} x2={leftMargin + chartWidth} y2={y} stroke="#ccc" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x={leftMargin - 5} y={y + 3} fontSize="8" fill="#999" textAnchor="end" fontFamily="monospace">
                {tick.label}
              </text>
            </g>
          );
        })}

        {/* Y-axis line */}
        <line x1={leftMargin} y1={20} x2={leftMargin} y2={20 + chartHeight} stroke="#ccc" strokeWidth="1" />

        {/* X-axis line */}
        <line x1={leftMargin} y1={20 + chartHeight} x2={leftMargin + chartWidth} y2={20 + chartHeight} stroke="#ccc" strokeWidth="1" />

        {/* X-axis labels */}
        {monthLabels.map((label, i) => {
          const x = leftMargin + (i / (monthLabels.length - 1)) * chartWidth;
          return (
            <text key={`x-${i}`} x={x} y={20 + chartHeight + 12} fontSize="8" fill="#999" textAnchor="middle" fontFamily="monospace">
              {label}
            </text>
          );
        })}

        {/* Chart area and line */}
        <path d={areaPath} fill="url(#areaGradient)" />
        <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
        ))}
      </svg>
      <div className="text-xs text-muted">
        Range: <span className="font-semibold text-ink">{fmt(min)}</span> to <span className="font-semibold text-ink">{fmt(max)}</span>
      </div>
    </div>
  );
}

type KpiDetailsData = {
  kpiType: "revenue" | "result" | "margin";
  value: string;
  esActual: number;
  usActual: number;
  esForecast?: number;
  usForecast?: number;
  components?: Array<{ label: string; value: number }>;
};

function KpiDetails({ data }: { data: KpiDetailsData }) {
  const total = data.esActual + data.usActual;
  const totalFc = (data.esForecast ?? 0) + (data.usForecast ?? 0);
  const esShare = total ? ((data.esActual / total) * 100).toFixed(1) : "—";
  const usShare = total ? ((data.usActual / total) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-pacer/50 p-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">Current Value</div>
        <div className="mt-2 text-2xl font-semibold text-ink">{data.value}</div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted">Breakdown by Market</div>
        <div className="space-y-2 rounded-lg border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">Spain</span>
            <span className="font-semibold tabular-nums text-ink">{eur0(data.esActual)} <span className="text-xs text-muted">({esShare}%)</span></span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">USA</span>
            <span className="font-semibold tabular-nums text-ink">{eur0(data.usActual)} <span className="text-xs text-muted">({usShare}%)</span></span>
          </div>
        </div>
      </div>

      {data.esForecast !== undefined && (data.esForecast !== 0 || data.usForecast !== 0) && (
        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Forecast (Open Months)</div>
          <div className="space-y-2 rounded-lg border border-line p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink">Spain</span>
              <span className="font-semibold tabular-nums text-propel-ink">{eur0(data.esForecast ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink">USA</span>
              <span className="font-semibold tabular-nums text-propel-ink">{eur0(data.usForecast ?? 0)}</span>
            </div>
          </div>
        </div>
      )}

      {data.components && data.components.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Main Components</div>
          <div className="space-y-2 rounded-lg border border-line p-3">
            {data.components.map((c, i) => (
              <div key={i} className="flex items-center justify-between border-b border-line/30 pb-2 last:border-0">
                <span className="text-sm text-ink/90">{c.label}</span>
                <span className="font-semibold tabular-nums text-ink">{eur0(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent, tone, onClick }: { label: string; value: string; accent?: boolean; tone?: "pos" | "neg"; onClick?: () => void }) {
  const valueColor = tone === "neg" ? "text-hotlava" : tone === "pos" ? "text-nebula" : "text-ink";
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-line bg-surface px-4 py-3 ${onClick ? "cursor-pointer transition-colors hover:bg-pacer/30" : ""}`}
    >
      <div className="flex items-center gap-2">
        {accent && <span className="h-2 w-2 rounded-full bg-propel" />}
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</span>
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${valueColor}`}>{value}</div>
    </div>
  );
}

type RowProps = {
  cols: Col[];
  rows: Set<string>;
  toggleRow: (k: string) => void;
  blend: (node: Scen) => number[];
  cellClass: (c: Col, extra?: string) => string;
  onChart?: (label: string, data: number[]) => void;
};

function CatRows({ cat, ...p }: { cat: CatNode } & RowProps) {
  const open = p.rows.has(cat.key);
  const m = p.blend(cat);
  const monthlyActual = m; // m ya contiene los datos mensuales blended

  return (
    <>
      <tr onClick={() => p.toggleRow(cat.key)} className={`cursor-pointer border-b border-line font-semibold text-ink hover:bg-pacer ${open ? "bg-pacer/60" : ""}`}>
        <th className={`sticky left-0 z-10 whitespace-nowrap px-4 py-2 text-left font-semibold ${open ? "bg-[#eef0f0]" : "bg-surface"}`}>
          <Chevron open={open} /> <span className="ml-1">{cat.label}</span>
        </th>
        {p.cols.map((c, i) => <td key={i} className={p.cellClass(c, "font-semibold")}>{fmt(valueFor(m, c))}</td>)}
        <td className="px-1 py-2 text-center">
          <button onClick={(e) => { e.stopPropagation(); p.onChart?.(cat.label, monthlyActual); }} className="text-sm text-muted/50 hover:text-propel-ink transition-colors" title="View chart">
            📈
          </button>
        </td>
      </tr>
      {open && cat.subs.map((sub) => <SubRows key={sub.key} sub={sub} {...p} />)}
    </>
  );
}

function SubRows({ sub, ...p }: { sub: SubNode } & RowProps) {
  const open = p.rows.has(sub.key);
  const hasDetail = sub.accounts.length > 0;
  const m = p.blend(sub);
  return (
    <>
      <tr onClick={() => hasDetail && p.toggleRow(sub.key)} className={`border-b border-line/70 text-ink/90 ${hasDetail ? "cursor-pointer hover:bg-pacer" : ""}`}>
        <th className="sticky left-0 z-10 overflow-hidden text-ellipsis whitespace-nowrap bg-surface px-4 py-1.5 pl-9 text-left font-normal" title={sub.label}>
          {hasDetail ? <Chevron open={open} /> : <span className="inline-block w-3" />} <span className="ml-1">{sub.label}</span>
        </th>
        {p.cols.map((c, i) => <td key={i} className={p.cellClass(c)}>{fmt(valueFor(m, c))}</td>)}
        <td className="px-1 py-1.5 text-center">
          <button onClick={(e) => { e.stopPropagation(); p.onChart?.(sub.label, m); }} className="text-sm text-muted/50 hover:text-propel-ink transition-colors" title="View chart">
            📈
          </button>
        </td>
      </tr>
      {open && sub.accounts.map((a) => {
        const am = p.blend(a);
        return (
          <tr key={a.account} className="border-b border-line/50 text-muted hover:bg-pacer/30">
            <th className="sticky left-0 z-10 overflow-hidden text-ellipsis whitespace-nowrap bg-surface px-4 py-1.5 pl-16 text-left font-normal" title={a.name}>
              <span className="mr-2 font-mono text-xs text-muted/70">{a.account}</span>
              {a.name}
            </th>
            {p.cols.map((c, i) => <td key={i} className={p.cellClass(c)}>{fmt(valueFor(am, c))}</td>)}
            <td className="px-0 py-1 text-center w-4">
              <button onClick={(e) => { e.stopPropagation(); p.onChart?.(a.name, am); }} className="text-xs text-muted/50 hover:text-propel-ink transition-colors" title="View evolution">
                📈
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}
