const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const OLD_WF_ID = 'CczTsT1utoEPuicm';
const SHEET_ID = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';
const GOOGLE_CRED_ID = 'google-sheets-cred';

function apiRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = (data && typeof data === 'object') ? JSON.stringify(data) : (data || '');
    const opts = {
      hostname: 'localhost', port: 5678, path, method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = http.request(opts, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const CODE_NORMALIZAR = `
const b = $input.first().json.body || $input.first().json;
const ts = Date.now();
const id = 'WEB-' + ts;
const nombre = (b.nombre || b.name || '').trim();
const telefono = (b.telefono || b.phone || b.tel || '').toString().trim();
const email = (b.email || '').trim();
const evento = (b.evento || b.event_type || b.tipo_evento || '').trim();
const fecha_evento = (b.fecha || b.fecha_evento || b.event_date || '').trim();
const personas = (b.personas || b.guests || b.num_personas || '').toString().trim();
const mensaje = (b.mensaje || b.message || b.notes || '').trim();
const fuente = 'WEB';
const status = 'nuevo';
const fecha_captura = new Date().toISOString().slice(0, 10);
return [{ json: { id, nombre, telefono, email, evento, fecha_evento, personas, fuente, status, fecha_captura, ultimo_email: '', paquete: '', mensaje } }];
`;

const APPEND_BODY = `={{ JSON.stringify({ values: [[ $json.id, $json.nombre, $json.telefono, $json.email, $json.evento, $json.fecha_evento, $json.personas, $json.fuente, $json.status, $json.fecha_captura, $json.ultimo_email, $json.paquete, $json.mensaje ]] }) }}`;

const TELEGRAM_MSG = `=🎉 *Nuevo lead — La Cabaña*

👤 *{{ $json.nombre }}*
📞 {{ $json.telefono }}
📧 {{ $json.email }}
🎊 Evento: {{ $json.evento }}
📅 Fecha: {{ $json.fecha_evento }}
👥 Personas: {{ $json.personas }}
💬 {{ $json.mensaje }}`;

const workflow = {
  name: 'Flujo 1 — Leads del Sitio Web',
  nodes: [
    {
      id: 'wh-lead',
      name: 'Webhook — Lead Web',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [200, 300],
      parameters: {
        httpMethod: 'POST',
        path: 'lacabana-lead',
        responseMode: 'lastNode',
        options: {}
      },
      webhookId: 'lacabana-lead-v2'
    },
    {
      id: 'code-norm',
      name: 'Normalizar datos',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [420, 300],
      parameters: {
        jsCode: CODE_NORMALIZAR
      }
    },
    {
      id: 'http-sheets',
      name: 'Guardar en Leads',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [640, 300],
      credentials: {
        googleSheetsOAuth2Api: { id: GOOGLE_CRED_ID, name: 'Google Sheets account' }
      },
      parameters: {
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Leads:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: APPEND_BODY,
        options: {}
      }
    },
    {
      id: 'telegram-lead',
      name: 'Telegram — Notificar Lead',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1,
      position: [860, 200],
      parameters: {
        chatId: '-1001234567890',
        text: TELEGRAM_MSG,
        additionalFields: { parse_mode: 'Markdown' }
      }
    },
    {
      id: 'respond-ok',
      name: 'Responder OK',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [860, 400],
      parameters: {
        respondWith: 'json',
        responseBody: '={ "ok": true, "message": "Gracias, te contactaremos pronto" }',
        options: {}
      }
    }
  ],
  connections: {
    'Webhook — Lead Web': {
      main: [[{ node: 'Normalizar datos', type: 'main', index: 0 }]]
    },
    'Normalizar datos': {
      main: [[{ node: 'Guardar en Leads', type: 'main', index: 0 }]]
    },
    'Guardar en Leads': {
      main: [[
        { node: 'Telegram — Notificar Lead', type: 'main', index: 0 },
        { node: 'Responder OK', type: 'main', index: 0 }
      ]]
    }
  },
  settings: { executionOrder: 'v1' }
};

async function run() {
  // 1. Deactivate old Flujo 1
  console.log('Desactivando Flujo 1 antiguo...');
  const d = await apiRequest('POST', `/api/v1/workflows/${OLD_WF_ID}/deactivate`, '');
  console.log('Deactivate status:', d.status);

  // 2. Create new Flujo 1
  console.log('\nCreando nuevo Flujo 1...');
  const create = await apiRequest('POST', '/api/v1/workflows', workflow);
  console.log('Create status:', create.status);
  if (create.status !== 200 && create.status !== 201) {
    console.error('ERROR creando flujo:', create.body.slice(0, 600));
    return;
  }
  const created = JSON.parse(create.body);
  const newId = created.id;
  console.log('Nuevo Flujo 1 ID:', newId);

  // 3. Activate
  console.log('\nActivando...');
  const act = await apiRequest('POST', `/api/v1/workflows/${newId}/activate`, '');
  console.log('Activate status:', act.status);
  const actResult = JSON.parse(act.body);
  console.log('Activo:', actResult.active);

  // 4. Quick test
  console.log('\nProbando webhook POST /lacabana-lead...');
  await new Promise(r => setTimeout(r, 1500));
  const testPayload = JSON.stringify({
    nombre: 'Test Lead', telefono: '5512345678',
    email: 'test@test.com', evento: 'Boda',
    fecha_evento: '2026-09-15', personas: '150',
    mensaje: 'Prueba automatica del sistema'
  });
  const testReq = new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 5678,
      path: '/webhook/lacabana-lead',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(testPayload) }
    };
    const req = http.request(opts, res => {
      let out = ''; res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    req.write(testPayload); req.end();
  });
  const testResult = await testReq;
  console.log('Test status:', testResult.status);
  console.log('Test body:', testResult.body.slice(0, 300));

  console.log('\n=== RESULTADO FINAL ===');
  console.log('Flujo 1 nuevo ID:', newId);
  console.log('\nFlujos CORRECTOS (conservar):');
  console.log('  Flujo 1 — Leads:', newId, '(NUEVO ✅)');
  console.log('  Flujo 4 — Generar Link: dc8RCg0pYscnKfyC ✅');
  console.log('  Flujo 5 — API Cliente: WRIuewcqP2v38O5L ✅');
  console.log('  Flujo 6 — Guardar Selección: vPHXAOG0wRHlvPoe ✅');
  console.log('  HTML Selección Menú: HcA44ffoPqFcxF2P ✅');
  console.log('  Flujo 2 — Follow-up: kHbR7VEW6ZMN3EjE (pendiente revisar)');
  console.log('  Flujo 3 — Facebook Leads: XXruEtS2Z2eSnXUm (pendiente revisar)');
  console.log('\nFlujos BORRAR:');
  console.log('  CczTsT1utoEPuicm — Flujo 1 antiguo (reemplazado)');
  console.log('  pyon28AYRbqy7hai, 6QyAL3rmlIlQFL9n, jEEv3zGWFcOzFRjL — flujos 4/5/6 viejos');
  console.log('  7178e4ae-321c-4972-bfa0-c45762cb30de, IeU8k7KeM8eAkNc9 — HTML viejos');
  console.log('  DFKd0jcN5aoM25rC, UyFeVRIHjGdtpwYg, a9no1VkvGdHYTKbN, wxLJxFSLky9wl9Jq, Y9ZraF4JlOHHVyGI, 5KOcJMuPsKWYcAbW — Ficha duplicados');
  console.log('  Nn3QfnMziG4MOCaZ, Qx2YtIddRhHJpwUG, b6sdUHjFxg5Lwleo, eZqBXAG3BQ4EZBOH, Dxequ3TXbS8F52wg — varios rotos');
}

run().catch(console.error);
