const raw = $('Webhook — Recibir selección').first().json;
const body = raw.body || raw;
const token = String(body.token || '').trim();
const rows = $('Sheets — Leer para validar').all();

let clientData = null;
for (const row of rows) {
  if (String(row.json.token || '').trim() === token) {
    clientData = row.json;
    break;
  }
}

const statusActual = String(clientData?.status || '').trim().toLowerCase();
const valid = Boolean(token && clientData && statusActual === 'pendiente');

const val = (name, fallback = '') => {
  const value = body[name];
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return value === undefined || value === null || value === '' ? fallback : String(value);
};
const yn = (name) => val(name, 'No') === 'No' ? 'No' : 'Si';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nombre = valid ? String(clientData.nombre || '') : '';
const email = valid ? String(clientData.email || '') : '';
const telefono = valid ? String(clientData.telefono || '') : '';
const fecha_evento = valid ? String(clientData.fecha_evento || '') : '';
const tipo_evento = valid ? String(clientData.tipo_evento || '') : '';
const paquete_asignado = valid ? String(clientData.paquete_asignado || '') : '';
const menu_elegido = valid ? val('menu_elegido') : '';
const num_invitados = valid ? val('num_invitados') : '';
const cocteleria = valid ? yn('cocteleria') : '';
const cerveza_barril = valid ? yn('cerveza_barril') : '';
const dietas_especiales = valid ? val('dietas_especiales') : '';
const notas_cliente = valid ? val('notas_cliente') : '';
const fecha_seleccion = valid ? new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : '';

const html_response = valid
  ? '<html><body style="font-family:Arial;text-align:center;padding:40px;background:#f0f4f0"><div style="background:white;max-width:520px;margin:auto;padding:28px;border-radius:16px"><h1 style="color:#2d5a27">Seleccion confirmada</h1><p>Tu eleccion fue registrada.</p><p><b>Menu:</b> ' + esc(menu_elegido) + '</p><p><b>Invitados:</b> ' + esc(num_invitados) + '</p><a href="https://wa.me/527711341559">Hablar con La Cabana</a></div></body></html>'
  : '<html><body><h1>Link no disponible</h1><p>La sesion ya fue utilizada o el token no es valido.</p></body></html>';

const email_html = valid
  ? '<html><body><h1>La Cabana Eventos</h1><p>Hola <b>' + esc(nombre) + '</b>, tu seleccion fue recibida.</p><p><b>Menu:</b> ' + esc(menu_elegido) + '</p><p><b>Invitados:</b> ' + esc(num_invitados) + '</p><p><b>Cocteleria:</b> ' + esc(cocteleria) + '</p><p><b>Cerveza:</b> ' + esc(cerveza_barril) + '</p><p><b>Dietas:</b> ' + esc(dietas_especiales || 'Sin notas') + '</p><p><b>Notas:</b> ' + esc(notas_cliente || 'Sin notas') + '</p></body></html>'
  : '';

return [{
  json: {
    valid,
    token,
    nombre,
    email,
    telefono,
    fecha_evento,
    tipo_evento,
    paquete_asignado,
    status: valid ? 'completado' : statusActual,
    menu_elegido,
    num_invitados,
    cocteleria,
    cerveza_barril,
    dietas_especiales,
    notas_cliente,
    fecha_seleccion,
    html_response,
    email_html
  }
}];
