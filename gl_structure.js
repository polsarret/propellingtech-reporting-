const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('📊 GL Entries - Revenue Accounts\n');
    const query1 = `
      SELECT 
        account,
        desc1,
        desc2,
        type,
        date,
        credit,
        debit,
        market
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE year = 2026
      AND (desc1 LIKE '%onsulting%' OR desc1 LIKE '%ervice%' OR desc2 LIKE '%onsulting%')
      LIMIT 20
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    console.log('Sample GL Revenue Entries:');
    rows1.slice(0, 10).forEach((r, i) => {
      const amount = (r.credit || r.debit || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${i+1}. Acct: ${r.account} | ${r.desc1.substring(0, 40).padEnd(40)} | €${amount.padStart(10)} | ${r.type}`);
    });
    
    console.log('\n\n📊 Distinct Descriptions in GL (Revenue-related)\n');
    const query2 = `
      SELECT DISTINCT 
        desc1,
        COUNT(*) AS count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE year = 2026
      AND (desc1 LIKE '%onsult%' OR desc1 LIKE '%ervice%' OR desc1 LIKE '%icens%' OR desc1 LIKE '%oftware%')
      GROUP BY desc1
      ORDER BY count DESC
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    console.log('Description 1 (might have customer/project):');
    rows2.forEach(r => {
      console.log(`  "${r.desc1}" (${r.count} entries)`);
    });
    
    console.log('\n\n📊 GL Entry Types\n');
    const query3 = `
      SELECT DISTINCT 
        type,
        COUNT(*) AS count,
        SUM(COALESCE(credit, debit, 0)) AS total_amount
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE year = 2026
      GROUP BY type
      ORDER BY total_amount DESC
    `;
    
    const [rows3] = await bq.query({ query: query3 });
    console.log('GL Entry Types & Amounts:');
    rows3.forEach(r => {
      const amt = (r.total_amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${r.type.padEnd(20)} €${amt.padStart(12)} (${r.count} entries)`);
    });
    
    console.log('\n\n📊 Total Revenue by Account (Consulting line)\n');
    const query4 = `
      SELECT 
        account,
        desc1,
        SUM(COALESCE(credit, debit, 0)) AS total_amount,
        COUNT(*) AS num_entries
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE year = 2026
      AND desc1 LIKE '%onsult%'
      GROUP BY account, desc1
      ORDER BY total_amount DESC
    `;
    
    const [rows4] = await bq.query({ query: query4 });
    console.log('Consulting Revenue Accounts:');
    rows4.forEach(r => {
      const amt = (r.total_amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  Acct ${r.account.toString().padEnd(8)} ${r.desc1.padEnd(40)} €${amt.padStart(12)}`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
