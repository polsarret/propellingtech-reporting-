import Link from "next/link";
import { getIncomeRecognitionByClient, getAvailableYears } from "@/lib/bigquery";
import { closingMonthOf, defaultClosingPeriod } from "@/lib/period";
import IncomeRecognitionReport from "../IncomeRecognitionReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function IncomeRecognitionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const def = defaultClosingPeriod();
  // Solo años con algún mes cerrado (el agenda incluye vacaciones planificadas a futuro).
  const years = (await getAvailableYears()).filter((y) => closingMonthOf(y) > 0);
  const year = years.includes(Number(sp.year)) ? Number(sp.year) : def.year;
  const lastClosed = closingMonthOf(year);
  const reqMonth = Number(sp.month);
  const month = reqMonth >= 1 && reqMonth <= lastClosed ? reqMonth : lastClosed;
  const clients = await getIncomeRecognitionByClient(year, month);

  const pill = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium tabular-nums transition-colors ${active ? "bg-nav text-white" : "bg-surface text-muted hover:text-ink"}`;

  return (
    <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Income Recognition Report</h1>
        <p className="mt-2 text-sm text-muted">
          Invoicing Days (ID) · Non-Invoicing Days (NID) · Income Recognition (IR) · by Client &amp; Project.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Year:</span>
          <div className="inline-flex overflow-hidden rounded-md border border-line">
            {years.map((y) => (
              <Link key={y} href={`?year=${y}`} className={pill(y === year)}>{y}</Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Closing month:</span>
          <div className="inline-flex flex-wrap overflow-hidden rounded-md border border-line">
            {MONTHS.slice(0, lastClosed).map((m, i) => (
              <Link key={m} href={`?year=${year}&month=${i + 1}`} className={pill(i + 1 === month)}>{m}</Link>
            ))}
          </div>
        </div>
      </div>

      {/* key: reinicia el drill-down al cambiar de periodo */}
      <IncomeRecognitionReport key={`${year}-${month}`} clients={clients} year={year} closingMonth={month} />

      <div className="mt-8 text-xs text-muted/70 space-y-1">
        <p>
          <strong>ID (Invoicing Days):</strong> Days assigned to billable projects
        </p>
        <p>
          <strong>NID (Non-Invoicing Days):</strong> Days not assigned to billable projects (internal, bench, vacations)
        </p>
        <p>
          <strong>Dev % (Devolution):</strong> NID / ID — ratio of non-productive to productive days
        </p>
        <p>
          <strong>IR (Income Recognition):</strong> ID days × project daily rate (master projects)
        </p>
        <p>
          <strong>Rate:</strong> IR per billable day (IR / ID)
        </p>
        <p>
          <strong>Net Rate:</strong> IR per total day (IR / (ID + NID))
        </p>
      </div>
    </main>
  );
}
