const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 AGENDA TABLE - The Key to ID/NID\n');
    
    // 1. Sample agenda records
    console.log('=== SAMPLE: Agenda Records (Person → Project → Days) ===\n');
    const query1 = `
      SELECT 
        a.propeller_id,
        a.project_id,
        a.date,
        a.category,
        a.days,
        a.approved_flag,
        p.name AS project_name,
        pp.job_title,
        pp.category AS propeller_category
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON a.project_id = p.project_id
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-propellers_scd\` pp ON a.propeller_id = pp.propeller_id
      LIMIT 20
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    console.log('Sample records:');
    rows1.slice(0, 5).forEach(r => {
      console.log(`  ${r.propeller_id.substring(0, 8)} | ${(r.project_name || 'N/A').substring(0, 40).padEnd(40)} | ${r.category.padEnd(20)} | ${r.days} days`);
    });
    
    // 2. Categories in agenda
    console.log('\n\n=== AGENDA: Categories (might define ID vs NID) ===\n');
    const query2 = `
      SELECT DISTINCT 
        category,
        COUNT(*) AS count,
        SUM(days) AS total_days
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\`
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY total_days DESC
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    console.log('Agenda Categories:');
    rows2.forEach(r => {
      const days = (r.total_days || 0).toLocaleString('es-ES', {maximumFractionDigits: 1});
      console.log(`  ${r.category.padEnd(30)} ${days.padStart(10)} days (${r.count} entries)`);
    });
    
    // 3. Check if billable_flag or similar exists
    console.log('\n\n=== PROJECTS: Billable Flag ===\n');
    const query3 = `
      SELECT 
        billable_flag,
        COUNT(*) AS num_projects,
        SUM(CAST(billable_flag AS INT64)) AS billable_count
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\`
      GROUP BY billable_flag
    `;
    
    const [rows3] = await bq.query({ query: query3 });
    console.log('Projects by Billable Flag:');
    rows3.forEach(r => {
      console.log(`  billable_flag = ${r.billable_flag}: ${r.num_projects} projects`);
    });
    
    // 4. Agenda joined with billable projects
    console.log('\n\n=== ID vs NID: Agenda + Billable Flag ===\n');
    const query4 = `
      SELECT 
        p.billable_flag,
        a.category,
        COUNT(DISTINCT a.propeller_id) AS num_people,
        COUNT(DISTINCT a.date) AS num_dates,
        SUM(a.days) AS total_days
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON a.project_id = p.project_id
      GROUP BY p.billable_flag, a.category
      ORDER BY p.billable_flag DESC, total_days DESC
    `;
    
    const [rows4] = await bq.query({ query: query4 });
    console.log('Days by Billable Status + Category:');
    rows4.forEach(r => {
      const billable = r.billable_flag === 1 ? '✓ BILLABLE' : r.billable_flag === 0 ? '✗ NON-BILLABLE' : '? UNKNOWN';
      const days = (r.total_days || 0).toLocaleString('es-ES', {maximumFractionDigits: 1});
      console.log(`  ${billable.padEnd(16)} | ${(r.category || 'null').padEnd(20)} | ${days.padStart(10)} days`);
    });
    
    // 5. Sample: Customer → Projects → Days
    console.log('\n\n=== HIERARCHY: Customer → Projects → Days ===\n');
    const query5 = `
      WITH client_projects AS (
        SELECT DISTINCT
          p.client_name,
          p.project_id,
          p.name AS project_name,
          p.billable_flag
        FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p
        WHERE p.client_name IS NOT NULL
      )
      SELECT 
        cp.client_name,
        cp.project_name,
        cp.billable_flag,
        SUM(a.days) AS total_days,
        COUNT(DISTINCT a.propeller_id) AS num_people,
        COUNT(DISTINCT a.date) AS num_dates
      FROM client_projects cp
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a ON cp.project_id = a.project_id
      WHERE cp.client_name IN ('ISDIN', 'FERRER', 'UNILEVER', 'NEOM')
      GROUP BY cp.client_name, cp.project_name, cp.billable_flag
      ORDER BY cp.client_name, total_days DESC
    `;
    
    const [rows5] = await bq.query({ query: query5 });
    console.log('Sample: Top 4 Clients → Their Projects → Days:');
    rows5.forEach(r => {
      const billable = r.billable_flag === 1 ? '✓' : '✗';
      const days = (r.total_days || 0).toLocaleString('es-ES', {maximumFractionDigits: 1});
      console.log(`  ${(r.client_name || '?').padEnd(15)} ${billable} | ${(r.project_name || '').substring(0, 40).padEnd(40)} | ${days.padStart(10)} days (${r.num_people} people)`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
