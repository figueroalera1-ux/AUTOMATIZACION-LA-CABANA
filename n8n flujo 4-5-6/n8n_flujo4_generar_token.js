const raw = $json;
const body = raw.body || raw;

const clean = (value) => String(value ?? '').trim();
const pick = (...names) => {
  for (const name of names) {
    const value = clean(body[name]);
    if (value) return value;
  }
  return '';
};

const nombre = pick('nombre', 'nombre_cliente', 'cliente', 'name');
const email = pick('email', 'correo', 'correo_cliente');
const telefono = pick('telefono', 'tel', 'phone', 'whatsapp');
const fecha_evento = pick('fecha_evento', 'fecha', 'event_date');
const tipo_evento = pick('tipo_evento', 'tipo', 'evento');
const paquete_asignado = pick('paquete_asignado', 'paquete', 'paquete_contratado');

const missing = [];
if (!nombre) missing.push('nombre');
if (!email) missing.push('email');
if (!telefono) missing.push('telefono');
if (!fecha_evento) missing.push('fecha_evento');
if (!tipo_evento) missing.push('tipo_evento');
if (!paquete_asignado) missing.push('paquete_asignado');

if (missing.length) {
  return [{
    json: {
      valid: false,
      error: `Faltan campos obligatorios: ${missing.join(', ')}`,
      missing
    }
  }];
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let suffix = '';
for (let i = 0; i < 6; i += 1) {
  suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
}

const token = `LC-${Date.now()}-${suffix}`;
const link_seleccion = `https://n8n.lacabanaeventos.com/webhook/seleccion?token=${encodeURIComponent(token)}`;
const fecha_creacion = new Date().toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City'
});

const telegram_text = [
  'La Cabana Eventos - nuevo link de seleccion',
  '',
  `Cliente: ${nombre}`,
  `Telefono: ${telefono}`,
  `Email: ${email}`,
  `Evento: ${tipo_evento}`,
  `Fecha: ${fecha_evento}`,
  `Paquete: ${paquete_asignado}`,
  '',
  `Token: ${token}`,
  `Link: ${link_seleccion}`
].join('\n');

return [{
  json: {
    valid: true,
    token,
    nombre,
    email,
    telefono,
    fecha_evento,
    tipo_evento,
    paquete_asignado,
    status: 'pendiente',
    menu_elegido: '',
    num_invitados: '',
    cocteleria: '',
    cerveza_barril: '',
    dietas_especiales: '',
    notas_cliente: '',
    fecha_creacion,
    fecha_seleccion: '',
    link_seleccion,
    telegram_text
  }
}];
