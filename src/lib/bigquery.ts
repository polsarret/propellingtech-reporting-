import { BigQuery } from "@google-cloud/bigquery";
import type { Entity } from "./entities";
import { closingMonthOf } from "./period";

export type { Entity } from "./entities";

// Cliente de BigQuery.
// - En local usa tus Application Default Credentials (gcloud auth application-default login).
// - En Vercel usará las credenciales del JSON en GOOGLE_APPLICATION_CREDENTIALS.
const PROJECT = process.env.GCP_PROJECT ?? "propellingtech-datalake";
const LOCATION = process.env.BQ_LOCATION ?? "EU";
const PNL_TABLE = "`propellingtech-datalake.03_gold_holded.tbl-gld-fin-f_pnl`";
// Forecast cargado desde el Excel de FCST (por cuenta y mes; ES en EUR, US en USD).
const FORECAST_TABLE = "`propellingtech-datalake.03_gold_finance.tbl-gld-fin-f_pnl_forecast`";
const PNL_MASTER = "`propellingtech-datalake.02_silver_holded.tbl-slv-fin-pnl_master`";
const CHART_OF_ACCOUNTS = "`propellingtech-datalake.02_silver_holded.tbl-slv-fin-chart_of_accounts`";
const FX_RATES = "`propellingtech-datalake.03_gold_finance.tbl-gld-fin-fx_rates`";

let client: BigQuery | null = null;
function bq(): BigQuery {
  if (!client) {
    const options: any = { projectId: PROJECT, location: LOCATION };
    
    // Handle GOOGLE_APPLICATION_CREDENTIALS in Vercel
    const credsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credsEnv && credsEnv.startsWith("{")) {
      try {
        // Parse JSON credentials and pass directly
        options.credentials = JSON.parse(credsEnv);
      } catch (e) {
        console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS:", e);
      }
    }
    
    client = new BigQuery(options);
  }
  return client;
}

const z12 = () => new Array<number>(12).fill(0);

// `other` recoge valores de `market` no reconocidos: solo cuentan en el consolidado.
export type ByMarket = Record<Entity | "other", number[]>;
export type Scen = { act: ByMarket; fc: ByMarket };
// account como string: los IDs de QuickBooks (CORP/LLC) tienen 19 dígitos y no caben en un number de JS.
export type LeafNode = Scen & { account: string; name: string };
export type SubNode = Scen & { key: string; label: string; sort: string; accounts: LeafNode[] };
export type CatNode = Scen & { key: string; label: string; sort: string; subs: SubNode[] };
export type PnlMatrix = { cats: CatNode[]; lastActualMonth: number; year: number };

type FlatRow = {
  scenario: string;
  pnl_l1: string;
  pnl_l2: string | null;
  sort_order: string;
  account: string;
  name: string;
  month: number;
  market: string;
  v: number;
};

const newByMarket = (): ByMarket => ({ sl: z12(), llc: z12(), corp: z12(), other: z12() });
const newScen = (): Scen => ({ act: newByMarket(), fc: newByMarket() });

function entityOf(market: string | null): Entity | "other" {
  const m = (market ?? "").trim().toUpperCase();
  if (m.includes("CORP")) return "corp";
  if (m.includes("LLC")) return "llc";
  if (m === "SL" || m.includes("S.L") || m.endsWith(" SL")) return "sl";
  return "other";
}

