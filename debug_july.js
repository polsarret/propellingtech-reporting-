const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 July 2026 Data for FERRER, CINFA, ADAM FOODS\n');
    
    // 1. ID/NID for July only
    console.log('=== INVOICING DAYS - JULY ONLY ===\n');
    const query1 = `
      SELECT
        COALESCE(p.client_name, 'INTERNAL') AS client_name,
        a.category,
        SUM(a.days) AS days
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON a.project_id = p.project_id
      WHERE EXTRACT(YEAR FROM a.date) = 2026
        AND EXTRACT(MONTH FROM a.date) = 7
        AND a.category IN ('ID', 'NID')
        AND p.client_name IN ('FERRER', 'CINFA', 'ADAM FOODS')
      GROUP BY client_name, a.category
      ORDER BY client_name, a.category
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    const byClient = {};
    rows1.forEach(r => {
      if (!byClient[r.client_name]) byClient[r.client_name] = {};
      byClient[r.client_name][r.category] = r.days;
    });
    
    for (const [client, data] of Object.entries(byClient)) {
      const id = data.ID || 0;
      const nid = data.NID || 0;
      console.log(`${client.padEnd(15)} | ID: ${id.toLocaleString('es-ES', {maximumFractionDigits: 1}).padStart(8)} | NID: ${nid.toLocaleString('es-ES', {maximumFractionDigits: 1}).padStart(8)}`);
    }
    
    // 2. IR for July only (with Consulting accounts only)
    console.log('\n\n=== INCOME RECOGNITION - JULY ONLY (Consulting accounts) ===\n');
    const query2 = `
      SELECT
        REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') AS client_name,
        account,
        SUM(COALESCE(credit, debit, 0)) AS amount
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE EXTRACT(YEAR FROM date) = 2026
        AND EXTRACT(MONTH FROM date) = 7
        AND account IN (70500002, 70500003, 70500004)
        AND REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') IN ('FERRER', 'CINFA', 'ADAM FOODS')
      GROUP BY client_name, account
      ORDER BY client_name, amount DESC
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    const byClient2 = {};
    rows2.forEach(r => {
      if (!byClient2[r.client_name]) byClient2[r.client_name] = 0;
      byClient2[r.client_name] += r.amount || 0;
    });
    
    for (const [client, total] of Object.entries(byClient2)) {
      console.log(`${client.padEnd(15)} | IR: €${total.toLocaleString('es-ES', {maximumFractionDigits: 0}).padStart(10)}`);
    }
    
    // 3. Calculate rates
    console.log('\n\n=== CALCULATED RATES (IR / ID) ===\n');
    for (const client of ['FERRER', 'CINFA', 'ADAM FOODS']) {
      const id = byClient[client]?.ID || 0;
      const ir = byClient2[client] || 0;
      const rate = id > 0 ? ir / id : 0;
      console.log(`${client.padEnd(15)} | €${ir.toLocaleString('es-ES', {maximumFractionDigits: 0}).padStart(10)} / ${id.toLocaleString('es-ES', {maximumFractionDigits: 1}).padStart(8)} days = €${rate.toLocaleString('es-ES', {maximumFractionDigits: 0}).padStart(6)}/día`);
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
