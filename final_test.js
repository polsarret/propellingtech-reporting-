const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

(async () => {
  try {
    console.log('✅ Testing Fixed Queries\n');
    
    // Test 1: Clients
    console.log('TEST 1: getIncomeRecognitionByClient');
    const query1 = `
      WITH agenda_agg AS (
        SELECT
          EXTRACT(MONTH FROM a.date) AS month,
          COALESCE(p.client_name, 'INTERNAL') AS client_name,
          SUM(CASE WHEN a.category = 'ID' THEN a.days ELSE 0 END) AS id_days,
          SUM(CASE WHEN a.category = 'NID' THEN a.days ELSE 0 END) AS nid_days
        FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-agenda\` a
        LEFT JOIN \`propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects\` p ON a.project_id = p.project_id
        WHERE EXTRACT(YEAR FROM a.date) = 2026
          AND a.category IN ('ID', 'NID')
        GROUP BY month, client_name
      ),
      gl_agg AS (
        SELECT
          EXTRACT(MONTH FROM date) AS month,
          REGEXP_EXTRACT(desc1, r'\\[([^\\]]+)\\]') AS client_name,
          SUM(COALESCE(credit, debit, 0)) AS ir_amount
        FROM \`propellingtech-datalake.02_silver_holded.tbl-slv-fin-general_ledger\`
        WHERE EXTRACT(YEAR FROM date) = 2026
        GROUP BY month, client_name
      )
      SELECT
        COALESCE(aa.client_name, ga.client_name, 'OTHER') AS client_name,
        COALESCE(aa.month, ga.month) AS month,
        ROUND(COALESCE(aa.id_days, 0), 2) AS id,
        ROUND(COALESCE(aa.nid_days, 0), 2) AS nid,
        ROUND(COALESCE(ga.ir_amount, 0), 2) AS ir
      FROM agenda_agg aa
      FULL OUTER JOIN gl_agg ga
        ON aa.client_name = ga.client_name AND aa.month = ga.month
      ORDER BY client_name, month
      LIMIT 10
    `;
    
    const [rows1] = await bq.query({ query: query1, location: 'EU' });
    console.log(`✅ Success! ${rows1.length} rows returned`);
    rows1.slice(0, 3).forEach(r => {
      console.log(`   ${r.client_name.padEnd(20)} | M${r.month} | ID: ${r.id}, NID: ${r.nid}, IR: €${r.ir}`);
    });
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
})();
