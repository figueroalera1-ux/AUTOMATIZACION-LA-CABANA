/**
 * actualizar-flujos-4-6.js
 *
 * Flujo 4: agrega nodo Telegram que envía el link generado al admin
 * Flujo 6: agrega nodo Sheets — Agregar Lead para que el CRM lo procese
 */
const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const SHEET       = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';
const TELEGRAM    = 'https://api.telegram.org/bot8676090287:AAFv7isGLDRiXaxU6o0gOOKeCd_exd7VaO0/sendMessage';
const CHAT_ID     = '7790296286';
const ID_F4       = 'dc8RCg0pYscnKfyC';
const ID_F6       = 'vPHXAOG0wRHlvPoe';

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

/* ─────────────────────────────────────────────────────────────────
   FLUJO 4 — Generar Link
   Cadena: Webhook → Preparar token → Sheets Selecciones → Telegram → Responder
   ───────────────────────────────────────────────────────────────── */

const F4_CODE = `
const b = $('Webhook — Generar link').first().json.body || $('Webhook — Generar link').first().json;
const now = Date.now();
const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
const token = 'LC-' + now + '-' + rand;
const link = 'https://n8n.lacabanaeventos.com/webhook/seleccion?token=' + token;
const fecha = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

const sheetsBody = JSON.stringify({ values: [[
  '', token,
  b.nombre||'', b.email||'', b.telefono||'',
  b.fecha_evento||'', b.tipo_evento||'', b.paquete_asignado||'',
  'pendiente', '', '', '', '', '', '', '', '', '', '',
  link,
  b.cliente_id||'', b.num_invitados_estimado||'',
  b.servicio_adicional||'', b.observaciones||'',
  b.origen||'admin', fecha, ''
]] });

return [{ json: {
  token, link, sheetsBody,
  nombre:              b.nombre              || '',
  email:               b.email               || '',
  telefono:            b.telefono            || '',
  fecha_evento:        b.fecha_evento        || '',
  tipo_evento:         b.tipo_evento         || '',
  paquete_asignado:    b.paquete_asignado    || '',
  cliente_id:          b.cliente_id          || '',
  num_invitados_estimado: b.num_invitados_estimado || '',
  servicio_adicional:  b.servicio_adicional  || '',
  observaciones:       b.observaciones       || '',
  origen:              b.origen              || 'admin',
  fecha_generacion:    fecha
}}];`;

const F4_TELEGRAM_BODY = `={{ JSON.stringify({
  chat_id: '${CHAT_ID}',
  text: '🔗 *LINK DE SELECCIÓN — La Cabaña*\\n\\n'
    + '👤 ' + $('Preparar token').first().json.nombre + '\\n'
    + '📱 ' + $('Preparar token').first().json.telefono + '\\n'
    + '🎊 ' + $('Preparar token').first().json.tipo_evento + '\\n'
    + '📅 ' + $('Preparar token').first().json.fecha_evento + '\\n'
    + '📦 ' + $('Preparar token').first().json.paquete_asignado + '\\n\\n'
    + '🔗 Link para el cliente:\\n'
    + $('Preparar token').first().json.link + '\\n\\n'
    + '_Envíaselo por WhatsApp._',
  parse_mode: 'Markdown'
}) }}`;

