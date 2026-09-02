const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('📊 REVENUE ANALYTICS STRUCTURE - Deep Analysis\n');
    
    // 1. Revenue breakdown by project type
    console.log('\n=== PROJECT TYPES ===\n');
    const query1 = `
      SELECT 
        p.type AS project_type,
        COUNT(DISTINCT p.project_id) AS num_projects,
        SUM(i.netsales) AS total_revenue,
        AVG(i.netsales) AS avg_invoice_value
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\` i
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON i.project_id = p.project_id
      WHERE EXTRACT(YEAR FROM i.date) = 2026
      GROUP BY p.type
      ORDER BY total_revenue DESC
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    console.log('Revenue by Project Type:');
    rows1.forEach(r => {
      const rev = (r.total_revenue || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${(r.project_type || 'null').padEnd(15)} €${rev.padStart(12)} (${r.num_projects} projects)`);
    });
    
    // 2. Data by product name (services/categories)
    console.log('\n\n=== SERVICES (Product Names) ===\n');
    const query2 = `
      SELECT 
        SUBSTR(product_name, 1, 50) AS service_type,
        COUNT(DISTINCT invoice_id) AS num_invoices,
        SUM(netsales) AS total_revenue,
        COUNT(DISTINCT client_id) AS num_clients
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\`
      WHERE EXTRACT(YEAR FROM date) = 2026
      AND netsales > 0
      GROUP BY product_name
      ORDER BY total_revenue DESC
      LIMIT 12
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    console.log('Top Services by Revenue:');
    rows2.forEach(r => {
      const rev = (r.total_revenue || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${(r.service_type || 'unknown').padEnd(50)} €${rev.padStart(12)}`);
    });
    
    // 3. Check if there's a way to connect projects to technologies
    console.log('\n\n=== DATA STRUCTURE CONNECTIVITY ===\n');
    const query3 = `
      SELECT 
        'projects' AS table_name,
        COUNT(DISTINCT project_id) AS count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\`
      UNION ALL
      SELECT 
        'invoices' AS table_name,
        COUNT(DISTINCT invoice_id) AS count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\`
      UNION ALL
      SELECT 
        'clients' AS table_name,
        COUNT(DISTINCT client_id) AS count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-clients\`
      UNION ALL
      SELECT 
        'propellers' AS table_name,
        COUNT(*) AS count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-propeller_categories\`
    `;
    
    const [rows3] = await bq.query({ query: query3 });
    console.log('Available Records:');
    rows3.forEach(r => {
      console.log(`  ${r.table_name.padEnd(20)} ${r.count} records`);
    });

  } catch (e) {
    console.error('Error:', e.message);
  }
})();
