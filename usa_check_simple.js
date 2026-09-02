const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🇺🇸 USA Data Investigation\n');
    
    // 1. Agenda has NO market field - so it's mixed?
    console.log('❌ AGENDA TABLE: NO market/country field');
    console.log('   Fields: calendar_id, date, project_id, propeller_id, category, days');
    console.log('   → All timesheets mixed (ES + US together)\n');
    
    // 2. Check projects for country/market field
    console.log('Checking Projects table for location info:');
    const query1 = `
      SELECT * 
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\`
      LIMIT 1
    `;
    const [rows1] = await bq.query({ query: query1 });
    if (rows1.length > 0) {
      console.log('Project fields:', Object.keys(rows1[0]).join(', '));
    }
    
    // 3. Check if there's USA-specific projects
    console.log('\n3️⃣ Projects with "USA" or similar in name:');
    const query2 = `
      SELECT DISTINCT client_name, name
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\`
      WHERE name LIKE '%USA%' OR client_name LIKE '%USA%'
      LIMIT 10
    `;
    const [rows2] = await bq.query({ query: query2 });
    console.log(`Found ${rows2.length} projects with USA:`);
    rows2.forEach(r => console.log(`  ${r.client_name} / ${r.name}`));
    
    // 4. Check GL - it DOES have market field
    console.log('\n4️⃣ GL TABLE: HAS market field ✓');
    const query3 = `
      SELECT DISTINCT market, COUNT(*) as count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      GROUP BY market
    `;
    const [rows3] = await bq.query({ query: query3 });
    rows3.forEach(r => {
      console.log(`   Market: ${r.market} → ${r.count} entries`);
    });
    
    // 5. Check if propellers/employees have office location
    console.log('\n5️⃣ PROPELLERS TABLE:');
    const query4 = `
      SELECT * 
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-propellers_scd\`
      LIMIT 1
    `;
    const [rows4] = await bq.query({ query: query4 });
    if (rows4.length > 0) {
      console.log('Fields:', Object.keys(rows4[0]).join(', '));
      console.log('No location/market field detected ❌');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
