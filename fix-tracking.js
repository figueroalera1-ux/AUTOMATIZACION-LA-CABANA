/**
 * fix-tracking.js
 * Corrige el nodo Sheets del flujo de tracking:
 * reemplaza $json.clickRow (array — falla) por campos individuales (funciona)
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

/* ── Code node: construye JSON completo, evita evaluar arrays en expresiones ── */
const CODE = `
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

// JSON completo pre-construido — evita problema con arrays en expresiones n8n
const sheetsBody = JSON.stringify({ values: [[
  clickId, '', '', '', '', '', '', redNombre, 'click', fecha, hora, c, '', destino
]] });

return [{json:{ html, sheetsBody }}];
`;

/* ── Body es una referencia simple a un string, no una expresión con array ── */
const SHEETS_BODY = `={{ $json.sheetsBody }}`;

async function main() {
  // Leer flujo actual
  const r = await api('GET', `/api/v1/workflows/${WF_ID}`, null);
  const wf = JSON.parse(r.b);

  // Actualizar nodo Code y nodo Sheets
  const nodes = wf.nodes.map(n => {
    if (n.name === 'Preparar Datos Click') {
      return { ...n, parameters: { jsCode: CODE } };
    }
    if (n.name === 'Guardar Click en Sheets') {
      return { ...n, parameters: { ...n.parameters, body: SHEETS_BODY } };
    }
    return n;
  });

  await api('POST', `/api/v1/workflows/${WF_ID}/deactivate`, null);
  console.log('Desactivado...');

  const upd = await api('PUT', `/api/v1/workflows/${WF_ID}`, {
    name: wf.name, nodes, connections: wf.connections,
    settings: wf.settings, staticData: null
  });
  console.log('PUT status:', upd.s);
  if (upd.s !== 200) { console.error('Error:', upd.b.slice(0, 400)); return; }

  const act = await api('POST', `/api/v1/workflows/${WF_ID}/activate`, null);
  console.log('Activo:', JSON.parse(act.b).active);

  // Probar localmente
  console.log('\nProbando webhook local...');
  const test = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 5678,
      path: '/webhook/ir?r=instagram&c=bio-test',
      method: 'GET'
    }, res => { let o = ''; res.on('data', c => o += c); res.on('end', () => resolve({ s: res.statusCode, b: o })); });
    req.on('error', reject); req.end();
  });
  console.log('Status:', test.s, '| HTML:', test.b.includes('Preparando') ? '✅' : '❌');
}

main().catch(console.error);
