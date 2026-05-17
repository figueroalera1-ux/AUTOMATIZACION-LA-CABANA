const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const WF_ID = 'pyon28AYRbqy7hai';

// Debug code: returns first 3 rows from Sheets + token received
const DEBUG_CODE = `
const token = ($('Webhook — Consulta cliente').first().json.query && $('Webhook — Consulta cliente').first().json.query.token)
  ? $('Webhook — Consulta cliente').first().json.query.token
  : '';

const rows = $('Sheets — Leer selecciones').all();
const debug = {
  token_received: token,
  rows_count: rows.length,
  first_row_keys: rows.length > 0 ? Object.keys(rows[0].json) : [],
  first_3_tokens: rows.slice(0, 3).map(r => r.json.token),
  status_values: rows.slice(0, 5).map(r => r.json.status)
};
return [{ json: { ok: false, debug } }];
`;

function apiRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 5678, path, method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data || '') }
    };
    const req = http.request(opts, res => {
      let out = ''; res.on('data', c => out += c); res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    if (data) req.write(data); req.end();
  });
}

async function run() {
  // Get current workflow
  const g = await apiRequest('GET', `/api/v1/workflows/${WF_ID}`, '');
  const wf = JSON.parse(g.body);

  // Update code node
  const nodes = wf.nodes.map(n => {
    if (n.name === 'Buscar token en Sheets') {
      return { ...n, parameters: { ...n.parameters, jsCode: DEBUG_CODE } };
    }
    return n;
  });

  // Deactivate, update, reactivate
  await apiRequest('POST', `/api/v1/workflows/${WF_ID}/deactivate`, '');

  const updatePayload = JSON.stringify({ name: wf.name, nodes, connections: wf.connections, settings: wf.settings });
  const u = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, updatePayload);
  console.log('Update:', u.status);

  await apiRequest('POST', `/api/v1/workflows/${WF_ID}/activate`, '');

  console.log('Testing...');
  await new Promise(r => setTimeout(r, 1000));

  const http2 = require('http');
  const testReq = new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 5678,
      path: '/webhook/lacabana-cliente?token=LC-1778709796755-H9W8OA',
      method: 'GET'
    };
    const req = http2.request(opts, res => {
      let out = ''; res.on('data', c => out += c); res.on('end', () => resolve(out));
    });
    req.on('error', reject); req.end();
  });

  const result = await testReq;
  console.log('Debug result:', result);
}

run().catch(console.error);
