const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/studi/.n8n/database.sqlite');

const wf = db.prepare("SELECT nodes FROM workflow_entity WHERE id = 'flujo6-guardar-seleccion'").get();
const nodes = JSON.parse(wf.nodes);

for (const node of nodes) {
  if (node.name === 'Responder — Éxito') {
    const body = node.parameters.responseBody;
    console.log('ResponseBody length:', body.length);
    console.log('First 300 chars:', body.substring(0, 300));
    console.log('...');
    console.log('Last 100 chars:', body.substring(body.length - 100));

    // Check for problematic escape sequences
    if (body.includes("\\'")) console.log('CONTAINS: \\\' (escaped single quote)');
    if (body.includes('$(\'')) console.log('CONTAINS: $(\'...\') - correct syntax');
    if (body.includes("$(\\")) console.log('CONTAINS: $(\\ - wrong syntax');
  }
}
db.close();
