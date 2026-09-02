const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('📊 INCOME RECOGNITION: GL + Invoices + Clients\n');
    
    const query = `
      SELECT 
        i.docnumber,
        c.client_name,
        p.name AS project_name,
        SUM(i.netsales) AS invoice_amount,
        SUM(COALESCE(gl.credit, gl.debit, 0)) AS gl_recognized,
        COUNT(DISTINCT gl.id_account) AS gl_entries,
        EXTRACT(MONTH FROM i.date) AS inv_month,
        EXTRACT(MONTH FROM gl.date) AS gl_month
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\` i
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\` gl 
        ON i.docnumber = gl.desc2
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-clients\` c 
        ON i.client_id = c.client_id
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p 
        ON i.project_id = p.project_id
      WHERE gl.desc1 LIKE '%onsult%' OR i.product_name LIKE '%onsult%'
      GROUP BY i.docnumber, c.client_name, p.name, EXTRACT(MONTH FROM i.date), EXTRACT(MONTH FROM gl.date)
      ORDER BY invoice_amount DESC
      LIMIT 20
    `;
    
    const [rows] = await bq.query({ query: query });
    
    console.log('Invoice → GL Recognition (Consulting):');
    console.log('');
    console.log('Invoice # | Client                    | Project             | Invoice Amount | GL Recognized | Match?');
    console.log('-'.repeat(120));
    
    rows.forEach(r => {
      const inv = (r.invoice_amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0}).padStart(10);
      const gl = (r.gl_recognized || 0).toLocaleString('es-ES', {maximumFractionDigits: 0}).padStart(10);
      const match = r.gl_recognized ? '✓' : '✗';
      const client = (r.client_name || '(no client)').substring(0, 25).padEnd(25);
      const project = (r.project_name || '').substring(0, 20).padEnd(20);
      console.log(`${r.docnumber.padEnd(9)} | ${client} | ${project} | €${inv} | €${gl} | ${match}`);
    });
    
    console.log('\n\n📊 SUMMARY: Revenue Recognition Status\n');
    
    const query2 = `
      SELECT 
        COUNT(DISTINCT i.invoice_id) AS total_invoices,
        COUNT(DISTINCT CASE WHEN gl.id_account IS NOT NULL THEN i.invoice_id END) AS recognized_invoices,
        SUM(i.netsales) AS total_invoice_amount,
        SUM(COALESCE(gl.credit, gl.debit, 0)) AS total_gl_recognized
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\` i
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\` gl 
        ON i.docnumber = gl.desc2
      WHERE (gl.desc1 LIKE '%onsult%' OR i.product_name LIKE '%onsult%')
    `;
    
    const [summary] = await bq.query({ query: query2 });
    const s = summary[0];
    
    console.log(`Total Invoices: ${s.total_invoices}`);
    console.log(`Recognized in GL: ${s.recognized_invoices} (${((s.recognized_invoices/s.total_invoices)*100).toFixed(1)}%)`);
    console.log(`Total Invoice Amount: €${(s.total_invoice_amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0})}`);
    console.log(`Total GL Recognized: €${(s.total_gl_recognized || 0).toLocaleString('es-ES', {maximumFractionDigits: 0})}`);
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
