const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/studi/.n8n/database.sqlite');

// Ver todos los flujos y su estado actual
const todos = db.prepare("SELECT id, name, active FROM workflow_entity").all();
console.log('\n=== TODOS LOS FLUJOS ===');
todos.forEach(r => console.log(`[${r.active ? 'ACTIVO' : 'INACTIVO'}] ${r.id} | ${r.name}`));

// Activar los 3 flujos por nombre
const nombres = [
  'La Cabaña — Flujo 5: API Cliente (JSON)',
  'La Cabaña — Flujo 5b: Listar Clientes',
  'La Cabaña — Flujo 6: Guardar Selección de Menú'
];

console.log('\n=== ACTIVANDO FLUJOS ===');
for (const nombre of nombres) {
  const wf = db.prepare("SELECT id, name, active, versionId FROM workflow_entity WHERE name = ?").get(nombre);
  if (!wf) {
    console.log(`NO ENCONTRADO: ${nombre}`);
    continue;
  }
  const r = db.prepare("UPDATE workflow_entity SET active = 1, activeVersionId = versionId WHERE id = ?").run(wf.id);
  console.log(`${r.changes > 0 ? 'OK' : 'SIN CAMBIO'} | ${wf.name}`);
}

// Verificar resultado
console.log('\n=== RESULTADO FINAL ===');
const resultado = db.prepare("SELECT id, name, active FROM workflow_entity WHERE name IN (?, ?, ?)").all(...nombres);
resultado.forEach(r => console.log(`[${r.active ? 'ACTIVO' : 'INACTIVO'}] ${r.name}`));

db.close();
console.log('\nListo. Reinicia n8n para que registre los webhooks.');
