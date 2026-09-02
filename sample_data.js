const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('📊 Sample: Invoices with Client & Project\n');
    const query1 = `
      SELECT 
        i.invoice_id, 
        i.docnumber,
        c.client_name,
        p.name AS project_name,
        p.type AS project_type,
        i.product_name,
        i.netsales,
        i.date
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\` i
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-clients\` c ON i.client_id = c.client_id
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON i.project_id = p.project_id
      LIMIT 10
    `;
    
    console.log('Query 1: Sample invoices');
    const [rows1] = await bq.query({ query: query1 });
    console.log(JSON.stringify(rows1.slice(0, 3), null, 2));
    
    console.log('\n\n📊 Distinct Project Types\n');
    const query2 = `
      SELECT DISTINCT type 
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\`
      WHERE type IS NOT NULL
      ORDER BY type
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    console.log(rows2.map(r => `  - ${r.type}`).join('\n'));
    
    console.log('\n\n📊 Revenue Summary by Client (2026)\n');
    const query3 = `
      SELECT 
        c.client_name,
        COUNT(DISTINCT i.invoice_id) AS num_invoices,
        SUM(i.netsales) AS total_revenue,
        COUNT(DISTINCT i.project_id) AS num_projects,
        MIN(i.date) AS first_invoice,
        MAX(i.date) AS last_invoice
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\` i
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-clients\` c ON i.client_id = c.client_id
      WHERE EXTRACT(YEAR FROM i.date) = 2026
      GROUP BY c.client_name
      ORDER BY total_revenue DESC
      LIMIT 15
    `;
    
    const [rows3] = await bq.query({ query: query3 });
    console.log('Top 15 Clients by Revenue:');
    rows3.forEach((r, i) => {
      console.log(`  ${(i+1).toString().padStart(2)}. ${r.client_name.padEnd(40)} €${(r.total_revenue || 0).toLocaleString('es-ES', {maximumFractionDigits: 0}).padStart(12)} (${r.num_invoices} invoices)`);
    });
    
    console.log('\n\n📊 Propeller Categories\n');
    const query4 = `
      SELECT DISTINCT category, COUNT(*) AS count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-propeller_categories\`
      GROUP BY category
      ORDER BY count DESC
    `;
    
    const [rows4] = await bq.query({ query: query4 });
    console.log('Categories/Technologies:');
    rows4.forEach(r => {
      console.log(`  - ${r.category} (${r.count})`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
