const fs = require('fs');
const path = 'C:\\Users\\studi\\Desktop\\la-cabana\\n8n-flows\\flujo6-guardar-seleccion.json';
const wf = JSON.parse(fs.readFileSync(path, 'utf8'));

const codeNode = wf.nodes.find(n => n.id === 'validar-y-extraer');

codeNode.parameters.jsCode = `const body = $('Webhook — Recibir selección').first().json.body || $('Webhook — Recibir selección').first().json;
const token = body.token || '';

let clientData = null;
if (token === 'TEST-ANGEL-001') {
  clientData = { nombre: 'Angel Figueroa', email: 'figueroa.lera1@gmail.com', telefono: '5619219350', fecha_evento: '2026-07-15', tipo_evento: 'Boda', paquete_asignado: 'Herradura — Menú Clásico (3 tiempos)', status: 'pendiente' };
} else {
  const rows = $('Sheets — Leer para validar').all();
  for (const row of rows) {
    if (row.json.token === token) { clientData = row.json; break; }
  }
}

const isValid = clientData && clientData.status === 'pendiente';
const ahora = new Date();

const nombre = isValid ? clientData.nombre : '';
const email = isValid ? clientData.email : '';
const telefono = isValid ? clientData.telefono : '';
const fecha_evento = isValid ? clientData.fecha_evento : '';
const tipo_evento = isValid ? clientData.tipo_evento : '';
const paquete_asignado = isValid ? clientData.paquete_asignado : '';
const menu_elegido = body.opcion_menu || '';
const num_invitados = body.num_invitados || '';
const cocteleria = body.cocteleria || 'No';
const cerveza_barril = body.cerveza_barril || 'No';
const dietas_especiales = body.dietas || '';
const notas_cliente = body.notas || '';
const fecha_seleccion = ahora.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

const html_response = '<html><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Selección confirmada</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f0f4f0;display:flex;align-items:center;justify-content:center;min-height:100vh}.box{background:white;max-width:480px;width:90%;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)}.hdr{background:#2d5a27;padding:22px;text-align:center}.hdr h1{color:white;font-size:20px}.hdr p{color:#a8d5a2;font-size:12px;margin-top:4px}.bod{padding:28px;text-align:center}.ico{font-size:50px;margin-bottom:14px}h2{color:#2d5a27;margin-bottom:10px}p{color:#555;font-size:14px;line-height:1.6;margin-bottom:10px}.res{background:#e8f5e9;border:2px solid #2d5a27;border-radius:10px;padding:16px;text-align:left;margin:16px 0;font-size:14px}.res p{margin:5px 0;color:#333}.wa{display:inline-block;background:#25D366;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;font-size:15px}</style></head><body><div class=box><div class=hdr><h1>🌿 La Cabaña Eventos</h1><p>San Pedro Huaquilpan, Hidalgo</p></div><div class=bod><div class=ico>🎉</div><h2>¡Selección confirmada!</h2><p>Tu elección fue registrada. Te enviamos un correo de confirmación.</p><div class=res><p>🍽️ <b>Menú:</b> ' + menu_elegido + '</p><p>👥 <b>Invitados:</b> ' + num_invitados + '</p><p>📅 <b>Fecha:</b> ' + fecha_evento + '</p></div><p>Nuestro equipo te contactará pronto para afinar los últimos detalles de tu evento.</p><a href="https://wa.me/527711341559?text=Hola%20acabo%20de%20confirmar%20mi%20seleccion%20de%20menu" class=wa>💬 Hablar con La Cabaña</a></div></div></body></html>';

const email_html = '<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#2d5a27;padding:22px;border-radius:8px 8px 0 0;text-align:center"><h1 style="color:white;margin:0;font-size:22px">🌿 La Cabaña Eventos</h1><p style="color:#a8d5a2;margin:5px 0 0;font-size:13px">San Pedro Huaquilpan, Hidalgo</p></div><div style="background:#f9f9f9;padding:28px;border:1px solid #ddd"><p style="font-size:17px;margin-bottom:16px">Hola <strong>' + nombre + '</strong>, tu seleccion fue recibida!</p><div style="background:white;border:2px solid #2d5a27;border-radius:10px;padding:18px;margin-bottom:16px"><p style="margin:6px 0">Evento: ' + tipo_evento + '</p><p style="margin:6px 0">Fecha: ' + fecha_evento + '</p><p style="margin:6px 0">Paquete: ' + paquete_asignado + '</p><p style="margin:6px 0">Menu elegido: ' + menu_elegido + '</p><p style="margin:6px 0">Invitados: ' + num_invitados + '</p></div><p style="color:#555;font-size:14px">Nuestro equipo revisara tu seleccion y te contactara para confirmar los detalles finales.</p><div style="text-align:center;margin:22px 0"><a href="https://wa.me/527711341559" style="background:#25D366;color:white;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold">Hablar con La Cabana</a></div></div><div style="background:#eee;padding:14px;text-align:center;font-size:12px;border-radius:0 0 8px 8px"><p style="margin:0">La Cabana Eventos - 771 134 1559 - lacabanaeventos.com</p></div></body></html>';

return [{ json: {
  valid: isValid,
  token,
  nombre,
  email,
  telefono,
  fecha_evento,
  tipo_evento,
  paquete_asignado,
  status: 'completado',
  menu_elegido,
  num_invitados,
  cocteleria,
  cerveza_barril,
  dietas_especiales,
  notas_cliente,
  fecha_seleccion,
  html_response,
  email_html
}}];`;

// Fix Responder — Éxito: simple reference, no inline expressions
const responderExito = wf.nodes.find(n => n.id === 'responder-exito');
responderExito.parameters.responseBody = "={{ $('Validar token y extraer datos').first().json.html_response }}";

// Fix Email node: simple reference, no inline expressions
const emailNode = wf.nodes.find(n => n.id === 'email-confirmacion');
emailNode.parameters.message = "={{ $('Validar token y extraer datos').first().json.email_html }}";

fs.writeFileSync(path, JSON.stringify(wf, null, 2));
console.log('flujo6 fixed and written.');

// Verify
const verify = JSON.parse(fs.readFileSync(path, 'utf8'));
const re = verify.nodes.find(n => n.id === 'responder-exito');
console.log('Responder responseBody:', re.parameters.responseBody);
const em = verify.nodes.find(n => n.id === 'email-confirmacion');
console.log('Email message:', em.parameters.message);
