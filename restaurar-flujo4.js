/**
 * restaurar-flujo4.js
 * Restaura Flujo 4 usando el nodo nativo googleSheets (autoMapInputData)
 * + Telegram notification
 */
const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const SHEET    = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';
const TELEGRAM = 'https://api.telegram.org/bot8676090287:AAFv7isGLDRiXaxU6o0gOOKeCd_exd7VaO0/sendMessage';
const CHAT_ID  = '7790296286';
const ID_F4    = 'dc8RCg0pYscnKfyC';

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

/* ── Code node — genera token y prepara todos los campos ─────────── */
const CODE = `
const body = $input.first().json.body || $input.first().json;

const nombre          = body.nombre          || '';
const email           = body.email           || '';
const telefono        = body.telefono        || '';
const fecha_evento    = body.fecha_evento    || '';
const tipo_evento     = body.tipo_evento     || '';
const paquete_asignado = body.paquete_asignado || '';

const now  = Date.now();
const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
const token = 'LC-' + now + '-' + rand;
const link  = 'https://n8n.lacabanaeventos.com/webhook/seleccion?token=' + token;
const fecha_generacion = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

return [{ json: {
  token,
  link,
  nombre,
  email,
  telefono,
  fecha_evento,
  tipo_evento,
  paquete_asignado,
  status:           'pendiente',
  fecha_generacion,
  menu_elegido:     '',
  num_invitados:    '',
  cocteleria:       '',
  cerveza_barril:   '',
  dietas_especiales:'',
  notas_cliente:    '',
  fecha_seleccion:  ''
}}];`;

/* ── Telegram body ───────────────────────────────────────────────── */
const TELEGRAM_BODY = `={{ JSON.stringify({
  chat_id: '${CHAT_ID}',
  text: '🔗 *LINK GENERADO — La Cabaña*\\n\\n'
    + '👤 ' + $('Preparar datos').first().json.nombre + '\\n'
    + '📱 ' + $('Preparar datos').first().json.telefono + '\\n'
    + '🎊 ' + $('Preparar datos').first().json.tipo_evento + '\\n'
    + '📅 ' + $('Preparar datos').first().json.fecha_evento + '\\n'
    + '📦 ' + $('Preparar datos').first().json.paquete_asignado + '\\n\\n'
    + '🔗 Link para el cliente:\\n'
    + $('Preparar datos').first().json.link + '\\n\\n'
    + '_Envíaselo por WhatsApp._',
  parse_mode: 'Markdown'
}) }}`;

/* ── Workflow ─────────────────────────────────────────────────────── */
const workflow = {
  name: 'La Cabaña — Flujo 4: Generar Link',
  nodes: [
    {
      id: '9ff336f5-fb02-49bb-93a2-01c72c302ef0',
      name: 'Webhook — Generar link',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 300],
      webhookId: 'adbcf49e-61b8-4419-8ea4-bb493114c2f0',
      parameters: {
        httpMethod: 'POST',
        path: 'lacabana-generar-link',
        responseMode: 'responseNode',
        options: {}
      }
    },
    {
      id: 'bc3b5980-6c8b-4c55-9537-21efe9514af3',
      name: 'Preparar datos',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [460, 300],
      parameters: { jsCode: CODE }
    },
    {
      // HTTP Request con $json.campo individual — mismo patrón que Flujo 1 (funciona)
      id: '65c01013-9342-473c-9115-7f7875e4c83a',
      name: 'Sheets — Guardar Selección',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [680, 300],
      continueOnFail: true,
      credentials: {
        googleSheetsOAuth2Api: { id: 'google-sheets-cred', name: 'Google Sheets account' }
      },
      parameters: {
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/Selecciones:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: `={{ JSON.stringify({ values: [[ '', $('Preparar datos').first().json.token, $('Preparar datos').first().json.nombre, $('Preparar datos').first().json.email, $('Preparar datos').first().json.telefono, $('Preparar datos').first().json.fecha_evento, $('Preparar datos').first().json.tipo_evento, $('Preparar datos').first().json.paquete_asignado, $('Preparar datos').first().json.status, '', '', '', '', '', '', $('Preparar datos').first().json.fecha_generacion, $('Preparar datos').first().json.link ]] }) }}`,
        options: {}
      }
    },
    {
      id: 'telegram-link-generado',
      name: 'Telegram — Enviar Link',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [900, 300],
      continueOnFail: true,
      parameters: {
        method: 'POST',
        url: TELEGRAM,
        authentication: 'none',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: TELEGRAM_BODY,
        options: {}
      }
    },
    {
      id: '43522dc9-ec46-4d9e-8a70-ead1de56fb7e',
      name: 'Responder — Link generado',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [1120, 300],
      parameters: {
        respondWith: 'json',
        responseBody: '={{ { ok: true, token: $("Preparar datos").first().json.token, link: $("Preparar datos").first().json.link, nombre: $("Preparar datos").first().json.nombre } }}',
        options: {}
      }
    }
  ],
  connections: {
    'Webhook — Generar link':  { main: [[{ node: 'Preparar datos',             type: 'main', index: 0 }]] },
    'Preparar datos':           { main: [[{ node: 'Sheets — Guardar Selección', type: 'main', index: 0 }]] },
    'Sheets — Guardar Selección': { main: [[{ node: 'Telegram — Enviar Link',   type: 'main', index: 0 }]] },
    'Telegram — Enviar Link':   { main: [[{ node: 'Responder — Link generado',  type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1' },
  staticData: null
};

async function main() {
  await api('POST', `/api/v1/workflows/${ID_F4}/deactivate`, null);
  console.log('Desactivado...');

  const r = await api('PUT', `/api/v1/workflows/${ID_F4}`, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: null
  });
  console.log('PUT status:', r.s);
  if (r.s !== 200) { console.error('Error:', r.b.slice(0, 500)); return; }

  const act = await api('POST', `/api/v1/workflows/${ID_F4}/activate`, null);
  console.log('Activo:', JSON.parse(act.b).active);

  // Test
  console.log('\nProbando webhook...');
  const body = JSON.stringify({
    nombre: 'Laura García', telefono: '7771234567',
    tipo_evento: 'Boda', fecha_evento: '2026-10-05',
    paquete_asignado: 'Herradura — Menú Clásico', email: 'laura@test.com'
  });
  const test = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 5678,
      path: '/webhook/lacabana-generar-link', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let o = ''; res.on('data', c => o += c); res.on('end', () => resolve({ s: res.statusCode, b: o })); });
    req.on('error', reject);
    req.write(body); req.end();
  });
  console.log('Status:', test.s);
  try {
    const d = JSON.parse(test.b);
    console.log('ok:', d.ok, '| nombre:', d.nombre, '| token:', d.token);
    console.log('link:', d.link);
  } catch(e) { console.log('body:', test.b.slice(0, 300)); }
}

main().catch(console.error);
