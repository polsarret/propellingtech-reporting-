const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 Debugging Rates for FERRER, CINFA, ADAM FOODS\n');
    
    // 1. Get ID/NID for these clients
    console.log('=== INVOICING DAYS (ID/NID) ===\n');
    const query1 = `
      SELECT
        COALESCE(p.client_name, 'INTERNAL') AS client_name,
        SUM(CASE WHEN a.category = 'ID' THEN a.days ELSE 0 END) AS total_id,
        SUM(CASE WHEN a.category = 'NID' THEN a.days ELSE 0 END) AS total_nid,
        COUNT(DISTINCT a.propeller_id) AS num_people
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON a.project_id = p.project_id
      WHERE EXTRACT(YEAR FROM a.date) = 2026
        AND a.category IN ('ID', 'NID')
        AND p.client_name IN ('FERRER', 'CINFA', 'ADAM FOODS')
      GROUP BY client_name
      ORDER BY client_name
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    rows1.forEach(r => {
      console.log(`${r.client_name.padEnd(15)} | ID: ${r.total_id.toLocaleString('es-ES', {maximumFractionDigits: 1}).padStart(8)} | NID: ${r.total_nid.toLocaleString('es-ES', {maximumFractionDigits: 1}).padStart(8)} | People: ${r.num_people}`);
    });
    
    // 2. Get IR from GL - see what accounts are being captured
    console.log('\n=== INCOME RECOGNITION (IR) - by GL Account ===\n');
    const query2 = `
      SELECT
        REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') AS client_name,
        account,
        SUBSTR(desc1, 1, 70) AS description,
        SUM(COALESCE(credit, debit, 0)) AS total_amount,
        COUNT(*) AS num_entries
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE EXTRACT(YEAR FROM date) = 2026
        AND REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') IN ('FERRER', 'CINFA', 'ADAM FOODS')
      GROUP BY client_name, account, desc1
      ORDER BY client_name, total_amount DESC
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    const byClient = {};
    rows2.forEach(r => {
      if (!byClient[r.client_name]) byClient[r.client_name] = [];
      byClient[r.client_name].push(r);
    });
    
    for (const [client, entries] of Object.entries(byClient)) {
      console.log(`${client}:`);
      const total = entries.reduce((s, e) => s + (e.total_amount || 0), 0);
      entries.forEach(e => {
        const amt = (e.total_amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
        console.log(`  Acct ${e.account} | €${amt.padStart(10)} | ${e.description}`);
      });
      console.log(`  → TOTAL: €${total.toLocaleString('es-ES', {maximumFractionDigits: 0})}\n`);
    }
    
    // 3. Compare with P&L - what revenue is in P&L for these clients?
    console.log('\n=== P&L REVENUES (for comparison) ===\n');
    const query3 = `
      SELECT
        pnl_l2,
        SUM(balance_eur) AS total
      FROM \`propellingtech-datalake.03_gold_finance.vw-gld-fin-f_pnl_consolidated\`
      WHERE year = 2026
        AND scenario = 'actual'
        AND account_name LIKE '%FERRER%'
      GROUP BY pnl_l2
      ORDER BY total DESC
    `;
    
    const [rows3] = await bq.query({ query: query3 });
    console.log('FERRER in P&L:');
    rows3.forEach(r => {
      console.log(`  ${r.pnl_l2.padEnd(30)} €${(r.total || 0).toLocaleString('es-ES', {maximumFractionDigits: 0})}`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
