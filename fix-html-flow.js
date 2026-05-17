const fs = require('fs');
const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const WF_ID = 'HcA44ffoPqFcxF2P';
const HTML_PATH = 'C:/Users/studi/Desktop/la-cabana/Rediseño Web/seleccion-menu.html';

const html = fs.readFileSync(HTML_PATH, 'utf8');
console.log('HTML leido:', html.length, 'chars');

// Build updated workflow: Webhook → RespondToWebhook (HTML embedded, no Code node)
const workflow = {
  name: 'La Cabana - Flujo Seleccion HTML v2',
  nodes: [
    {
      parameters: {
        httpMethod: 'GET',
        path: 'seleccion',
        responseMode: 'responseNode',
        options: {}
      },
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 300]
    },
    {
      parameters: {
        respondWith: 'text',
        responseBody: html,
        options: {
          responseHeaders: {
            entries: [
              { name: 'Content-Type', value: 'text/html; charset=utf-8' }
            ]
          }
        }
      },
      name: 'Responder HTML',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [460, 300]
    }
  ],
  connections: {
    Webhook: {
      main: [[{ node: 'Responder HTML', type: 'main', index: 0 }]]
    }
  },
  settings: { executionOrder: 'v1' }
};

const body = JSON.stringify(workflow);

function apiRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 5678,
      path,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data || '')
      }
    };
    const req = http.request(opts, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // Deactivate first
  console.log('Deactivating...');
  const d = await apiRequest('POST', `/api/v1/workflows/${WF_ID}/deactivate`, '');
  console.log('Deactivate status:', d.status);

  // Update workflow with embedded HTML
  console.log('Updating workflow...');
  const u = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, body);
  console.log('Update status:', u.status);
  if (u.status !== 200) {
    console.error('Update failed:', u.body.slice(0, 500));
    return;
  }

  // Reactivate
  console.log('Activating...');
  const a = await apiRequest('POST', `/api/v1/workflows/${WF_ID}/activate`, '');
  console.log('Activate status:', a.status);
  const result = JSON.parse(a.body);
  console.log('Active:', result.active);
  console.log('\nListo. Prueba: https://n8n.lacabanaeventos.com/webhook/seleccion?token=TEST-ANGEL-001');
}

run().catch(console.error);
