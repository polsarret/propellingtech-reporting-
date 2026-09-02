const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 DETAILED: FERRER GL Data Analysis\n');
    
    // 1. ALL GL entries for FERRER in July (no filters)
    console.log('=== ALL GL entries FERRER July (NO FILTERS) ===\n');
    const query1 = `
      SELECT
        date,
        account,
        type,
        SUBSTR(desc1, 1, 60) AS description,
        COALESCE(credit, debit, 0) AS amount
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE EXTRACT(YEAR FROM date) = 2026
        AND EXTRACT(MONTH FROM date) = 7
        AND REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') = 'FERRER'
      ORDER BY date, amount DESC
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    console.log(`Total entries: ${rows1.length}\n`);
    let grandTotal = 0;
    rows1.forEach(r => {
      const amt = (r.amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${r.date?.value} | Acct ${r.account} | Type: ${r.type.padEnd(10)} | €${amt.padStart(10)}`);
      grandTotal += r.amount || 0;
    });
    console.log(`\nGRAND TOTAL (all): €${grandTotal.toLocaleString('es-ES', {maximumFractionDigits: 0})}`);
    
    // 2. By account
    console.log('\n\n=== BY ACCOUNT ===\n');
    const query2 = `
      SELECT
        account,
        type,
        COUNT(*) AS entries,
        SUM(COALESCE(credit, debit, 0)) AS total
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE EXTRACT(YEAR FROM date) = 2026
        AND EXTRACT(MONTH FROM date) = 7
        AND REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') = 'FERRER'
      GROUP BY account, type
      ORDER BY total DESC
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    rows2.forEach(r => {
      const amt = (r.total || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  Acct ${r.account} | Type ${r.type.padEnd(10)} | ${r.entries} entries | €${amt.padStart(10)}`);
    });
    
    // 3. Only Consulting accounts + invoice type (what we're filtering)
    console.log('\n\n=== OUR FILTER: Consulting Accounts + Type=invoice ===\n');
    const query3 = `
      SELECT
        date,
        account,
        SUBSTR(desc1, 1, 50) AS proj_desc,
        COALESCE(credit, debit, 0) AS amount
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE EXTRACT(YEAR FROM date) = 2026
        AND EXTRACT(MONTH FROM date) = 7
        AND account IN (70500002, 70500003, 70500004)
        AND type = 'invoice'
        AND REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') = 'FERRER'
      ORDER BY date, amount DESC
    `;
    
    const [rows3] = await bq.query({ query: query3 });
    console.log(`Entries with our filter: ${rows3.length}\n`);
    let total3 = 0;
    rows3.forEach(r => {
      const amt = (r.amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${r.date?.value} | Acct ${r.account} | €${amt.padStart(10)}`);
      total3 += r.amount || 0;
    });
    console.log(`\nOUR RESULT: €${total3.toLocaleString('es-ES', {maximumFractionDigits: 0})}`);
    console.log(`EXPECTED: €31,500`);
    console.log(`DIFFERENCE: €${(total3 - 31500).toLocaleString('es-ES', {maximumFractionDigits: 0})}`);
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
