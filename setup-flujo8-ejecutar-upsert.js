/**
 * setup-flujo8-ejecutar-upsert.js — La Cabaña Eventos
 *
 * Recrea Flujo 8 como:
 *   Schedule (cada hora) → Execute Command (node actualizar-crm-upsert.js)
 *
 * Esto reemplaza el enfoque anterior (clear+rewrite con Code node).
 * El Execute Command node llama directamente al script Node.js que
 * tiene toda la lógica de upsert y nunca borra datos.
 *
 * Uso: node setup-flujo8-ejecutar-upsert.js
 */
const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const SCRIPT_PATH = 'C:/Users/studi/Desktop/la-cabana/actualizar-crm-upsert.js';

function api(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = typeof data === 'object' && data !== null ? JSON.stringify(data) : (data || '');
    const opts = {
      hostname: 'localhost', port: 5678, path, method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = http.request(opts, res => {
      let out = ''; res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Buscar Flujo 8 por nombre para desactivarlo antes de reemplazar
async function findWorkflowId(searchName) {
  const r = await api('GET', '/api/v1/workflows?limit=100', '');
  const list = JSON.parse(r.body);
  const wf = (list.data || []).find(w =>
    w.name.toLowerCase().includes('flujo 8') ||
    w.name.toLowerCase().includes('flujo8') ||
    w.name.toLowerCase().includes('crm') ||
    w.name.toLowerCase() === searchName.toLowerCase()
  );
  return wf ? wf.id : null;
}

async function main() {
  // Buscar y desactivar flujo anterior
  console.log('Buscando Flujo 8 existente...');
  const existingId = await findWorkflowId('flujo 8');
  if (existingId) {
    console.log('Flujo 8 encontrado, ID:', existingId, '— desactivando...');
    await api('POST', '/api/v1/workflows/' + existingId + '/deactivate', '');
    console.log('Desactivado.');
  } else {
    console.log('No se encontró Flujo 8 anterior (se creará uno nuevo).');
  }

  // Definir el workflow nuevo
  const workflow = {
    name: 'Flujo 8 — CRM Upsert (automático cada hora)',
    nodes: [
      {
        id: 'schedule-node',
        name: 'Schedule — Cada hora',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1.2,
        position: [260, 300],
        parameters: {
          rule: {
            interval: [{ field: 'hours', hoursInterval: 1 }]
          }
        }
      },
      {
        id: 'exec-node',
        name: 'Ejecutar Script CRM',
        type: 'n8n-nodes-base.executeCommand',
        typeVersion: 1,
        position: [480, 300],
        parameters: {
          command: 'node "' + SCRIPT_PATH + '"'
        }
      }
    ],
    connections: {
      'Schedule — Cada hora': {
        main: [[{ node: 'Ejecutar Script CRM', type: 'main', index: 0 }]]
      }
    },
    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
      callerPolicy: 'workflowsFromSameOwner',
      errorWorkflow: ''
    },
    staticData: null
  };

  // Crear o actualizar
  let result;
  if (existingId) {
    console.log('Actualizando Flujo 8...');
    const g = await api('GET', '/api/v1/workflows/' + existingId, '');
    const existing = JSON.parse(g.body);
    result = await api('PUT', '/api/v1/workflows/' + existingId, {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: null
    });
  } else {
    console.log('Creando Flujo 8 nuevo...');
    result = await api('POST', '/api/v1/workflows', workflow);
  }

  const wfResult = JSON.parse(result.body);
  if (result.status !== 200 && result.status !== 201) {
    console.error('Error creando/actualizando Flujo 8:', JSON.stringify(wfResult).slice(0, 400));
    return;
  }

  const wfId = wfResult.id;
  console.log('Flujo 8 guardado ✅  ID:', wfId);

  // Activar
  const act = await api('POST', '/api/v1/workflows/' + wfId + '/activate', '');
  const actResult = JSON.parse(act.body);
  console.log('Activado:', actResult.active ? '✅' : '❌', actResult.active);

  console.log('\n──────────────────────────────────────────────');
  console.log('Flujo 8 configurado correctamente.');
  console.log('Se ejecutará cada hora: node', SCRIPT_PATH);
  console.log('\nPara ejecutar manualmente ahora:');
  console.log('  node actualizar-crm-upsert.js');
}

main().catch(console.error);
