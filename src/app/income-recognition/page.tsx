import { getIncomeRecognitionByClient, getAvailableYears } from "@/lib/bigquery";
import IncomeRecognitionReport from "../IncomeRecognitionReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function IncomeRecognitionPage() {
  const years = await getAvailableYears();
  const latestYear = years[0] || 2026;
  const clients = await getIncomeRecognitionByClient(latestYear);

  return (
    <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Income Recognition Report</h1>
        <p className="mt-2 text-sm text-muted">
          Invoicing Days (ID) · Non-Invoicing Days (NID) · Income Recognition (IR) · by Client & Project. Year: {latestYear}
        </p>
      </header>

      <IncomeRecognitionReport clients={clients} />

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
          <strong>IR (Income Recognition):</strong> Revenue recognized from GL by client
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