/** Matriz del P&L: filas (categoría→subcat→cuenta) × 12 meses, por escenario (actual/forecast) y sociedad. */
export async function getPnlMatrix(year: number): Promise<PnlMatrix> {
  try {
    // Forecast: market ES → SL, US → LLC (la CORP no tiene forecast); USD → EUR con fx_rates del mes.
    const query = `
      WITH tax AS (
        SELECT CAST(SPLIT(id_account, '-')[OFFSET(1)] AS INT64) AS account,
               ANY_VALUE(pnl_l1) AS pnl_l1, ANY_VALUE(pnl_l2) AS pnl_l2, ANY_VALUE(sort_order) AS sort_order
        FROM ${PNL_MASTER} GROUP BY account
      ),
      names AS (SELECT account, ANY_VALUE(name) AS name FROM ${CHART_OF_ACCOUNTS} WHERE account IS NOT NULL GROUP BY account)
      SELECT
        'actual' AS scenario,
        pnl_l1, pnl_l2, sort_order, CAST(account AS STRING) AS account,
        ANY_VALUE(account_name) AS name, month, market,
        CAST(SUM(balance) AS FLOAT64) AS v
      FROM ${PNL_TABLE}
      WHERE year = @year
      GROUP BY scenario, pnl_l1, pnl_l2, sort_order, account, month, market
      UNION ALL
      SELECT
        'forecast' AS scenario,
        t.pnl_l1, t.pnl_l2, t.sort_order, CAST(fc.account AS STRING) AS account,
        ANY_VALUE(n.name) AS name, fc.month,
        CASE fc.market WHEN 'ES' THEN 'SL' WHEN 'US' THEN 'LLC' ELSE fc.market END AS market,
        CAST(SUM(IF(fc.currency = 'USD', fc.balance_native / fx.usd_per_eur, fc.balance_native)) AS FLOAT64) AS v
      FROM ${FORECAST_TABLE} fc
      JOIN tax t USING (account)
      LEFT JOIN names n USING (account)
      LEFT JOIN ${FX_RATES} fx USING (year_month)
      WHERE fc.year = @year
      GROUP BY scenario, t.pnl_l1, t.pnl_l2, t.sort_order, fc.account, fc.month, market
    `;
    const [rows] = await bq().query({ query, location: LOCATION, params: { year } });
  const flat = rows as FlatRow[];

  const cats = new Map<string, CatNode>();
  const unknownMarkets = new Set<string>();
  for (const r of flat) {
    const mi = r.month - 1;
    if (mi < 0 || mi > 11) continue;
    const bucket = r.scenario === "forecast" ? "fc" : "act";
    const mkt = entityOf(r.market);
    if (mkt === "other") unknownMarkets.add(String(r.market));

    let cat = cats.get(r.pnl_l1);
    if (!cat) {
      cat = { key: r.pnl_l1, label: r.pnl_l1, sort: r.sort_order, ...newScen(), subs: [] };
      cats.set(r.pnl_l1, cat);
    }
    if (r.sort_order < cat.sort) cat.sort = r.sort_order;

    const subLabel = r.pnl_l2 && r.pnl_l2.trim() ? r.pnl_l2 : "—";
    const subKey = `${r.pnl_l1}|${subLabel}`;
    let sub = cat.subs.find((s) => s.key === subKey);
    if (!sub) {
      sub = { key: subKey, label: subLabel, sort: r.sort_order, ...newScen(), accounts: [] };
      cat.subs.push(sub);
    }
    if (r.sort_order < sub.sort) sub.sort = r.sort_order;

    let leaf = sub.accounts.find((a) => a.account === r.account);
    if (!leaf) {
      leaf = { account: r.account, name: r.name, ...newScen() };
      sub.accounts.push(leaf);
    }
    for (const node of [cat, sub, leaf] as Scen[]) node[bucket][mkt][mi] += r.v;
  }

  if (unknownMarkets.size) console.warn(`Unknown market values in f_pnl ${year}:`, [...unknownMarkets]);

  const list = [...cats.values()].sort((a, b) => a.sort.localeCompare(b.sort, undefined, { numeric: true }));
  for (const c of list) {
    c.subs.sort((a, b) => a.sort.localeCompare(b.sort, undefined, { numeric: true }));
    for (const s of c.subs) {
      const abs = (n: LeafNode) =>
        Math.abs(Object.values(n.act).reduce((t, arr) => t + arr.reduce((x, y) => x + y, 0), 0));
      s.accounts.sort((a, b) => abs(b) - abs(a));
    }
  }

  // Último mes cerrado = el menor de los últimos meses con dato de SL y LLC (el cierre está completo
  // cuando ambas operativas han cerrado). CORP no cuenta: la matriz puede no tener movimiento cada mes.
  const lastWithData = (e: Entity | "other") => {
    let last = 0;
    for (const c of list) for (let i = 0; i < 12; i++) if (c.act[e][i] !== 0) last = Math.max(last, i + 1);
    return last;
  };
  const opLasts = (["sl", "llc"] as const).map(lastWithData).filter((n) => n > 0);
  let lastActual = opLasts.length
    ? Math.min(...opLasts)
    : Math.max(lastWithData("corp"), lastWithData("other"));
  // El mes en curso nunca está cerrado (hay apuntes parciales y periodificaciones a futuro).
  lastActual = Math.min(lastActual, closingMonthOf(year));

  return { cats: list, lastActualMonth: lastActual, year };
  } catch (e) {
    console.error("Error getting P&L matrix:", e);
    return { cats: [], lastActualMonth: 0, year };
  }
}

