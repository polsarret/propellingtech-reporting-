const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 DEEP INVESTIGATION: Timesheets & Work Hours Structure\n');
    
    // 1. Inspect timesheet tables
    console.log('=== AVAILABLE TIMESHEET TABLES ===\n');
    
    const tables = [
      'propellingtech-datalake.02_silver_holded.tbl-slv-ops-work_hours',
      'propellingtech-datalake.01_bronze_holded.tbl-brz-ops-employees_time_tracking_v2',
      'propellingtech-datalake.02_silver_holded.tbl-slv-ops-pulses',
      'propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda',
    ];
    
    for (const tableId of tables) {
      try {
        const [dataset, table] = tableId.split('.').slice(1);
        const t = bq.dataset(dataset).table(table);
        const [metadata] = await t.getMetadata();
        
        console.log(`\n✅ ${table}`);
        console.log(`   Rows: ~${(metadata.numRows / 1000).toFixed(0)}k`);
        console.log(`   Columns (${metadata.schema?.fields?.length}):`);
        
        if (metadata.schema?.fields) {
          for (const field of metadata.schema.fields) {
            const type = field.type.toLowerCase().substring(0, 12);
            console.log(`      ${field.name.padEnd(40)} ${type}`);
          }
        }
      } catch (e) {
        console.log(`\n❌ ${table} - Not found`);
      }
    }
    
    // 2. Sample data from work_hours
    console.log('\n\n=== SAMPLE: work_hours table (first 10 records) ===\n');
    const query1 = `
      SELECT * 
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-work_hours\`
      LIMIT 10
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    if (rows1.length > 0) {
      console.log(JSON.stringify(rows1[0], null, 2));
    }
    
    // 3. Check what dimensions are available
    console.log('\n\n=== WORK_HOURS: Available Dimensions ===\n');
    const query2 = `
      SELECT 
        COUNT(DISTINCT person_id) AS num_people,
        COUNT(DISTINCT project_id) AS num_projects,
        COUNT(DISTINCT CASE WHEN billable = 1 THEN work_date ELSE NULL END) AS billable_days,
        COUNT(DISTINCT CASE WHEN billable = 0 THEN work_date ELSE NULL END) AS non_billable_days,
        SUM(CASE WHEN billable = 1 THEN 1 ELSE 0 END) AS billable_entries,
        SUM(CASE WHEN billable = 0 THEN 1 ELSE 0 END) AS non_billable_entries,
        MIN(work_date) AS first_date,
        MAX(work_date) AS last_date
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-work_hours\`
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    console.log('Work Hours Summary:');
    console.log(JSON.stringify(rows2[0], null, 2));
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
