const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 Invoice Check: Who are the real clients?\n');
    
    const query = `
      SELECT
        i.docnumber,
        i.date,
        c.client_name AS real_client,
        p.name AS project_name,
        p.client_name AS project_client,
        SUM(i.netsales) AS invoice_amount
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\` i
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-clients\` c ON i.client_id = c.client_id
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON i.project_id = p.project_id
      WHERE EXTRACT(YEAR FROM i.date) = 2026
        AND EXTRACT(MONTH FROM i.date) = 7
        AND (i.docnumber IN ('F260096', 'F260106') OR p.client_name = 'FERRER')
      GROUP BY i.docnumber, i.date, c.client_name, p.name, p.client_name
      ORDER BY i.date
    `;
    
    const [rows] = await bq.query({ query });
    
    console.log('Invoices July (including F260096, F260106):\n');
    rows.forEach(r => {
      const amt = (r.invoice_amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`${r.docnumber} | ${r.date?.value} | Real Client: ${(r.real_client || '?').padEnd(20)} | Project: ${r.project_name?.substring(0, 30).padEnd(30)} | €${amt.padStart(10)}`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
