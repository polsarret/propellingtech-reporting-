const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 Investigating USA data in Agenda & related tables\n');
    
    // 1. Check agenda table structure - is there a market/country field?
    console.log('1️⃣ Agenda Table Fields:');
    const table = bq.dataset('02_silver_holded').table('tbl-slv-ops-agenda');
    const [metadata] = await table.getMetadata();
    console.log('Fields:', metadata.schema?.fields?.map(f => f.name).join(', '));
    
    // 2. Check if propellers have market info
    console.log('\n2️⃣ Propellers Table - has market/location?');
    const table2 = bq.dataset('02_silver_holded').table('tbl-slv-ops-master-propellers_scd');
    const [metadata2] = await table2.getMetadata();
    console.log('Fields:', metadata2.schema?.fields?.map(f => f.name).join(', '));
    
    // 3. Check if projects have market
    console.log('\n3️⃣ Projects Table - has market/country?');
    const query0 = `
      SELECT * EXCEPT(created_at, modified_at)
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\`
      LIMIT 1
    `;
    const [row0] = await bq.query({ query: query0 });
    if (row0.length > 0) {
      console.log('Field names:', Object.keys(row0[0]));
    }
    
    // 4. Check propeller distribution - is there any location indicator?
    console.log('\n4️⃣ Sample Propellers (check for location/market):');
    const query1 = `
      SELECT *
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-propellers_scd\`
      LIMIT 5
    `;
    const [rows1] = await bq.query({ query: query1 });
    if (rows1.length > 0) {
      console.log(JSON.stringify(rows1[0], null, 2).substring(0, 500));
    }
    
    // 5. Check GL - does it have market info?
    console.log('\n5️⃣ GL Has Market Field:');
    const query2 = `
      SELECT DISTINCT market
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
      WHERE market IS NOT NULL
    `;
    const [rows2] = await bq.query({ query: query2 });
    console.log('Markets in GL:', rows2.map(r => r.market).join(', '));
    
    // 6. Check agenda - are all records ES or could be US?
    console.log('\n6️⃣ Agenda - Sample Records (check for any USA indicator):');
    const query3 = `
      SELECT 
        a.propeller_id,
        a.project_id,
        a.date,
        p.name AS project_name,
        p.client_name,
        COUNT(*) as count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON a.project_id = p.project_id
      WHERE EXTRACT(YEAR FROM a.date) = 2026
      GROUP BY propeller_id, project_id, date, project_name, client_name
      LIMIT 10
    `;
    const [rows3] = await bq.query({ query: query3 });
    rows3.forEach(r => {
      console.log(`  ${r.project_name?.substring(0, 40).padEnd(40)} | ${r.client_name}`);
    });
    
    // 7. Check if there's a separate USA timesheets table
    console.log('\n7️⃣ Looking for USA-specific tables:');
    const [datasets] = await bq.getDatasets();
    for (const ds of datasets) {
      if (ds.id.includes('holded') || ds.id.includes('usa')) {
        const dataset = bq.dataset(ds.id);
        const [tables] = await dataset.getTables();
        const usa_related = tables.filter(t => t.id.toLowerCase().includes('usa') || t.id.toLowerCase().includes('us'));
        if (usa_related.length > 0) {
          console.log(`  ${ds.id}:`);
          usa_related.forEach(t => console.log(`    - ${t.id}`));
        }
      }
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
