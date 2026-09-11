import { BigQuery } from "@google-cloud/bigquery";

// Cliente de BigQuery.
// - En local usa tus Application Default Credentials (gcloud auth application-default login).
// - En Vercel usará las credenciales del JSON en GOOGLE_APPLICATION_CREDENTIALS.
const PROJECT = process.env.GCP_PROJECT ?? "propellingtech-datalake";
const LOCATION = process.env.BQ_LOCATION ?? "EU";
const CONSOLIDATED_VIEW =
  "`propellingtech-datalake.03_gold_holded.tbl-gld-fin-f_pnl`";

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

// Cada nodo lleva el desglose mensual por escenario (actual/forecast) y mercado (ES/US).
export type ByMarket = { es: number[]; us: number[] };
export type Scen = { act: ByMarket; fc: ByMarket };
export type LeafNode = Scen & { account: number; name: string };
export type SubNode = Scen & { key: string; label: string; sort: string; accounts: LeafNode[] };
export type CatNode = Scen & { key: string; label: string; sort: string; subs: SubNode[] };
export type PnlMatrix = { cats: CatNode[]; lastActualMonth: number; year: number };

type FlatRow = {
  scenario: string;
  pnl_l1: string;
  pnl_l2: string | null;
  sort_order: string;
  account: number;
  name: string;
  month: number;
  market: string;
  v: number;
};

const newScen = (): Scen => ({ act: { es: z12(), us: z12() }, fc: { es: z12(), us: z12() } });

/** Matriz del P&L: filas (categoría→subcat→cuenta) × 12 meses, por escenario (actual/forecast) y ES/US. */
export async function getPnlMatrix(year: number): Promise<PnlMatrix> {
  try {
    const query = `
      SELECT 
        'actual' as scenario,
        pnl_l1, pnl_l2, sort_order, account,
        ANY_VALUE(account_name) AS name, month, market,
        CAST(SUM(balance) AS FLOAT64) AS v
      FROM ${CONSOLIDATED_VIEW}
      WHERE year = @year 
      
      
      GROUP BY scenario, pnl_l1, pnl_l2, sort_order, account, month, market
    `;
    const [rows] = await bq().query({ query, location: LOCATION, params: { year } });
  const flat = rows as FlatRow[];

  const cats = new Map<string, CatNode>();
  for (const r of flat) {
    const mi = r.month - 1;
    if (mi < 0 || mi > 11) continue;
    const bucket = r.scenario === "forecast" ? "fc" : "act";
    const mkt = r.market === "US" ? "us" : "es";

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

  const list = [...cats.values()].sort((a, b) => a.sort.localeCompare(b.sort, undefined, { numeric: true }));
  for (const c of list) {
    c.subs.sort((a, b) => a.sort.localeCompare(b.sort, undefined, { numeric: true }));
    for (const s of c.subs) {
      const abs = (n: LeafNode) =>
        Math.abs(n.act.es.reduce((x, y) => x + y, 0) + n.act.us.reduce((x, y) => x + y, 0));
      s.accounts.sort((a, b) => abs(b) - abs(a));
    }
  }

  // Último mes real = último mes con dato ACTUAL de USA.
  let lastActual = 0;
  for (const c of list) for (let i = 0; i < 12; i++) if (c.act.us[i] !== 0) lastActual = Math.max(lastActual, i + 1);
  if (lastActual === 0) for (const c of list) for (let i = 0; i < 12; i++) if (c.act.es[i] !== 0) lastActual = Math.max(lastActual, i + 1);

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
    return [2026, 2025]; // Fallback
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

async function getClosingMonth(year: number): Promise<number> {
  return 7; // Hardcoded to July for now
}

/** Income Recognition Report - aggregated by Client (closing month + accumulated) */
export async function getIncomeRecognitionByClient(year: number): Promise<ClientReportRow[]> {
  const closingMonth = await getClosingMonth(year);

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
export async function getIncomeRecognitionByProject(year: number, clientName: string): Promise<ProjectReportRow[]> {
  const closingMonth = await getClosingMonth(year);

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
