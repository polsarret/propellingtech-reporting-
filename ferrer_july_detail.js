const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 FERRER - July Detail Analysis\n');
    
    // 1. Projects for FERRER
    console.log('=== FERRER PROJECTS ===\n');
    const query1 = `
      SELECT
        project_id,
        name,
        billable_flag,
        startdate,
        enddate
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\`
      WHERE client_name = 'FERRER'
      ORDER BY name
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    rows1.forEach(r => {
      console.log(`  ${r.name.substring(0, 40).padEnd(40)} | Start: ${r.startdate?.value || '?'} | End: ${r.enddate?.value || '?'}`);
    });
    
    // 2. Agenda for FERRER in July
    console.log('\n\n=== FERRER AGENDA - JULY ===\n');
    const query2 = `
      SELECT
        a.date,
        p.name AS project_name,
        a.category,
        a.days,
        COUNT(DISTINCT a.propeller_id) AS num_people
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON a.project_id = p.project_id
      WHERE p.client_name = 'FERRER'
        AND EXTRACT(YEAR FROM a.date) = 2026
        AND EXTRACT(MONTH FROM a.date) = 7
      ORDER BY a.date, p.name
      LIMIT 30
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    console.log('Sample agenda entries:');
    rows2.slice(0, 15).forEach(r => {
      const dateStr = r.date?.value || '?';
      console.log(`  ${dateStr} | ${r.project_name?.substring(0, 30).padEnd(30)} | ${r.category.padEnd(8)} | ${r.days} days`);
    });
    
    console.log(`\n  ... (${rows2.length} total entries in July)`);
    
    // 3. GL entries for FERRER in July
    console.log('\n\n=== FERRER GL - JULY (Consulting Accounts) ===\n');
    const query3 = `
      SELECT
        date,
        account,
        SUBSTR(desc1, STRPOS(desc1, '] ') + 2) AS project_desc,
        COALESCE(credit, debit, 0) AS amount
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE EXTRACT(YEAR FROM date) = 2026
        AND EXTRACT(MONTH FROM date) = 7
        AND account IN (70500002, 70500003, 70500004)
        AND REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') = 'FERRER'
      ORDER BY date, amount DESC
      LIMIT 20
    `;
    
    const [rows3] = await bq.query({ query: query3 });
    console.log('GL entries:');
    rows3.forEach(r => {
      const dateStr = r.date?.value || '?';
      const amt = (r.amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${dateStr} | Acct ${r.account} | €${amt.padStart(8)} | ${r.project_desc?.substring(0, 30)}`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
