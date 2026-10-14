# PropellingTech · Reporting

Internal financial reporting for the Propelling partners. Next.js (App Router) on Vercel, reading BigQuery
(`propellingtech-datalake`, EU) on the server only — credentials never reach the browser.

## Pages

- **`/` — P&L.** Rows category → subcategory → account, by month / quarter / half / full year, growth vs prior
  period and prior year, efficiency ratios and EBITDA. Filter by legal entity: **SL** (Spain, Holded), **LLC**
  (USA, QuickBooks), **Corp** (parent) or consolidated. *Forecast* fills open months.
- **`/income-recognition` — Income Recognition.** Invoicing / non-invoicing days and IR (ID days × project rate)
  per client, with drill-down to projects. Year and closing month are selectable.

The last closed month is always the previous calendar month at most (`src/lib/period.ts`).

## Data sources

| Use | Table |
|-----|-------|
| P&L actual | `03_gold_holded.tbl-gld-fin-f_pnl` (`market` = SL / LLC / CORP) |
| P&L forecast | `03_gold_finance.tbl-gld-fin-f_pnl_forecast` (ES → SL, US → LLC; USD converted with `tbl-gld-fin-fx_rates`) |
| Taxonomy / names | `02_silver_holded.tbl-slv-fin-pnl_master`, `tbl-slv-fin-chart_of_accounts` |
| Income Recognition | `02_silver_holded.tbl-slv-ops-agenda` + `tbl-slv-ops-master-projects` |

All queries live in `src/lib/bigquery.ts`.

## Access

Every page and API route requires login (`src/middleware.ts`). Email allowlist + one shared password, signed
session cookie valid 30 days. Configured with environment variables:

| Variable | Content |
|----------|---------|
| `ALLOWED_EMAILS` | Comma-separated authorized emails. Removing one revokes access on the next request. |
| `APP_PASSWORD` | Shared password. |
| `AUTH_SECRET` | Random secret that signs the session cookie (`openssl rand -base64 48`). |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service-account JSON (inline) for BigQuery. Not needed locally. |

## Local development

```bash
gcloud auth application-default login   # BigQuery via your own Google account
ALLOWED_EMAILS=you@propellingtech.com APP_PASSWORD=dev AUTH_SECRET=dev npm run dev
```

Open http://localhost:3000.

## Deploy

Pushing to `main` deploys to Vercel (team `propelling-tech`, project `propellingtech-reporting`).
Environment variables are managed in Vercel → Settings → Environment Variables.

Brand and visual rules: [`BRAND.md`](BRAND.md).
