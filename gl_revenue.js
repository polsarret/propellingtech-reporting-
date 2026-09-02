const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('📊 Consulting Revenue in GL\n');
    const query1 = `
      SELECT 
        account,
        SUBSTR(desc1, 1, 50) AS description,
        COUNT(*) AS num_entries,
        SUM(COALESCE(credit, debit, 0)) AS total_amount,
        MIN(date) AS first_date,
        MAX(date) AS last_date
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE desc1 LIKE '%onsult%'
      GROUP BY account, desc1
      ORDER BY total_amount DESC
      LIMIT 20
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    console.log('Consulting Revenue Accounts:');
    rows1.forEach(r => {
      const amt = (r.total_amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  Acct ${r.account.toString().padEnd(6)} €${amt.padStart(12)} | ${r.description}`);
    });
    
    console.log('\n\n📊 Check desc2 field (might have customer/project)\n');
    const query2 = `
      SELECT 
        account,
        desc1,
        SUBSTR(desc2, 1, 60) AS desc2_sample,
        COUNT(*) AS count,
        SUM(COALESCE(credit, debit, 0)) AS total
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE desc1 LIKE '%onsult%'
      GROUP BY account, desc1, desc2
      ORDER BY total DESC
      LIMIT 15
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    console.log('Consulting GL entries with desc2 (customer/project?)');
    rows2.forEach(r => {
      const amt = (r.total || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${r.desc2_sample.padEnd(60)} €${amt.padStart(12)}`);
    });
    
    console.log('\n\n📊 Total by month (2026 Consulting)\n');
    const query3 = `
      SELECT 
        EXTRACT(MONTH FROM date) AS month,
        SUM(COALESCE(credit, debit, 0)) AS total
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE desc1 LIKE '%onsult%'
      AND EXTRACT(YEAR FROM date) = 2026
      GROUP BY month
      ORDER BY month
    `;
    
    const [rows3] = await bq.query({ query: query3 });
    console.log('Monthly Consulting Revenue (2026):');
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    rows3.forEach(r => {
      const amt = (r.total || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${months[r.month].padEnd(6)} €${amt.padStart(12)}`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
