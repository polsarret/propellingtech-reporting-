const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT, location: 'EU' });

const tablesToInspect = [
  'propellingtech-datalake.02_silver_holded.tbl-slv-ops-invoices',
  'propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-clients',
  'propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-projects',
  'propellingtech-datalake.02_silver_holded.tbl-slv-ops-master-propeller_categories',
  'propellingtech-datalake.01_bronze_holded.tbl-brz-ops-documents_invoices_v2',
];

(async () => {
  try {
    for (const tableId of tablesToInspect) {
      try {
        const table = bq.dataset(tableId.split('.')[1]).table(tableId.split('.')[2]);
        const [metadata] = await table.getMetadata();
        
        console.log(`\n📊 ${tableId.split('.')[2]}`);
        console.log(`   Rows: ~${(metadata.numRows / 1000).toFixed(0)}k`);
        console.log(`   Columns (${metadata.schema?.fields?.length || 0}):`);
        
        if (metadata.schema?.fields) {
          for (const field of metadata.schema.fields) {
            const type = field.type.toLowerCase().substring(0, 10);
            console.log(`      ${field.name.padEnd(35)} ${type}`);
          }
        }
      } catch (e) {
        console.log(`\n❌ ${tableId.split('.')[2]} - Not found or error`);
      }
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