const flujo4 = {
  name: 'La Cabaña — Flujo 4: Generar Link',
  nodes: [
    {
      id: '9ff336f5-fb02-49bb-93a2-01c72c302ef0',
      name: 'Webhook — Generar link',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 300],
      webhookId: 'adbcf49e-61b8-4419-8ea4-bb493114c2f0',
      parameters: { httpMethod: 'POST', path: 'lacabana-generar-link', responseMode: 'responseNode', options: {} }
    },
    {
      id: 'bc3b5980-6c8b-4c55-9537-21efe9514af3',
      name: 'Preparar token',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [460, 300],
      parameters: { jsCode: F4_CODE }
    },
    {
      id: '65c01013-9342-473c-9115-7f7875e4c83a',
      name: 'Sheets — Agregar fila',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [680, 300],
      continueOnFail: true,
      credentials: { googleSheetsOAuth2Api: { id: 'google-sheets-cred', name: 'Google Sheets account' } },
      parameters: {
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/Selecciones:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: "={{ $('Preparar token').first().json.sheetsBody }}",
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
        body: F4_TELEGRAM_BODY,
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
        responseBody: '={{ { ok: true, token: $("Preparar token").first().json.token, link: $("Preparar token").first().json.link } }}',
        options: {}
      }
    }
  ],
  connections: {
    'Webhook — Generar link': { main: [[{ node: 'Preparar token', type: 'main', index: 0 }]] },
    'Preparar token':          { main: [[{ node: 'Sheets — Agregar fila', type: 'main', index: 0 }]] },
    'Sheets — Agregar fila':   { main: [[{ node: 'Telegram — Enviar Link', type: 'main', index: 0 }]] },
    'Telegram — Enviar Link':  { main: [[{ node: 'Responder — Link generado', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1' },
  staticData: null
};

/* ─────────────────────────────────────────────────────────────────
   FLUJO 6 — Guardar Selección
   Agrega "Sheets — Agregar Lead" encadenado después de "Sheets — Actualizar fila"
   ───────────────────────────────────────────────────────────────── */

const F6_CODE = `
const raw = $('Webhook — Recibir selección').first().json;
const body = raw.body || raw;
const token = (body.token || '').trim();

const values = $('Leer Selecciones').first().json.values || [];
const h = values[0] || [];
const ti = h.indexOf('token'), ni = h.indexOf('nombre'), ei = h.indexOf('email');
const teli = h.indexOf('telefono'), fi = h.indexOf('fecha_evento');
const tip = h.indexOf('tipo_evento'), pi = h.indexOf('paquete_asignado'), si = h.indexOf('status');

let clientData = null, rowNumber = -1;
if (token === 'TEST-ANGEL-001') {
  clientData = { nombre:'Angel Figueroa', email:'figueroa.lera1@gmail.com', telefono:'5619219350', fecha_evento:'2026-07-15', tipo_evento:'Boda', paquete_asignado:'Herradura — Menú Clásico (3 tiempos)', status:'pendiente' };
  rowNumber = -1;
} else {
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if ((r[ti]||'').trim() === token && (r[si]||'') === 'pendiente') {
      clientData = { nombre:r[ni]||'', email:r[ei]||'', telefono:r[teli]||'', fecha_evento:r[fi]||'', tipo_evento:r[tip]||'', paquete_asignado:r[pi]||'', status:r[si]||'' };
      rowNumber = i + 1;
      break;
    }
  }
}

const isValid = !!clientData;
const ahora = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
const menu_elegido    = body.opcion_menu || body.menu_elegido || '';
const num_invitados   = body.num_invitados || '';
const cocteleria      = body.cocteleria || 'No';
const cerveza_barril  = body.cerveza_barril || 'No';
const dietas          = body.dietas || body.dietas_especiales || '';
const notas           = body.notas || body.notas_cliente || '';

const nombre = isValid ? clientData.nombre : '';
const email  = isValid ? clientData.email  : '';

const updateRange  = rowNumber > 0 ? 'Selecciones!A' + rowNumber + ':ZZ' + rowNumber : '';
const updateValues = isValid
  ? [['TRUE', token, clientData.nombre, clientData.email, clientData.telefono,
      clientData.fecha_evento, clientData.tipo_evento, clientData.paquete_asignado,
      'completado', menu_elegido, num_invitados, cocteleria, cerveza_barril, dietas, notas, ahora]]
  : [];

const emailHtml = '<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">'
  + '<div style="background:#6B1223;padding:22px;border-radius:8px 8px 0 0;text-align:center">'
  + '<h1 style="color:white;margin:0;font-size:22px">La Cabaña Eventos</h1></div>'
  + '<div style="background:#f9f9f9;padding:28px;border:1px solid #ddd">'
  + '<p style="font-size:17px;margin-bottom:16px">Hola <strong>' + nombre + '</strong>, tu selección fue recibida.</p>'
  + '<div style="background:white;border:2px solid #6B1223;border-radius:10px;padding:18px;margin-bottom:16px">'
  + '<p style="margin:6px 0"><strong>Evento:</strong> ' + (isValid?clientData.tipo_evento:'') + '</p>'
  + '<p style="margin:6px 0"><strong>Fecha:</strong> ' + (isValid?clientData.fecha_evento:'') + '</p>'
  + '<p style="margin:6px 0"><strong>Paquete:</strong> ' + (isValid?clientData.paquete_asignado:'') + '</p>'
  + '<p style="margin:6px 0"><strong>Menú:</strong> ' + menu_elegido + '</p>'
  + '<p style="margin:6px 0"><strong>Invitados:</strong> ' + num_invitados + '</p></div>'
  + '<div style="text-align:center;margin:22px 0">'
  + '<a href="https://wa.me/527711341559" style="background:#25D366;color:white;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold">Hablar con La Cabaña</a>'
  + '</div></div></body></html>';

return [{ json: {
  valid: isValid, token, nombre, email,
  telefono:         isValid ? clientData.telefono         : '',
  fecha_evento:     isValid ? clientData.fecha_evento     : '',
  tipo_evento:      isValid ? clientData.tipo_evento      : '',
  paquete_asignado: isValid ? clientData.paquete_asignado : '',
  menu_elegido, num_invitados, cocteleria, cerveza_barril,
  dietas, notas, fecha_seleccion: ahora,
  updateRange,
  updateValues: JSON.stringify({ values: updateValues }),
  emailHtml
} }];`;

// Orden de columnas Leads: id|nombre|telefono|email|evento|fecha_evento|personas|fuente|status|fecha_captura|ultimo_email|paquete|...
const F6_LEADS_BODY = `={{ JSON.stringify({ values: [[
  'SEL-' + $('Validar y preparar').first().json.token,
  $('Validar y preparar').first().json.nombre,
  $('Validar y preparar').first().json.telefono,
  $('Validar y preparar').first().json.email,
  $('Validar y preparar').first().json.tipo_evento,
  $('Validar y preparar').first().json.fecha_evento,
  $('Validar y preparar').first().json.num_invitados,
  'menu_digital',
  'nuevo',
  $('Validar y preparar').first().json.fecha_seleccion,
  '',
  $('Validar y preparar').first().json.paquete_asignado,
  '',
  '',
  '',
  'Selección de menú: ' + $('Validar y preparar').first().json.menu_elegido
]] }) }}`;

const F6_TELEGRAM_BODY = `={{ JSON.stringify({
  chat_id: '${CHAT_ID}',
  text: '✅ *SELECCIÓN CONFIRMADA*\\n\\n'
    + '👤 ' + $('Validar y preparar').first().json.nombre + '\\n'
    + '📅 ' + $('Validar y preparar').first().json.fecha_evento + '\\n'
    + '🍽️ ' + $('Validar y preparar').first().json.menu_elegido + '\\n'
    + '👥 ' + $('Validar y preparar').first().json.num_invitados + ' invitados',
  parse_mode: 'Markdown'
}) }}`;

const flujo6 = {
  name: 'La Cabaña — Flujo 6: Guardar Selección',
  nodes: [
    {
      id: 'f31e1f2e-9a25-4244-91f6-b676060ba9ea',
      name: 'Webhook — Recibir selección',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 300],
      webhookId: '230273fb-3b59-41e8-b42d-4cd0b63ef0d2',
      parameters: { httpMethod: 'POST', path: 'seleccion-guardar', responseMode: 'responseNode', options: {} }
    },
    {
      id: 'c7c87fcc-fe03-4c91-99ab-08f5845076c2',
      name: 'Leer Selecciones',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [460, 300],
      credentials: { googleSheetsOAuth2Api: { id: 'google-sheets-cred', name: 'Google Sheets account' } },
      parameters: {
        method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/Selecciones`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        options: {}
      }
    },
    {
      id: '118ea1b8-82d0-492e-abfb-6b5ec2a379bc',
      name: 'Validar y preparar',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [680, 300],
      parameters: { jsCode: F6_CODE }
    },
    {
      id: '5a07fa23-cd60-4ce9-b873-c213e304bac0',
      name: 'IF — ¿Válido?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [900, 300],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [{ id: 'check', leftValue: '={{ $json.valid }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
          combinator: 'and'
        },
        options: {}
      }
    },
    {
      id: 'f286f142-6e13-4b5d-bbc6-a56f64c62190',
      name: 'Sheets — Actualizar fila',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [1120, 140],
      continueOnFail: true,
      credentials: { googleSheetsOAuth2Api: { id: 'google-sheets-cred', name: 'Google Sheets account' } },
      parameters: {
        method: 'PUT',
        url: `=https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/{{ $("Validar y preparar").first().json.updateRange }}?valueInputOption=USER_ENTERED`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: '={{ $("Validar y preparar").first().json.updateValues }}',
        options: {}
      }
    },
    {
      id: 'sheets-agregar-lead-sel',
      name: 'Sheets — Agregar Lead',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [1340, 140],
      continueOnFail: true,
      credentials: { googleSheetsOAuth2Api: { id: 'google-sheets-cred', name: 'Google Sheets account' } },
      parameters: {
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/Leads:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: F6_LEADS_BODY,
        options: {}
      }
    },
    {
      id: '4ddc3e57-6acf-4e16-b458-2e7e4825113d',
      name: 'Email — Confirmación',
      type: 'n8n-nodes-base.emailSend',
      typeVersion: 2,
      position: [1120, 300],
      continueOnFail: true,
      credentials: { smtp: { id: 'GUuB0gffD5iBa139', name: 'SMTP account' } },
      parameters: {
        fromEmail: 'evento.social.lacabana@gmail.com',
        toEmail: '={{ $("Validar y preparar").first().json.email }}',
        subject: '✅ Tu selección de menú fue confirmada — La Cabaña Eventos',
        emailType: 'html',
        message: '={{ $("Validar y preparar").first().json.emailHtml }}',
        options: {}
      }
    },
    {
      id: '13429fa6-1f9c-44f9-95b2-f5e232a7c151',
      name: 'Telegram — Alerta',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [1120, 460],
      continueOnFail: true,
      parameters: {
        method: 'POST',
        url: TELEGRAM,
        authentication: 'none',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: F6_TELEGRAM_BODY,
        options: {}
      }
    },
    {
      id: '1280ab98-78ad-46ba-abc4-6d17faf23acb',
      name: 'Responder — Éxito',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [1120, 580],
      parameters: { respondWith: 'json', responseBody: '={{ { ok: true } }}', options: {} }
    },
    {
      id: '357c035b-cef5-49ef-9dc2-1fd2a4b78e73',
      name: 'Responder — Error',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [1120, 700],
      parameters: { respondWith: 'json', responseBody: '={{ { ok: false, error: "token_invalido" } }}', options: { responseCode: 400 } }
    }
  ],
  connections: {
    'Webhook — Recibir selección': { main: [[{ node: 'Leer Selecciones', type: 'main', index: 0 }]] },
    'Leer Selecciones':            { main: [[{ node: 'Validar y preparar', type: 'main', index: 0 }]] },
    'Validar y preparar':          { main: [[{ node: 'IF — ¿Válido?', type: 'main', index: 0 }]] },
    'IF — ¿Válido?': {
      main: [
        [
          { node: 'Sheets — Actualizar fila', type: 'main', index: 0 },
          { node: 'Email — Confirmación',     type: 'main', index: 0 },
          { node: 'Telegram — Alerta',        type: 'main', index: 0 },
          { node: 'Responder — Éxito',        type: 'main', index: 0 }
        ],
        [
          { node: 'Responder — Error', type: 'main', index: 0 }
        ]
      ]
    },
    'Sheets — Actualizar fila': { main: [[{ node: 'Sheets — Agregar Lead', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1' },
  staticData: null
};

/* ── Main ── */
async function main() {
  // Desactivar
  await api('POST', `/api/v1/workflows/${ID_F4}/deactivate`, null);
  await api('POST', `/api/v1/workflows/${ID_F6}/deactivate`, null);
  console.log('Flujos desactivados...');

  // Actualizar Flujo 4
  const r4 = await api('PUT', `/api/v1/workflows/${ID_F4}`, {
    name: flujo4.name, nodes: flujo4.nodes, connections: flujo4.connections,
    settings: flujo4.settings, staticData: null
  });
  console.log('Flujo 4 status:', r4.s);
  if (r4.s !== 200) { console.error('Error Flujo 4:', r4.b.slice(0, 500)); return; }
  console.log('Flujo 4 actualizado ✅');

  // Actualizar Flujo 6
  const r6 = await api('PUT', `/api/v1/workflows/${ID_F6}`, {
    name: flujo6.name, nodes: flujo6.nodes, connections: flujo6.connections,
    settings: flujo6.settings, staticData: null
  });
  console.log('Flujo 6 status:', r6.s);
  if (r6.s !== 200) { console.error('Error Flujo 6:', r6.b.slice(0, 500)); return; }
  console.log('Flujo 6 actualizado ✅');

  // Reactivar
  const a4 = await api('POST', `/api/v1/workflows/${ID_F4}/activate`, null);
  const a6 = await api('POST', `/api/v1/workflows/${ID_F6}/activate`, null);
  console.log('Flujo 4 activo:', JSON.parse(a4.b).active);
  console.log('Flujo 6 activo:', JSON.parse(a6.b).active);

  // Prueba rápida Flujo 4
  console.log('\nProbando Flujo 4 (generar link)...');
  const testF4 = await new Promise((resolve, reject) => {
    const body = JSON.stringify({ nombre: 'Test Cliente', telefono: '5500000001', tipo_evento: 'Boda', fecha_evento: '2026-08-15', paquete_asignado: 'Herradura Clásico', email: 'test@test.com' });
    const req = http.request({
      hostname: 'localhost', port: 5678,
      path: '/webhook/lacabana-generar-link',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let o = ''; res.on('data', c => o += c); res.on('end', () => resolve({ s: res.statusCode, b: o })); });
    req.on('error', reject);
    req.write(body); req.end();
  });
  console.log('Test F4 status:', testF4.s);
  try {
    const parsed = JSON.parse(testF4.b);
    if (parsed.ok && parsed.link) {
      console.log('✅ Link generado:', parsed.link);
      console.log('   Token:', parsed.token);
    } else {
      console.log('Respuesta:', testF4.b.slice(0, 300));
    }
  } catch(e) {
    console.log('Body:', testF4.b.slice(0, 300));
  }
}

main().catch(console.error);
