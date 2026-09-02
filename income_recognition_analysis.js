const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('✅ INCOME RECOGNITION BY CLIENT - Final Analysis\n');
    
    // Extract client from desc1 [CLIENT] format and aggregate
    const query = `
      WITH client_extract AS (
        SELECT 
          REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') AS client_name,
          SUBSTR(desc1, 1, 70) AS full_desc,
          date,
          COALESCE(credit, debit, 0) AS amount
        FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
        WHERE EXTRACT(YEAR FROM date) = 2026
      )
      SELECT 
        client_name,
        COUNT(DISTINCT SUBSTR(full_desc, 1, 50)) AS num_projects,
        COUNT(*) AS num_entries,
        SUM(amount) AS total_recognized,
        MIN(date) AS first_date,
        MAX(date) AS last_date
      FROM client_extract
      WHERE client_name IS NOT NULL
      GROUP BY client_name
      ORDER BY total_recognized DESC
    `;
    
    const [rows] = await bq.query({ query: query });
    
    console.log('Income Recognition by Client (2026):\n');
    console.log('Client'.padEnd(25) + ' | Revenue | Projects | Entries | Date Range');
    console.log('-'.repeat(110));
    
    let totalRevenue = 0;
    rows.forEach(r => {
      const rev = (r.total_recognized || 0).toLocaleString('es-ES', {maximumFractionDigits: 0}).padStart(11);
      const dateFirst = r.first_date ? new Date(r.first_date.value).toISOString().split('T')[0] : '?';
      const dateLast = r.last_date ? new Date(r.last_date.value).toISOString().split('T')[0] : '?';
      console.log(
        (r.client_name || 'Unknown').padEnd(25) + 
        ` | €${rev} | ${r.num_projects.toString().padStart(8)} | ${r.num_entries.toString().padStart(7)} | ${dateFirst} to ${dateLast}`
      );
      totalRevenue += r.total_recognized || 0;
    });
    
    console.log('\n' + '='.repeat(110));
    console.log(`TOTAL: €${totalRevenue.toLocaleString('es-ES', {maximumFractionDigits: 0}).padStart(11)}\n`);
    
    // Top projects
    console.log('\n📊 TOP PROJECTS by Recognition\n');
    const query2 = `
      SELECT 
        SUBSTR(desc1, 1, 70) AS project_name,
        COUNT(*) AS entries,
        SUM(COALESCE(credit, debit, 0)) AS total
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE EXTRACT(YEAR FROM date) = 2026
      AND desc1 LIKE '[%'
      GROUP BY desc1
      ORDER BY total DESC
      LIMIT 20
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    rows2.forEach((r, i) => {
      const amt = (r.total || 0).toLocaleString('es-ES', {maximumFractionDigits: 0}).padStart(12);
      console.log(`  ${(i+1).toString().padStart(2)}. €${amt} | ${r.project_name}`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
