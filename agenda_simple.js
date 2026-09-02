const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🔍 AGENDA TABLE - Simple Analysis\n');
    
    // 1. Sample agenda records
    console.log('=== SAMPLE: Agenda Records ===\n');
    const query1 = `
      SELECT 
        propeller_id,
        project_id,
        date,
        category,
        days,
        approved_flag
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\`
      LIMIT 15
    `;
    
    const [rows1] = await bq.query({ query: query1 });
    console.log('Sample agenda entries:');
    rows1.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i+1}. Propeller: ${r.propeller_id.substring(0, 8)} | Project: ${r.project_id.substring(0, 8)} | Date: ${r.date.value} | Category: ${(r.category || 'null').padEnd(15)} | Days: ${r.days}`);
    });
    
    // 2. Categories
    console.log('\n\n=== AGENDA: Category Distribution ===\n');
    const query2 = `
      SELECT DISTINCT 
        category,
        COUNT(*) AS count,
        SUM(days) AS total_days,
        AVG(days) AS avg_days
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\`
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY total_days DESC
    `;
    
    const [rows2] = await bq.query({ query: query2 });
    console.log('Categories:');
    rows2.forEach(r => {
      const days = (r.total_days || 0).toLocaleString('es-ES', {maximumFractionDigits: 1});
      console.log(`  "${r.category}" - ${days.padStart(8)} days (${r.count} entries, avg ${(r.avg_days || 0).toFixed(2)} days/entry)`);
    });
    
    // 3. Billable projects
    console.log('\n\n=== PROJECTS: Billable Status ===\n');
    const query3 = `
      SELECT 
        billable_flag,
        COUNT(*) AS num_projects
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\`
      GROUP BY billable_flag
      ORDER BY billable_flag DESC
    `;
    
    const [rows3] = await bq.query({ query: query3 });
    console.log('Projects by billable_flag:');
    rows3.forEach(r => {
      const status = r.billable_flag === 1 ? '✓ BILLABLE' : r.billable_flag === 0 ? '✗ NON-BILLABLE' : '? NULL/UNKNOWN';
      console.log(`  ${status.padEnd(18)} ${r.num_projects} projects`);
    });
    
    // 4. Key: Agenda joined with Projects
    console.log('\n\n=== KEY INSIGHT: Agenda + Billable Projects ===\n');
    const query4 = `
      SELECT 
        CASE 
          WHEN p.billable_flag = 1 THEN 'ID (Invoicing Days)'
          WHEN p.billable_flag = 0 THEN 'NID (Non-Invoicing Days)'
          ELSE 'UNKNOWN'
        END AS status,
        COUNT(DISTINCT a.propeller_id) AS num_propellers,
        COUNT(DISTINCT a.project_id) AS num_projects,
        COUNT(DISTINCT CONCAT(a.propeller_id, a.date)) AS person_date_combinations,
        SUM(a.days) AS total_days,
        AVG(a.days) AS avg_days_per_entry
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON a.project_id = p.project_id
      GROUP BY p.billable_flag
      ORDER BY total_days DESC
    `;
    
    const [rows4] = await bq.query({ query: query4 });
    console.log('Days Distribution:');
    rows4.forEach(r => {
      const days = (r.total_days || 0).toLocaleString('es-ES', {maximumFractionDigits: 1});
      console.log(`  ${r.status.padEnd(28)} ${days.padStart(10)} days`);
      console.log(`      → ${r.num_propellers} people across ${r.num_projects} projects`);
    });
    
    // 5. CLIENT → PROJECT → DAYS hierarchy
    console.log('\n\n=== HIERARCHY: Client → Project → Days (billable vs non) ===\n');
    const query5 = `
      SELECT 
        COALESCE(p.client_name, 'INTERNAL') AS client_name,
        CASE WHEN p.billable_flag = 1 THEN 'BILLABLE' ELSE 'NON-BILLABLE' END AS project_type,
        COUNT(DISTINCT a.propeller_id) AS people,
        SUM(a.days) AS total_days,
        COUNT(DISTINCT a.project_id) AS projects
      FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
      LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON a.project_id = p.project_id
      GROUP BY client_name, project_type
      ORDER BY total_days DESC
    `;
    
    const [rows5] = await bq.query({ query: query5 });
    console.log('');
    rows5.forEach(r => {
      const days = (r.total_days || 0).toLocaleString('es-ES', {maximumFractionDigits: 1});
      console.log(`  ${(r.client_name || '?').padEnd(20)} | ${r.project_type.padEnd(15)} | ${days.padStart(10)} days (${r.people} people, ${r.projects} projects)`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
