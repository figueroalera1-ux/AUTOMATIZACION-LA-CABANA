const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const WF_ID = 'r25YdKe8fTNn2kOy';

// Same fields the website script.js sends:
// full_name, phone, email, tipo_evento, fecha_evento, num_personas, paquete_interes, mensaje, fuente
const NEW_CODE = `
const raw = $input.first().json;
const b = raw.body || raw;
const ts = Date.now();
const id = 'WEB-' + ts;

const nombre = (b.full_name || b.nombre || b.name || b.nombre_responsable || '').trim();
const telefono = String(b.telefono || b.phone || b.phone_number || b.tel || '').trim();
const email = (b.email || b.correo || '').trim();
const evento = (b.evento || b.tipo_evento || b.event_type || '').trim();
const fecha_evento = (b.fecha_evento || b.fecha || b.event_date || '').trim();
const personas = String(b.num_personas || b.personas || b.guests || '').trim();
const paquete = (b.paquete_interes || b.paquete || '').trim();
const mensaje = (b.mensaje || b.message || b.notes || '').trim();
const fuente = (b.fuente || b.utm_source || b.source || 'WEB').trim();
const status = 'nuevo';
const fecha_captura = new Date().toLocaleDateString('es-MX', {
  timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit'
});

return [{ json: { id, nombre, telefono, email, evento, fecha_evento, personas, fuente, status, fecha_captura, ultimo_email: '', paquete, mensaje } }];
`;

function api(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = typeof data === 'object' && data !== null ? JSON.stringify(data) : (data || '');
    const opts = {
      hostname: 'localhost', port: 5678, path, method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = http.request(opts, res => { let out = ''; res.on('data', c => out += c); res.on('end', () => resolve({ status: res.statusCode, body: out })); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const g = await api('GET', '/api/v1/workflows/' + WF_ID, '');
  const wf = JSON.parse(g.body);

  const nodes = wf.nodes.map(n => {
    if (n.name === 'Normalizar datos') {
      return { ...n, parameters: { jsCode: NEW_CODE } };
    }
    return n;
  });

  await api('POST', '/api/v1/workflows/' + WF_ID + '/deactivate', '');
  const u = await api('PUT', '/api/v1/workflows/' + WF_ID, { name: wf.name, nodes, connections: wf.connections, settings: wf.settings });
  console.log('Update:', u.status);
  if (u.status !== 200) { console.error(u.body.slice(0, 400)); return; }

  const a = await api('POST', '/api/v1/workflows/' + WF_ID + '/activate', '');
  console.log('Activate:', a.status, JSON.parse(a.body).active);

  // Test con el payload exacto que manda el sitio web
  await new Promise(r => setTimeout(r, 1200));
  const payload = JSON.stringify({
    full_name: 'Angel Figueroa',
    phone: '7711341559',
    email: 'figueroa.lera1@gmail.com',
    tipo_evento: 'Boda',
    fecha_evento: '2026-10-15',
    num_personas: '150',
    paquete_interes: '',
    mensaje: 'Fecha: 2026-10-15 | Invitados: 150 | Mensaje: prueba real del sitio',
    fuente: 'website'
  });

  const t = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 5678, path: '/webhook/lacabana-lead', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };
    const req = http.request(opts, res => { let o = ''; res.on('data', c => o += c); res.on('end', () => resolve({ status: res.statusCode, body: o })); });
    req.on('error', reject);
    req.write(payload); req.end();
  });

  console.log('\nTest status:', t.status);
  try {
    const tb = JSON.parse(t.body);
    if (tb.updates) {
      console.log('GUARDADO EN LEADS ✅');
      console.log('Fila:', tb.updates.updatedRange);
      console.log('Filas escritas:', tb.updates.updatedRows);
    } else {
      console.log('Respuesta:', JSON.stringify(tb).slice(0, 300));
    }
  } catch(e) {
    console.log('Body:', t.body.slice(0, 300));
  }
}

main().catch(console.error);
