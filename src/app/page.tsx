import { getPnlMatrix, getAvailableYears } from "@/lib/bigquery";
import PnlWorkspace from "./PnlMatrix";

// Runs on the server (Node): credentials never reach the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function Home() {
  const years = await getAvailableYears();
  const matrices = await Promise.all(years.map((y) => getPnlMatrix(y)));
  const latest = matrices[0]; // most recent year
  const lastClose = latest && latest.lastActualMonth > 0 ? `${MONTHS_FULL[latest.lastActualMonth - 1]} ${latest.year}` : "—";

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Consolidated P&amp;L</h1>
          <p className="mt-1 text-sm text-muted">
            Spain + USA · in euros · source BigQuery. Actual by default; turn on Forecast to project open
            months.
          </p>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-nebula" />
          <div className="leading-tight">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted">Last close</div>
            <div className="text-sm font-semibold tabular-nums text-ink">{lastClose}</div>
          </div>
        </div>
      </header>

      <PnlWorkspace matrices={matrices} />

      <p className="mt-6 text-xs text-muted/80">
        Live from BigQuery · view <code className="text-propel-ink">vw-gld-fin-f_pnl_consolidated</code>
      </p>
    </main>
  );
}
