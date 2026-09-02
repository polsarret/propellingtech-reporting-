const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 Debugging UNKNOWN clients issue\n');
    
    // 1. Check invoice client_ids
    console.log('=== INVOICES: Sample client_ids ===\n');
    const query1 = `
      SELECT DISTINCT
        i.client_id,
        COUNT(*) AS num_invoices,
        MIN(i.docnumber) AS first_invoice
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\` i
      WHERE EXTRACT(YEAR FROM i.date) = 2026
      GROUP BY i.client_id
      ORDER BY num_invoices DESC
      LIMIT 10
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    console.log('Invoice client_ids:');
    rows1.forEach(r => {
      console.log(`  client_id: ${r.client_id} (${r.num_invoices} invoices) - First: ${r.first_invoice}`);
    });
    
    // 2. Check master-clients
    console.log('\n\n=== MASTER-CLIENTS: All records ===\n');
    const query2 = `
      SELECT DISTINCT
        client_id,
        client_name,
        client_code
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-clients\`
      ORDER BY client_name
      LIMIT 20
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    console.log('Master clients:');
    rows2.forEach(r => {
      console.log(`  client_id: ${r.client_id} → ${r.client_name}`);
    });
    
    // 3. Try the join
    console.log('\n\n=== INVOICES + MASTER-CLIENTS JOIN ===\n');
    const query3 = `
      SELECT
        i.client_id AS invoice_client_id,
        c.client_id AS master_client_id,
        c.client_name,
        COUNT(*) AS count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\` i
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-clients\` c ON i.client_id = c.client_id
      WHERE EXTRACT(YEAR FROM i.date) = 2026
      GROUP BY i.client_id, c.client_id, c.client_name
      ORDER BY count DESC
      LIMIT 20
    `;
    
    const [rows3] = await bq.query({ query: query3 });
    console.log('Join results:');
    rows3.forEach(r => {
      const status = r.master_client_id ? '✓ FOUND' : '✗ NULL (no match)';
      console.log(`  ${r.invoice_client_id} → ${r.client_name || '(null)'} [${status}] (${r.count} invoices)`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
