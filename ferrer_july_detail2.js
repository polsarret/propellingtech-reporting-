const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 FERRER - July Detailed Investigation\n');
    
    // Agenda for FERRER in July - aggregated
    console.log('=== FERRER AGENDA - JULY ===\n');
    const query1 = `
      SELECT
        p.name AS project_name,
        a.category,
        SUM(a.days) AS total_days
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON a.project_id = p.project_id
      WHERE p.client_name = 'FERRER'
        AND EXTRACT(YEAR FROM a.date) = 2026
        AND EXTRACT(MONTH FROM a.date) = 7
      GROUP BY p.name, a.category
      ORDER BY p.name, a.category
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    let total_id = 0, total_nid = 0;
    console.log('By Project:');
    rows1.forEach(r => {
      console.log(`  ${r.project_name?.substring(0, 40).padEnd(40)} | ${r.category.padEnd(6)} | ${r.total_days?.toLocaleString('es-ES', {maximumFractionDigits: 1}).padStart(8)} days`);
      if (r.category === 'ID') total_id += r.total_days || 0;
      if (r.category === 'NID') total_nid += r.total_days || 0;
    });
    console.log(`\nTOTAL: ID=${total_id} + NID=${total_nid}`);
    
    // GL entries for FERRER in July - by project
    console.log('\n\n=== FERRER GL - JULY (Consulting) ===\n');
    const query2 = `
      SELECT
        SUBSTR(desc1, STRPOS(desc1, '] ') + 2) AS project_name,
        account,
        SUM(COALESCE(credit, debit, 0)) AS total_amount
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE EXTRACT(YEAR FROM date) = 2026
        AND EXTRACT(MONTH FROM date) = 7
        AND account IN (70500002, 70500003, 70500004)
        AND REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') = 'FERRER'
      GROUP BY project_name, account
      ORDER BY total_amount DESC
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    let total_ir = 0;
    console.log('By Project:');
    rows2.forEach(r => {
      const amt = (r.total_amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${r.project_name?.substring(0, 40).padEnd(40)} | Acct ${r.account} | €${amt.padStart(10)}`);
      total_ir += r.total_amount || 0;
    });
    console.log(`\nTOTAL IR: €${total_ir.toLocaleString('es-ES', {maximumFractionDigits: 0})}`);
    
    console.log(`\n\n📊 SUMMARY:\nID: ${total_id} days | IR: €${total_ir.toLocaleString('es-ES', {maximumFractionDigits: 0})} | Rate: €${(total_ir / total_id).toLocaleString('es-ES', {maximumFractionDigits: 0})}/día`);
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
