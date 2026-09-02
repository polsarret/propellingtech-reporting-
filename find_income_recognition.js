const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    // 1. Inspect General Ledger structure
    console.log('📊 GENERAL LEDGER Structure\n');
    const table = bq.dataset('02_silver_holded').table('tbl-slv-fin-general_ledger');
    const [metadata] = await table.getMetadata();
    
    console.log(`Columns (${metadata.schema?.fields?.length || 0}):`);
    if (metadata.schema?.fields) {
      for (const field of metadata.schema.fields) {
        console.log(`  ${field.name.padEnd(35)} ${field.type}`);
      }
    }
    
    // 2. Sample GL entries for Consulting revenue
    console.log('\n\n📊 Sample GL Entries (Consulting Revenue)\n');
    const query1 = `
      SELECT 
        gl.date,
        gl.account,
        gl.account_name,
        gl.amount,
        gl.month,
        gl.year,
        gl.market,
        gl.type,
        gl.reference,
        SUBSTR(gl.account_name, 1, 60) AS account_desc
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\` gl
      WHERE gl.account_name LIKE '%onsulting%' OR gl.account_name LIKE '%ervice%'
      AND gl.year = 2026
      LIMIT 20
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    console.log('GL entries with Consulting/Services:');
    rows1.slice(0, 8).forEach((r, i) => {
      console.log(`  ${i+1}. ${r.account_desc.padEnd(50)} €${(r.amount || 0).toLocaleString('es-ES', {maximumFractionDigits: 0}).padStart(10)}`);
    });
    
    // 3. Check what accounts exist for revenue
    console.log('\n\n📊 Revenue Accounts in Chart of Accounts\n');
    const query2 = `
      SELECT DISTINCT 
        account,
        account_name,
        COUNT(*) AS num_entries,
        SUM(amount) AS total
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE year = 2026
      AND account_name LIKE '%onsulting%' OR account_name LIKE '%ervice%' OR account_name LIKE '%oftware%' OR account_name LIKE '%icens%'
      GROUP BY account, account_name
      ORDER BY total DESC
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    console.log('Consulting/Revenue Accounts:');
    rows2.forEach(r => {
      const total = (r.total || 0).toLocaleString('es-ES', {maximumFractionDigits: 0});
      console.log(`  ${r.account.toString().padEnd(8)} ${r.account_name.padEnd(45)} €${total.padStart(12)} (${r.num_entries} entries)`);
    });
    
    // 4. Check if there's a field linking to customer/project
    console.log('\n\n📊 GL Entry Types (to find revenue recognition)\n');
    const query3 = `
      SELECT DISTINCT 
        type,
        COUNT(*) AS count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE year = 2026
      GROUP BY type
      ORDER BY count DESC
    `;
    
    const [rows3] = await bq.query({ query: query3 });
    console.log('GL Entry Types:');
    rows3.forEach(r => {
      console.log(`  ${r.type.padEnd(30)} ${r.count} entries`);
    });
    
    // 5. Check reference field - might contain customer/project info
    console.log('\n\n📊 Sample References in GL (might contain customer/project)\n');
    const query4 = `
      SELECT DISTINCT 
        SUBSTR(reference, 1, 80) AS ref,
        COUNT(*) AS count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE year = 2026
      AND reference IS NOT NULL
      AND reference != ''
      GROUP BY reference
      ORDER BY count DESC
      LIMIT 15
    `;
    
    const [rows4] = await bq.query({ query: query4 });
    console.log('References (potential customer/project links):');
    rows4.forEach(r => {
      console.log(`  "${r.ref}"`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
