const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 Investigating: How to connect GL "Consulting" with Clients\n');
    
    // First, see all the GL accounts that could be "Consulting"
    console.log('📊 All GL Accounts (first 50)\n');
    const query0 = `
      SELECT DISTINCT 
        account,
        SUBSTR(desc1, 1, 60) AS description,
        COUNT(*) AS count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE EXTRACT(YEAR FROM date) = 2026
      GROUP BY account, desc1
      ORDER BY count DESC
      LIMIT 50
    `;
    
    const [rows0] = await bq.query({ query: query0 });
    console.log('GL Accounts and Descriptions:');
    rows0.slice(0, 20).forEach(r => {
      console.log(`  ${r.account.toString().padEnd(8)} | ${r.description.padEnd(60)} (${r.count} entries)`);
    });
    
    // Check if desc2 always has invoice reference
    console.log('\n\n📊 GL Entry Types and desc2 patterns\n');
    const query1 = `
      SELECT 
        CASE 
          WHEN desc2 LIKE 'F%' THEN 'Invoice Ref'
          WHEN desc2 LIKE '%-%' THEN 'Project/Other'
          ELSE 'Other'
        END AS desc2_type,
        COUNT(*) AS count,
        COUNT(DISTINCT CASE WHEN desc2 LIKE 'F%' THEN desc2 END) AS invoice_count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE EXTRACT(YEAR FROM date) = 2026
      GROUP BY desc2_type
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    console.log('GL desc2 patterns (how to link to source):');
    rows1.forEach(r => {
      console.log(`  ${r.desc2_type.padEnd(20)} ${r.count} entries (${r.invoice_count} invoice refs)`);
    });
    
    // Try to link GL to projects through project name in desc1
    console.log('\n\n📊 GL entries with project names in desc1\n');
    const query2 = `
      SELECT DISTINCT
        SUBSTR(gl.desc1, 1, 70) AS desc1,
        COUNT(*) AS count,
        SUM(COALESCE(gl.credit, gl.debit, 0)) AS total
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\` gl
      WHERE EXTRACT(YEAR FROM gl.date) = 2026
      AND gl.desc1 LIKE '[%' -- Looks like "[CLIENT] Project name" format
      GROUP BY gl.desc1
      ORDER BY total DESC
      LIMIT 15
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    console.log('GL with project names [like this]:');
    rows2.forEach(r => {
      const amt = (r.total || 0).toLocaleString('es-ES', {maximumFractionDigits: 0}).padStart(12);
      console.log(`  €${amt} | ${r.desc1}`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
