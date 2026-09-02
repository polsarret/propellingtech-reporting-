const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT = 'propellingtech-datalake';
const bq = new BigQuery({ projectId: PROJECT });

(async () => {
  try {
    console.log('🔍 Listing all datasets...\n');
    const [datasets] = await bq.getDatasets();
    
    for (const ds of datasets) {
      const dataset = bq.dataset(ds.id);
      const [tables] = await dataset.getTables();
      
      console.log(`\n📊 Dataset: ${ds.id}`);
      console.log(`   Tables (${tables.length}):`);
      
      // Show all tables
      for (const t of tables) {
        const mark = (t.id.includes('customer') || t.id.includes('client') || 
                     t.id.includes('invoice') || t.id.includes('project') ||
                     t.id.includes('service') || t.id.includes('technology')) ? '⭐' : '  ';
        console.log(`   ${mark} ${t.id}`);
      }
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
