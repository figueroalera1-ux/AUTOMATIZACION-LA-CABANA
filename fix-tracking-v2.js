/**
 * fix-tracking-v2.js
 * Reemplaza el nodo append (tiene bug de offset de columnas) con:
 *   GET filas actuales → Code calcula nextRow → PUT a fila exacta
 * Así el control de la posición es absoluto y no depende de append.
 */
const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const SHEET = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';
const WF_ID = 'RttrTKbdo8cL3kR5';

function api(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : '';
    const req = http.request({
      hostname: 'localhost', port: 5678, path, method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let o = ''; res.on('data', c => o += c); res.on('end', () => resolve({ s: res.statusCode, b: o })); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/* ── Nodo 1: Code — prepara datos del click ──────────────────── */
const CODE_PREPARAR = `
const q = $input.first().json.query || {};
const r = (q.r || 'otro').toLowerCase();
const c = q.c || 'organico';

const now = new Date();
const fecha = now.toLocaleDateString('es-MX', {timeZone:'America/Mexico_City'});
const hora  = now.toLocaleTimeString('es-MX', {timeZone:'America/Mexico_City', hour:'2-digit', minute:'2-digit'});

const redNames = {
  facebook:'Facebook', instagram:'Instagram', tiktok:'TikTok',
  whatsapp:'WhatsApp', google:'Google Ads', youtube:'YouTube',
  twitter:'Twitter/X', x:'Twitter/X'
};
const redNombre = redNames[r] || r;
const clickId = 'CLK-' + Date.now();

const destino = 'https://lacabanaeventos.com/cotizador.html'
  + '?utm_source='   + encodeURIComponent(r)
  + '&utm_campaign=' + encodeURIComponent(c)
  + '&utm_medium=social';

const html = '<!DOCTYPE html><html><head><title>La Cabaña Eventos</title>'
  + '<meta charset=utf-8>'
  + '<style>body{margin:0;background:#6B1223;color:white;display:flex;'
  + 'align-items:center;justify-content:center;min-height:100vh;'
  + 'font-family:sans-serif;flex-direction:column}'
  + 'p{font-size:18px}</style></head><body>'
  + '<p>✨ Preparando tu cotización...</p>'
  + '<script>window.location.replace("' + destino + '")<\\/script>'
  + '</body></html>';

return [{json:{ html, clickId, redNombre, campana: c, fecha, hora, destino }}];
`;

/* ── Nodo 3: Code — calcula la fila exacta y arma el body PUT ─── */
const CODE_FILA = `
// El GET anterior devuelve {values: [...rows...]} o {} si no hay datos
const values = $('Contar Filas Click').first().json.values || [];
const nextRow = values.length + 1; // +1 porque el array ya incluye el header

const clickId   = $('Preparar Datos Click').first().json.clickId;
const redNombre = $('Preparar Datos Click').first().json.redNombre;
const fecha     = $('Preparar Datos Click').first().json.fecha;
const hora      = $('Preparar Datos Click').first().json.hora;
const campana   = $('Preparar Datos Click').first().json.campana;
const destino   = $('Preparar Datos Click').first().json.destino;

// Body para PUT a fila exacta: values[0] = la única fila a escribir
const putBody = JSON.stringify({ values: [[
  clickId, '', '', '', '', '', '', redNombre, 'click', fecha, hora, campana, '', destino
]] });

// Rango exacto: A{nextRow}:N{nextRow}
const range = 'Click!A' + nextRow + ':N' + nextRow;

return [{json:{ putBody, range, nextRow }}];
`;

const CREDS = { googleSheetsOAuth2Api: { id: 'google-sheets-cred', name: 'Google Sheets account' } };

const workflow = {
  name: 'Flujo - Tracking Redes Sociales',
  nodes: [
    {
      id: 'webhook-ir',
      name: 'Webhook — Link de Red Social',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 300],
      parameters: {
        path: 'ir', httpMethod: 'GET',
        responseMode: 'responseNode', options: {}
      }
    },
    {
      id: 'code-track',
      name: 'Preparar Datos Click',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [460, 300],
      parameters: { jsCode: CODE_PREPARAR }
    },
    {
      id: 'http-get-rows',
      name: 'Contar Filas Click',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [680, 300],
      continueOnFail: true,
      credentials: CREDS,
      parameters: {
        method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/Click!A:A`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        options: {}
      }
    },
    {
      id: 'code-fila',
      name: 'Calcular Fila',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [900, 300],
      parameters: { jsCode: CODE_FILA }
    },
    {
      id: 'http-put-click',
      name: 'Guardar Click en Sheets',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1120, 300],
      continueOnFail: true,
      credentials: CREDS,
      parameters: {
        method: 'PUT',
        url: `={{ 'https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/' + encodeURIComponent($json.range) + '?valueInputOption=USER_ENTERED' }}`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: '={{ $json.putBody }}',
        options: {}
      }
    },
    {
      id: 'respond-ir',
      name: 'Redirigir al Cotizador',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1340, 300],
      parameters: {
        respondWith: 'text',
        responseBody: "={{ $('Preparar Datos Click').first().json.html }}",
        options: {
          responseCode: 200,
          responseHeaders: {
            entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }]
          }
        }
      }
    }
  ],
  connections: {
    'Webhook — Link de Red Social': { main: [[{ node: 'Preparar Datos Click', type: 'main', index: 0 }]] },
    'Preparar Datos Click':         { main: [[{ node: 'Contar Filas Click',    type: 'main', index: 0 }]] },
    'Contar Filas Click':           { main: [[{ node: 'Calcular Fila',         type: 'main', index: 0 }]] },
    'Calcular Fila':                { main: [[{ node: 'Guardar Click en Sheets', type: 'main', index: 0 }]] },
    'Guardar Click en Sheets':      { main: [[{ node: 'Redirigir al Cotizador', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1', saveManualExecutions: true },
  staticData: null
};

async function main() {
  await api('POST', `/api/v1/workflows/${WF_ID}/deactivate`, null);
  console.log('Desactivado...');

  const r = await api('PUT', `/api/v1/workflows/${WF_ID}`, {
    name: workflow.name, nodes: workflow.nodes,
    connections: workflow.connections, settings: workflow.settings, staticData: null
  });
  console.log('PUT status:', r.s);
  if (r.s !== 200) { console.error('Error:', r.b.slice(0, 400)); return; }

  const act = await api('POST', `/api/v1/workflows/${WF_ID}/activate`, null);
  console.log('Activo:', JSON.parse(act.b).active);

  // Test local
  console.log('\nTest local...');
  const t = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 5678,
      path: '/webhook/ir?r=instagram&c=test-put', method: 'GET'
    }, res => { let o = ''; res.on('data', c => o += c); res.on('end', () => resolve({ s: res.statusCode, ok: o.includes('Preparando') })); });
    req.on('error', reject); req.end();
  });
  console.log('Status:', t.s, '| HTML:', t.ok ? '✅' : '❌');
}

main().catch(console.error);
