const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 Identifying GL Accounts for "Consulting"\n');
    
    // Get accounts that feed into "Consulting" in the P&L
    const query = `
      SELECT DISTINCT
        account,
        account_name,
        pnl_l2,
        SUM(balance_eur) AS total
      FROM \`propellingtech-datalake.03_gold_finance.vw-gld-fin-f_pnl_consolidated\`
      WHERE year = 2026
        AND scenario = 'actual'
        AND pnl_l1 = 'Revenues'
      GROUP BY account, account_name, pnl_l2
      ORDER BY pnl_l2, total DESC
    `;
    
    const [rows] = await bq.query({ query });
    
    const bySubcat = {};
    rows.forEach(r => {
      if (!bySubcat[r.pnl_l2]) bySubcat[r.pnl_l2] = [];
      bySubcat[r.pnl_l2].push(r);
    });
    
    for (const [subcat, accounts] of Object.entries(bySubcat)) {
      console.log(`\n📊 ${subcat}:`);
      accounts.forEach(a => {
        const total = (a.total || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
        console.log(`  Account ${a.account.toString().padEnd(8)} | ${a.account_name.padEnd(40)} | €${total.padStart(10)}`);
      });
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
