const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 GL Entry Types for FERRER July\n');
    
    // Check GL entry types
    const query = `
      SELECT
        type,
        COUNT(*) AS num_entries,
        SUM(COALESCE(credit, debit, 0)) AS total_amount,
        STRING_AGG(DISTINCT SUBSTR(desc1, 1, 50), ' | ') AS descriptions
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE EXTRACT(YEAR FROM date) = 2026
        AND EXTRACT(MONTH FROM date) = 7
        AND account IN (70500002, 70500003, 70500004)
        AND REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') = 'FERRER'
      GROUP BY type
      ORDER BY total_amount DESC
    `;
    
    const [rows] = await bq.query({ query });
    
    console.log('Entry Types in GL:');
    rows.forEach(r => {
      const amt = (r.total_amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`\n  Type: "${r.type}" (${r.num_entries} entries)`);
      console.log(`  Total: €${amt}`);
      console.log(`  Sample descriptions: ${r.descriptions}`);
    });
    
    // Now check if we connect with invoices - do invoices match GL?
    console.log('\n\n🔍 Invoices for FERRER in July\n');
    const query2 = `
      SELECT
        i.docnumber,
        i.date,
        p.name AS project_name,
        SUM(i.netsales) AS total_invoice
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\` i
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON i.project_id = p.project_id
      WHERE p.client_name = 'FERRER'
        AND EXTRACT(YEAR FROM i.date) = 2026
        AND EXTRACT(MONTH FROM i.date) = 7
      GROUP BY i.docnumber, i.date, p.name
      ORDER BY i.date
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    
    console.log('Invoices issued in July:');
    let total_inv = 0;
    rows2.forEach(r => {
      const amt = (r.total_invoice || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${r.date?.value} | ${r.docnumber} | €${amt.padStart(10)} | ${r.project_name?.substring(0, 30)}`);
      total_inv += r.total_invoice || 0;
    });
    console.log(`\nTotal Invoices July: €${total_inv.toLocaleString('es-ES', {maximumFractionDigits: 0})}`);
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
