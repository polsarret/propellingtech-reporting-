const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 Invoice Table Structure - Sample Record\n');
    
    const query = `
      SELECT * 
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices\`
      WHERE docnumber IN ('F260096', 'F260106')
      LIMIT 1
    `;
    
    const [rows] = await bq.query({ query });
    
    if (rows.length > 0) {
      const r = rows[0];
      console.log('Fields in invoices table:');
      Object.keys(r).forEach(k => {
        console.log(`  ${k}: ${r[k]}`);
      });
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
