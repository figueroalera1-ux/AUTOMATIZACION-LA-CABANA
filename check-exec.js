const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/studi/.n8n/database.sqlite');

const exec = db.prepare(`
  SELECT id, status, startedAt, stoppedAt
  FROM execution_entity
  WHERE workflowId = 'flujo6-guardar-seleccion'
  ORDER BY startedAt DESC LIMIT 1
`).get();

console.log('Exec:', exec.id, '| Status:', exec.status, '| Duration:', ((new Date(exec.stoppedAt) - new Date(exec.startedAt))/1000).toFixed(1) + 's');

// Get the workflowData from execution_data to see the actual nodes that ran
const data = db.prepare("SELECT workflowData FROM execution_data WHERE executionId = ?").get(exec.id);
if (data && data.workflowData) {
  try {
    const wf = JSON.parse(data.workflowData);
    console.log('Workflow name:', wf.name);
  } catch(e) {}
}

// Check execution_entity for more details
const entity = db.prepare("SELECT status, finished FROM execution_entity WHERE id = ?").get(exec.id);
console.log('finished:', entity.finished, '| status:', entity.status);

db.close();
