const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('🧪 Testing IR Report Queries\n');
    
    // Test 1: Get clients data
    console.log('Test 1: Income Recognition by Client');
    const query1 = `
      WITH agenda_data AS (
        SELECT
          EXTRACT(MONTH FROM a.date) AS month,
          p.client_name,
          a.propeller_id,
          a.project_id,
          a.category,
          a.days
        FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
        LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON a.project_id = p.project_id
        WHERE EXTRACT(YEAR FROM a.date) = 2026
          AND a.category IN ('ID', 'NID')
      ),
      gl_data AS (
        SELECT
          EXTRACT(MONTH FROM date) AS month,
          REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') AS client_name,
          SUM(COALESCE(credit, debit, 0)) AS amount
        FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
        WHERE EXTRACT(YEAR FROM date) = 2026
        GROUP BY month, client_name
      ),
      monthly_agg AS (
        SELECT
          COALESCE(ag.client_name, 'INTERNAL') AS client_name,
          COALESCE(ag.month, gl.month) AS month,
          SUM(CASE WHEN ag.category = 'ID' THEN ag.days ELSE 0 END) AS id_days,
          SUM(CASE WHEN ag.category = 'NID' THEN ag.days ELSE 0 END) AS nid_days,
          COALESCE(gl.amount, 0) AS ir_amount
        FROM agenda_data ag
        FULL OUTER JOIN gl_data gl
          ON ag.client_name = gl.client_name AND ag.month = gl.month
        GROUP BY client_name, month
      )
      SELECT
        client_name,
        month,
        ROUND(CAST(id_days AS FLOAT64), 2) AS id,
        ROUND(CAST(nid_days AS FLOAT64), 2) AS nid,
        ROUND(CAST(ir_amount AS FLOAT64), 2) AS ir
      FROM monthly_agg
      ORDER BY client_name, month
      LIMIT 5
    `;
    
    const [rows1] = await bq.query({ query: query1, location: 'EU' });
    console.log(`✅ Query executed. Results: ${rows1.length} rows`);
    rows1.slice(0, 3).forEach(r => {
      console.log(`   ${r.client_name.padEnd(20)} | Month: ${r.month} | ID: ${r.id}, NID: ${r.nid}, IR: €${r.ir}`);
    });
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    if (e.errors) {
      console.error('Details:', e.errors);
    }
  }
})();
