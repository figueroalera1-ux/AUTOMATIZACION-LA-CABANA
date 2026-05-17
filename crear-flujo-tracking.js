/**
 * crear-flujo-tracking.js — La Cabaña Eventos
 *
 * Flujo de 4 nodos (sin deadlock):
 *   Webhook → Code (solo parsea params) → HTTP Request (guarda en Sheets)
 *   → Respond to Webhook (HTML redirect al cotizador)
 *
 * El HTTP Request usa la credencial googleSheetsOAuth2Api directamente,
 * por lo que n8n maneja el token OAuth automáticamente.
 */
const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const SHEET  = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';

function api(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : '';
    const req = http.request({
      hostname: 'localhost', port: 5678, path, method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let o = '';
      res.on('data', c => o += c);
      res.on('end', () => resolve({ s: res.statusCode, b: o }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/* ── Code node: SOLO parsea parámetros, sin HTTP ni DB ─────────────── */
const CODE = `
const q = $input.first().json.query || {};
const r = (q.r || 'otro').toLowerCase();
const c = q.c || 'organico';

const now = new Date();
const fecha = now.toLocaleDateString('es-MX', {timeZone:'America/Mexico_City'});
const hora  = now.toLocaleTimeString('es-MX', {timeZone:'America/Mexico_City', hour:'2-digit', minute:'2-digit'});

const redNames = {
  facebook:'Facebook', instagram:'Instagram', tiktok:'TikTok',
  whatsapp:'WhatsApp', google:'Google Ads',   youtube:'YouTube',
  twitter:'Twitter/X', x:'Twitter/X'
};
const redNombre = redNames[r] || r;
const id = 'CLK-' + Date.now();

const destino = 'https://lacabanaeventos.com/cotizador.html'
  + '?utm_source='    + encodeURIComponent(r)
  + '&utm_campaign='  + encodeURIComponent(c)
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

// Columnas Click: id,nombre,telefono,email,evento,fecha_evento,personas,fuente,status,fecha_captura,hora,campana,mensaje,redirect_url
const clickRow = [id, '', '', '', '', '', '', redNombre, 'click', fecha, hora, c, '', destino];

return [{json:{html, clickRow, destino, redNombre, campana: c}}];
`;

/* ── Workflow definition ─────────────────────────────────────────────── */
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
        path: 'ir',
        httpMethod: 'GET',
        responseMode: 'responseNode',
        options: {}
      }
    },
    {
      id: 'code-track',
      name: 'Preparar Datos Click',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [480, 300],
      parameters: { jsCode: CODE }
    },
    {
      id: 'http-sheets',
      name: 'Guardar Click en Sheets',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [720, 300],
      continueOnFail: true,
      parameters: {
        method: 'POST',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET
           + '/values/Click:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: '={{ JSON.stringify({ values: [$json.clickRow] }) }}',
        options: {}
      },
      credentials: {
        googleSheetsOAuth2Api: {
          id: 'google-sheets-cred',
          name: 'Google Sheets account'
        }
      }
    },
    {
      id: 'respond-ir',
      name: 'Redirigir al Cotizador',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [960, 300],
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
    'Webhook — Link de Red Social': {
      main: [[{ node: 'Preparar Datos Click', type: 'main', index: 0 }]]
    },
    'Preparar Datos Click': {
      main: [[{ node: 'Guardar Click en Sheets', type: 'main', index: 0 }]]
    },
    'Guardar Click en Sheets': {
      main: [[{ node: 'Redirigir al Cotizador', type: 'main', index: 0 }]]
    }
  },
  settings: { executionOrder: 'v1', saveManualExecutions: true },
  staticData: null
};

/* ── Main ─────────────────────────────────────────────────────────────── */
async function main() {
  // Buscar flujo existente
  const list = await api('GET', '/api/v1/workflows?limit=50', null);
  const workflows = JSON.parse(list.b).data || [];
  const existing = workflows.find(w =>
    w.name.includes('Tracking Redes') || w.name.includes('flujo-tracking')
  );

  let wfId;
  if (existing) {
    console.log('Flujo existente (ID:', existing.id, ') — actualizando...');
    await api('POST', '/api/v1/workflows/' + existing.id + '/deactivate', null);
    const u = await api('PUT', '/api/v1/workflows/' + existing.id, {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: null
    });
    if (u.s !== 200) { console.error('Error al actualizar:', u.b.slice(0, 400)); return; }
    wfId = JSON.parse(u.b).id;
    console.log('Flujo actualizado ✅');
  } else {
    console.log('Creando flujo de tracking...');
    const c = await api('POST', '/api/v1/workflows', workflow);
    if (c.s !== 200 && c.s !== 201) { console.error('Error al crear:', c.b.slice(0, 400)); return; }
    wfId = JSON.parse(c.b).id;
    console.log('Flujo creado ✅');
  }

  // Activar
  const act = await api('POST', '/api/v1/workflows/' + wfId + '/activate', null);
  const actR = JSON.parse(act.b);
  if (actR.active) {
    console.log('Flujo activo ✅  (ID:', wfId, ')');
  } else {
    console.error('Error al activar:', act.b.slice(0, 300));
    return;
  }

  // Probar el webhook directamente
  console.log('\nProbando el webhook...');
  const testR = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 5678,
      path: '/webhook/ir?r=instagram&c=bio',
      method: 'GET'
    }, res => {
      let o = ''; res.on('data', c => o += c);
      res.on('end', () => resolve({ s: res.statusCode, b: o }));
    });
    req.on('error', reject);
    req.end();
  });
  console.log('Test Status:', testR.s, '  Body length:', testR.b.length);
  if (testR.b.length > 0) {
    console.log('✅ Redirige correctamente. Los primeros 150 chars:');
    console.log(testR.b.slice(0, 150));
  } else {
    console.log('❌ Cuerpo vacío — revisar el flujo en n8n');
  }

  // Mostrar links
  const BASE = 'https://n8n.lacabanaeventos.com/webhook/ir';
  const LINKS = [
    { red: 'Facebook',   r: 'facebook',  campaigns: [['Bio / Página', 'bio'], ['Post orgánico', 'post'], ['Anuncio (Ads)', 'ads']] },
    { red: 'Instagram',  r: 'instagram', campaigns: [['Bio / Perfil', 'bio'], ['Historia (Story)', 'story'], ['Reel', 'reel'], ['Anuncio (Ads)', 'ads']] },
    { red: 'TikTok',     r: 'tiktok',    campaigns: [['Bio / Perfil', 'bio'], ['Video orgánico', 'video'], ['Anuncio (Ads)', 'ads']] },
    { red: 'WhatsApp',   r: 'whatsapp',  campaigns: [['Mensaje directo', 'directo'], ['Estado (Status)', 'status']] },
    { red: 'Google Ads', r: 'google',    campaigns: [['Búsqueda', 'busqueda'], ['Display', 'display']] },
    { red: 'YouTube',    r: 'youtube',   campaigns: [['Descripción video', 'video']] },
  ];

  console.log('\n' + '═'.repeat(70));
  console.log('  LINKS DE TRACKING — LA CABAÑA EVENTOS');
  console.log('═'.repeat(70));
  LINKS.forEach(({ red, r, campaigns }) => {
    console.log('\n  ' + red.toUpperCase());
    campaigns.forEach(([nombre, c]) => {
      console.log('    ' + nombre + ':');
      console.log('    ' + BASE + '?r=' + r + '&c=' + c);
    });
  });
  console.log('\n' + '═'.repeat(70));
  console.log('  Abre links-redes-sociales.html para ver los links con botones de copiado.');
  console.log('═'.repeat(70));
}

main().catch(console.error);
