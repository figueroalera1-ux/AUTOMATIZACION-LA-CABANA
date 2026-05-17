const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:\\Users\\studi\\.n8n\\database.sqlite');

// Set activeVersionId = versionId for flujo5 and flujo6 so n8n can activate them
const result = db.prepare(`
  UPDATE workflow_entity
  SET active = 1, activeVersionId = versionId
  WHERE id IN ('flujo5-formulario-cliente','flujo6-guardar-seleccion')
`).run();
console.log('Rows updated:', result.changes);

const after = db.prepare(`
  SELECT id, name, active, versionId, activeVersionId
  FROM workflow_entity
  WHERE id IN ('flujo5-formulario-cliente','flujo6-guardar-seleccion')
`).all();
after.forEach(r => console.log(`active=${r.active} | versionId=${r.versionId} | activeVersionId=${r.activeVersionId} | ${r.name}`));

db.close();
