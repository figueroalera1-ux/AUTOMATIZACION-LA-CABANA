const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const SHEET_ID = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'google-sheets-cred', name: 'Google Sheets account' } };
const SMTP_CRED = { smtp: { id: 'GUuB0gffD5iBa139', name: 'SMTP account' } };

function api(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : '';
    const req = http.request({
      hostname: 'localhost', port: 5678, path, method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let out = ''; res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── FLUJO 4: Generar Link ────────────────────────────────────────────────────
const flujo4 = {
  name: 'La Cabaña — Flujo 4: Generar Link',
  nodes: [
    {
      name: 'Webhook — Generar link',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 300],
      parameters: { httpMethod: 'POST', path: 'lacabana-generar-link', responseMode: 'responseNode', options: {} }
    },
    {
      name: 'Preparar token',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [460, 300],
      parameters: {
        jsCode: `
const b = $('Webhook — Generar link').first().json.body || $('Webhook — Generar link').first().json;
const now = Date.now();
const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
const token = 'LC-' + now + '-' + rand;
const link = 'https://n8n.lacabanaeventos.com/webhook/seleccion?token=' + token;
const fecha = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

return [{ json: {
  token,
  link,
  nombre: b.nombre || '',
  email: b.email || '',
  telefono: b.telefono || '',
  fecha_evento: b.fecha_evento || '',
  tipo_evento: b.tipo_evento || '',
  paquete_asignado: b.paquete_asignado || '',
  cliente_id: b.cliente_id || '',
  num_invitados_estimado: b.num_invitados_estimado || '',
  servicio_adicional: b.servicio_adicional || '',
  observaciones: b.observaciones || '',
  origen: b.origen || 'admin',
  fecha_generacion: fecha,
  rowData: ['', token, b.nombre||'', b.email||'', b.telefono||'', b.fecha_evento||'', b.tipo_evento||'', b.paquete_asignado||'', 'pendiente', '', '', '', '', '', '', '', '', '', '', link, b.cliente_id||'', b.num_invitados_estimado||'', b.servicio_adicional||'', b.observaciones||'', b.origen||'admin', fecha, '']
}}];`
      }
    },
    {
      name: 'Sheets — Agregar fila',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [680, 300],
      credentials: SHEETS_CRED,
      parameters: {
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Selecciones:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: '={{ JSON.stringify({ values: [$json.rowData] }) }}',
        options: {}
      }
    },
    {
      name: 'Responder — Link generado',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [900, 300],
      parameters: {
        respondWith: 'json',
        responseBody: '={{ { ok: true, token: $("Preparar token").first().json.token, link: $("Preparar token").first().json.link } }}',
        options: {}
      }
    }
  ],
  connections: {
    'Webhook — Generar link': { main: [[{ node: 'Preparar token', type: 'main', index: 0 }]] },
    'Preparar token': { main: [[{ node: 'Sheets — Agregar fila', type: 'main', index: 0 }]] },
    'Sheets — Agregar fila': { main: [[{ node: 'Responder — Link generado', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1' }
};

// ─── FLUJO 5: API Cliente ─────────────────────────────────────────────────────
const flujo5 = {
  name: 'La Cabaña — Flujo 5: API Cliente',
  nodes: [
    {
      name: 'Webhook — Consulta cliente',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 300],
      parameters: { httpMethod: 'GET', path: 'lacabana-cliente', responseMode: 'responseNode', options: {} }
    },
    {
      name: 'Leer Selecciones',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [460, 300],
      credentials: SHEETS_CRED,
      parameters: {
        method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Selecciones`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        options: {}
      }
    },
    {
      name: 'Buscar token',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [680, 300],
      parameters: {
        jsCode: `
const token = ($('Webhook — Consulta cliente').first().json.query?.token || '').trim();
if (!token) return [{ json: { ok: false, error: 'not_found' } }];

const values = $('Leer Selecciones').first().json.values || [];
if (values.length < 2) return [{ json: { ok: false, error: 'not_found' } }];

const h = values[0];
const ti = h.indexOf('token'), ni = h.indexOf('nombre'), ei = h.indexOf('email');
const tip = h.indexOf('tipo_evento'), fi = h.indexOf('fecha_evento');
const pi = h.indexOf('paquete_asignado'), si = h.indexOf('status');

for (let i = 1; i < values.length; i++) {
  const r = values[i];
  if ((r[ti] || '').trim() === token) {
    if ((r[si] || '') !== 'pendiente') return [{ json: { ok: false, error: 'not_found' } }];
    return [{ json: {
      ok: true,
      nombre: r[ni] || '',
      email: r[ei] || '',
      tipo_evento: r[tip] || '',
      fecha_evento: r[fi] || '',
      paquete_asignado: r[pi] || '',
      status: r[si] || 'pendiente'
    }}];
  }
}
return [{ json: { ok: false, error: 'not_found' } }];`
      }
    },
    {
      name: 'Responder — JSON',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [900, 300],
      parameters: { respondWith: 'json', responseBody: '={{ $json }}', options: {} }
    }
  ],
  connections: {
    'Webhook — Consulta cliente': { main: [[{ node: 'Leer Selecciones', type: 'main', index: 0 }]] },
    'Leer Selecciones': { main: [[{ node: 'Buscar token', type: 'main', index: 0 }]] },
    'Buscar token': { main: [[{ node: 'Responder — JSON', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1' }
};

// ─── FLUJO 6: Guardar Selección ───────────────────────────────────────────────
const flujo6 = {
  name: 'La Cabaña — Flujo 6: Guardar Selección',
  nodes: [
    {
      name: 'Webhook — Recibir selección',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 300],
      parameters: { httpMethod: 'POST', path: 'seleccion-guardar', responseMode: 'responseNode', options: {} }
    },
    {
      name: 'Leer Selecciones',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [460, 300],
      credentials: SHEETS_CRED,
      parameters: {
        method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Selecciones`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        options: {}
      }
    },
    {
      name: 'Validar y preparar',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [680, 300],
      parameters: {
        jsCode: `
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
const menu_elegido = body.opcion_menu || body.menu_elegido || '';
const num_invitados = body.num_invitados || '';
const cocteleria = body.cocteleria || 'No';
const cerveza_barril = body.cerveza_barril || 'No';
const dietas = body.dietas || body.dietas_especiales || '';
const notas = body.notas || body.notas_cliente || '';

const nombre = isValid ? clientData.nombre : '';
const email = isValid ? clientData.email : '';

const updateRange = rowNumber > 0 ? 'Selecciones!A' + rowNumber + ':ZZ' + rowNumber : '';
const updateValues = isValid ? [['TRUE', token, clientData.nombre, clientData.email, clientData.telefono, clientData.fecha_evento, clientData.tipo_evento, clientData.paquete_asignado, 'completado', menu_elegido, num_invitados, cocteleria, cerveza_barril, dietas, notas, ahora]] : [];

const emailHtml = '<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#6B1223;padding:22px;border-radius:8px 8px 0 0;text-align:center"><h1 style="color:white;margin:0;font-size:22px">La Cabaña Eventos</h1></div><div style="background:#f9f9f9;padding:28px;border:1px solid #ddd"><p style="font-size:17px;margin-bottom:16px">Hola <strong>' + nombre + '</strong>, tu selección fue recibida.</p><div style="background:white;border:2px solid #6B1223;border-radius:10px;padding:18px;margin-bottom:16px"><p style="margin:6px 0"><strong>Evento:</strong> ' + (isValid?clientData.tipo_evento:'') + '</p><p style="margin:6px 0"><strong>Fecha:</strong> ' + (isValid?clientData.fecha_evento:'') + '</p><p style="margin:6px 0"><strong>Paquete:</strong> ' + (isValid?clientData.paquete_asignado:'') + '</p><p style="margin:6px 0"><strong>Menú:</strong> ' + menu_elegido + '</p><p style="margin:6px 0"><strong>Invitados:</strong> ' + num_invitados + '</p></div><div style="text-align:center;margin:22px 0"><a href="https://wa.me/527711341559" style="background:#25D366;color:white;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold">Hablar con La Cabaña</a></div></div></body></html>';

return [{ json: { valid: isValid, token, nombre, email, telefono: isValid?clientData.telefono:'', fecha_evento: isValid?clientData.fecha_evento:'', tipo_evento: isValid?clientData.tipo_evento:'', paquete_asignado: isValid?clientData.paquete_asignado:'', menu_elegido, num_invitados, cocteleria, cerveza_barril, dietas, notas, fecha_seleccion: ahora, updateRange, updateValues: JSON.stringify({ values: updateValues }), emailHtml } }];`
      }
    },
    {
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
      name: 'Sheets — Actualizar fila',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [1120, 160],
      credentials: SHEETS_CRED,
      continueOnFail: true,
      parameters: {
        method: 'PUT',
        url: `=https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/{{ $('Validar y preparar').first().json.updateRange }}?valueInputOption=USER_ENTERED`,
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
      name: 'Email — Confirmación',
      type: 'n8n-nodes-base.emailSend',
      typeVersion: 2,
      position: [1120, 300],
      credentials: SMTP_CRED,
      continueOnFail: true,
      parameters: {
        fromEmail: 'evento.social.lacabana@gmail.com',
        toEmail: "={{ $('Validar y preparar').first().json.email }}",
        subject: '✅ Tu selección de menú fue confirmada — La Cabaña Eventos',
        emailType: 'html',
        message: "={{ $('Validar y preparar').first().json.emailHtml }}",
        options: {}
      }
    },
    {
      name: 'Telegram — Alerta',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [1120, 440],
      continueOnFail: true,
      parameters: {
        method: 'POST',
        url: 'https://api.telegram.org/bot8676090287:AAFv7isGLDRiXaxU6o0gOOKeCd_exd7VaO0/sendMessage',
        authentication: 'none',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: "={{ JSON.stringify({ chat_id: '7790296286', text: '✅ *SELECCIÓN CONFIRMADA*\\n\\n👤 ' + $('Validar y preparar').first().json.nombre + '\\n📅 ' + $('Validar y preparar').first().json.fecha_evento + '\\n🍽️ ' + $('Validar y preparar').first().json.menu_elegido + '\\n👥 ' + $('Validar y preparar').first().json.num_invitados + ' invitados', parse_mode: 'Markdown' }) }}",
        options: {}
      }
    },
    {
      name: 'Responder — Éxito',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [1340, 300],
      parameters: { respondWith: 'json', responseBody: '={{ { ok: true } }}', options: {} }
    },
    {
      name: 'Responder — Error',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [1120, 580],
      parameters: { respondWith: 'json', responseBody: '={{ { ok: false, error: "token_invalido" } }}', options: { responseCode: 400 } }
    }
  ],
  connections: {
    'Webhook — Recibir selección': { main: [[{ node: 'Leer Selecciones', type: 'main', index: 0 }]] },
    'Leer Selecciones': { main: [[{ node: 'Validar y preparar', type: 'main', index: 0 }]] },
    'Validar y preparar': { main: [[{ node: 'IF — ¿Válido?', type: 'main', index: 0 }]] },
    'IF — ¿Válido?': {
      main: [
        [
          { node: 'Sheets — Actualizar fila', type: 'main', index: 0 },
          { node: 'Email — Confirmación', type: 'main', index: 0 },
          { node: 'Telegram — Alerta', type: 'main', index: 0 },
          { node: 'Responder — Éxito', type: 'main', index: 0 }
        ],
        [{ node: 'Responder — Error', type: 'main', index: 0 }]
      ]
    }
  },
  settings: { executionOrder: 'v1' }
};

// ─── Desactivar flujos viejos y crear nuevos ──────────────────────────────────
async function run() {
  const OLD_IDS = ['pyon28AYRbqy7hai', '6QyAL3rmlIlQFL9n', 'jEEv3zGWFcOzFRjL'];

  console.log('Desactivando flujos viejos...');
  for (const id of OLD_IDS) {
    const r = await api('POST', `/api/v1/workflows/${id}/deactivate`, null);
    console.log(' ', id, '→', r.status);
  }

  const toCreate = [
    { wf: flujo4, label: 'Flujo 4 (Generar Link)' },
    { wf: flujo5, label: 'Flujo 5 (API Cliente)' },
    { wf: flujo6, label: 'Flujo 6 (Guardar Selección)' }
  ];

  const newIds = {};
  for (const { wf, label } of toCreate) {
    console.log(`\nCreando ${label}...`);
    const r = await api('POST', '/api/v1/workflows', wf);
    if (r.status !== 200 && r.status !== 201) {
      console.error(`  ERROR ${r.status}:`, r.body.slice(0, 300));
      continue;
    }
    const created = JSON.parse(r.body);
    newIds[label] = created.id;
    console.log('  ID:', created.id);

    // Activate
    const a = await api('POST', `/api/v1/workflows/${created.id}/activate`, null);
    console.log('  Activado:', a.status === 200 ? 'SÍ' : `ERROR ${a.status}`);
  }

  console.log('\n=== NUEVOS IDs ===');
  Object.entries(newIds).forEach(([k, v]) => console.log(k, '→', v));

  // Test flujo 5
  console.log('\nProbando flujo 5...');
  await new Promise(r => setTimeout(r, 1500));
  const test = await new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 5678, path: '/webhook/lacabana-cliente?token=LC-1778709796755-H9W8OA', method: 'GET' }, res => {
      let out = ''; res.on('data', c => out += c); res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject); req.end();
  });
  console.log('Test resultado:', test.status, test.body);
}

run().catch(console.error);