/** Años disponibles en la vista (para el selector). */
export async function getAvailableYears(): Promise<number[]> {
  try {
    // Try to get years from agenda table instead of problematic consolidated view
    const [rows] = await bq().query({
      query: `SELECT DISTINCT EXTRACT(YEAR FROM date) as year FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` WHERE EXTRACT(YEAR FROM date) IS NOT NULL ORDER BY year DESC`,
      location: LOCATION,
    });
    return (rows as { year: number }[]).map((r) => r.year).filter((y) => y > 0);
  } catch (e) {
    console.error("Error getting available years:", e);
    const y = new Date().getFullYear();
    return [y, y - 1]; // Fallback
  }
}

// Income Recognition Report Types
export type Metrics = {
  id: number;
  nid: number;
  ir: number;
};

export type ClientReportRow = {
  clientName: string;
  closingMonth: number;
  monthly: Metrics;
  accumulated: Metrics;
};

export type ProjectReportRow = {
  projectId: string;
  projectName: string;
  billableFlag: number;
  closingMonth: number;
  monthly: Metrics;
  accumulated: Metrics;
};

/** Income Recognition Report - aggregated by Client (closing month + accumulated) */
export async function getIncomeRecognitionByClient(year: number, closingMonth: number): Promise<ClientReportRow[]> {
  const query = `
    WITH agenda_with_rate AS (
      SELECT
        EXTRACT(MONTH FROM a.date) AS month,
        a.project_id,
        mp.client_name,
        mp.rate,
        SUM(CASE WHEN a.category = 'ID' THEN a.days ELSE 0 END) AS id_days,
        SUM(CASE WHEN a.category = 'NID' THEN a.days ELSE 0 END) AS nid_days
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` mp ON a.project_id = mp.project_id
      WHERE EXTRACT(YEAR FROM a.date) = @year
        AND a.category IN ('ID', 'NID')
      GROUP BY month, a.project_id, mp.client_name, mp.rate
    ),
    ir_calculated AS (
      SELECT
        month,
        client_name,
        project_id,
        id_days,
        nid_days,
        ROUND(id_days * COALESCE(rate, 0), 2) AS ir_amount
      FROM agenda_with_rate
    )
    SELECT
      client_name,
      SUM(CASE WHEN month = @closingMonth THEN id_days ELSE 0 END) AS monthly_id,
      SUM(CASE WHEN month = @closingMonth THEN nid_days ELSE 0 END) AS monthly_nid,
      SUM(CASE WHEN month = @closingMonth THEN ir_amount ELSE 0 END) AS monthly_ir,
      SUM(id_days) AS accumulated_id,
      SUM(nid_days) AS accumulated_nid,
      SUM(ir_amount) AS accumulated_ir
    FROM ir_calculated
    WHERE month <= @closingMonth
    GROUP BY client_name
    HAVING SUM(ir_amount) > 0 OR SUM(id_days) > 0
    ORDER BY accumulated_ir DESC
  `;

  const [rows] = await bq().query({
    query,
    location: LOCATION,
    params: { year, closingMonth }
  });

  const result: ClientReportRow[] = [];
  for (const row of rows as any[]) {
    result.push({
      clientName: row.client_name,
      closingMonth,
      monthly: {
        id: row.monthly_id || 0,
        nid: row.monthly_nid || 0,
        ir: row.monthly_ir || 0,
      },
      accumulated: {
        id: row.accumulated_id || 0,
        nid: row.accumulated_nid || 0,
        ir: row.accumulated_ir || 0,
      },
    });
  }

  return result;
}

/** Income Recognition Report - drill-down by Project within a Client (closing month + accumulated) */
export async function getIncomeRecognitionByProject(year: number, closingMonth: number, clientName: string): Promise<ProjectReportRow[]> {
  const query = `
    WITH agenda_with_rate AS (
      SELECT
        EXTRACT(MONTH FROM a.date) AS month,
        a.project_id,
        mp.name AS project_name,
        mp.billable_flag,
        mp.rate,
        SUM(CASE WHEN a.category = 'ID' THEN a.days ELSE 0 END) AS id_days,
        SUM(CASE WHEN a.category = 'NID' THEN a.days ELSE 0 END) AS nid_days
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` mp ON a.project_id = mp.project_id
      WHERE EXTRACT(YEAR FROM a.date) = @year
        AND a.category IN ('ID', 'NID')
        AND mp.client_name = @clientName
      GROUP BY month, a.project_id, mp.name, mp.billable_flag, mp.rate
    ),
    ir_calculated AS (
      SELECT
        month,
        project_id,
        project_name,
        billable_flag,
        id_days,
        nid_days,
        ROUND(id_days * COALESCE(rate, 0), 2) AS ir_amount
      FROM agenda_with_rate
    )
    SELECT
      project_id,
      project_name,
      billable_flag,
      SUM(CASE WHEN month = @closingMonth THEN id_days ELSE 0 END) AS monthly_id,
      SUM(CASE WHEN month = @closingMonth THEN nid_days ELSE 0 END) AS monthly_nid,
      SUM(CASE WHEN month = @closingMonth THEN ir_amount ELSE 0 END) AS monthly_ir,
      SUM(id_days) AS accumulated_id,
      SUM(nid_days) AS accumulated_nid,
      SUM(ir_amount) AS accumulated_ir
    FROM ir_calculated
    WHERE month <= @closingMonth
    GROUP BY project_id, project_name, billable_flag
    ORDER BY accumulated_ir DESC
  `;

  const [rows] = await bq().query({
    query,
    location: LOCATION,
    params: { year, clientName, closingMonth }
  });

  const result: ProjectReportRow[] = [];
  for (const row of rows as any[]) {
    result.push({
      projectId: row.project_id,
      projectName: row.project_name,
      billableFlag: row.billable_flag,
      closingMonth,
      monthly: {
        id: row.monthly_id || 0,
        nid: row.monthly_nid || 0,
        ir: row.monthly_ir || 0,
      },
      accumulated: {
        id: row.accumulated_id || 0,
        nid: row.accumulated_nid || 0,
        ir: row.accumulated_ir || 0,
      },
    });
  }

  return result;
}
