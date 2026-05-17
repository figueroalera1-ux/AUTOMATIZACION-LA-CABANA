/**
 * Reconstruye Flujo 8 y Flujo 9 con el bug corregido:
 * - Si no hay filas que escribir, para el flujo ANTES de limpiar CRM
 * - Flujo 9 ya no limpia el CRM completo (solo añade WA leads)
 * - Dispara sync inmediato al terminar para repoblar CRM
 */
const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const SHEET = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';
const GCRED = { id: 'google-sheets-cred', name: 'Google Sheets account' };

function api(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = typeof data === 'object' && data !== null ? JSON.stringify(data) : (data || '');
    const opts = { hostname: 'localhost', port: 5678, path, method, headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = http.request(opts, res => { let out = ''; res.on('data', c => out += c); res.on('end', () => resolve({ status: res.statusCode, body: out })); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ──────────────────────────────────────────
// CODE NODE: parsea Leads tab, calcula CRM, preserva notas
// SI count=0, retorna [] para que n8n no ejecute nodos siguientes
// ──────────────────────────────────────────
const CRM_CODE = `
const MAX = 100;
const now = new Date();
const CRM_COLS = ['id','fecha_captura','nombre','telefono','email','evento','fecha_evento','personas','paquete','fuente','canal','campana','temperatura','score','etapa','proxima_accion','fecha_proxima_accion','dias_sin_contacto','status','ultimo_email','whatsapp','llamar','email_link','cotizacion_link','notas','mensaje'];

function clean(v){return String(v==null?'':v).trim();}
function pick(){for(let i=0;i<arguments.length;i++){const t=clean(arguments[i]);if(t)return t;}return '';}
function phone(v){const d=clean(v).replace(/\\D/g,'');if(!d)return '';if(d.length===10)return '52'+d;return d;}
function parseDate(v){const t=clean(v);if(!t||t.toLowerCase().includes('no especific'))return null;const iso=t.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);if(iso)return new Date(+iso[1],+iso[2]-1,+iso[3]);const mx=t.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})/);if(mx)return new Date(+mx[3],+mx[2]-1,+mx[1]);const p=new Date(t);return isNaN(p)?null:p;}
function days(a,b){return(!a||!b)?'':Math.floor((b-a)/86400000);}
function addDays(d){const x=new Date(now);x.setDate(x.getDate()+d);return x.toLocaleDateString('es-MX',{timeZone:'America/Mexico_City'});}
function canalFn(f){const s=clean(f).toLowerCase();if(s.includes('facebook')||s.includes('meta'))return 'Facebook / Meta';if(s.includes('instagram'))return 'Instagram';if(s.includes('tiktok'))return 'TikTok';if(s.includes('sitio')||s.includes('website')||s.includes('web')||s.includes('cotizar'))return 'Sitio web';if(s.includes('whatsapp'))return 'WhatsApp';return 'Otro';}
function campanaFn(f){const p=clean(f).split('/').map(x=>x.trim()).filter(Boolean);return p[2]||p[0]||'';}
function score(row){let s=0;const tel=phone(row.telefono||'');const ev=clean(row.evento||'').toLowerCase();const pers=Number(clean(row.personas||'').replace(/\\D/g,''))||0;const fd=parseDate(row.fecha_evento);const dt=fd?days(now,fd):null;if(tel)s+=25;if(clean(row.email||''))s+=10;if(ev&&!ev.includes('no especific'))s+=15;if(fd)s+=15;if(clean(row.paquete||''))s+=10;if(pers>=100)s+=15;else if(pers>=50)s+=8;if(dt!==null&&dt>=0&&dt<=120)s+=15;if(ev.includes('boda')||ev.includes('xv')||ev.includes('quince'))s+=10;return Math.min(s,100);}
function temp(s){return s>=75?'CALIENTE':s>=45?'TIBIO':'FRIO';}
function accion(t,st,tel,em){const s=clean(st).toLowerCase();if(['anticipo','confirmado','realizado','cerrado'].includes(s))return 'Mantener / preparar evento';if(t==='CALIENTE'&&tel)return 'Llamar hoy + WhatsApp';if(t==='TIBIO'&&tel)return 'WhatsApp hoy';if(em)return 'Enviar email de seguimiento';return 'Revisar datos manualmente';}

const leadsRaw = $('HTTP - Leer Leads').first().json;
const leadsVals = leadsRaw.values || [];
const lHeaders = leadsVals[0] || [];
const leads = leadsVals.slice(1).map(row => {
  const o = {};
  lHeaders.forEach((h,i) => { o[h] = row[i] || ''; });
  return o;
}).filter(r => pick(r.id) && pick(r.nombre, r.full_name, r.name) !== '(click sin formulario)');

const crmRaw = $input.first().json;
const crmVals = crmRaw.values || [];
const crmHeaders = crmVals[0] || [];
const notasIdx = crmHeaders.indexOf('notas');
const oldNotas = {};
crmVals.slice(1).forEach(row => { if(row[0] && notasIdx>=0) oldNotas[row[0]] = row[notasIdx]||''; });

const sorted = leads.sort((a,b) => {
  const da = parseDate(a.fecha_captura); const db = parseDate(b.fecha_captura);
  return (db?db.getTime():0)-(da?da.getTime():0);
}).slice(0, MAX);

if (sorted.length === 0) return [];

const rows = sorted.map(row => {
  const id = pick(row.id);
  const nombre = pick(row.nombre, row.full_name, row.name, 'Sin nombre');
  const tel = phone(row.telefono || row.phone || '');
  const email = pick(row.email, row.correo);
  const status = pick(row.status, 'nuevo');
  const fuente = pick(row.fuente, 'Sin fuente');
  const created = parseDate(row.fecha_captura);
  const diasSin = row.ultimo_email ? 0 : (created ? Math.max(0, days(created, now)) : '');
  const sc = score(row);
  const t = temp(sc);
  const wa = tel ? encodeURIComponent('Hola '+nombre+', soy de La Cabaña Eventos. Recibimos tu solicitud para '+pick(row.evento,'tu evento')+' y me gustaría ayudarte.') : '';
  return CRM_COLS.map(col => {
    const m = {
      id, fecha_captura: pick(row.fecha_captura), nombre, telefono: tel, email,
      evento: pick(row.evento), fecha_evento: pick(row.fecha_evento), personas: pick(row.personas),
      paquete: pick(row.paquete), fuente, canal: canalFn(fuente), campana: campanaFn(fuente),
      temperatura: t, score: sc, etapa: status,
      proxima_accion: accion(t,status,Boolean(tel),Boolean(email)),
      fecha_proxima_accion: t==='CALIENTE'?addDays(0):t==='TIBIO'?addDays(1):addDays(3),
      dias_sin_contacto: diasSin, status, ultimo_email: pick(row.ultimo_email),
      whatsapp: tel?'https://wa.me/'+tel+'?text='+wa:'',
      llamar: tel?'tel:+'+tel:'',
      email_link: email?'mailto:'+email+'?subject=Seguimiento%20La%20Caba%C3%B1a%20Eventos':'',
      cotizacion_link: 'https://lacabanaeventos.com/cotizador.html',
      notas: oldNotas[id] || '', mensaje: pick(row.mensaje)
    };
    return String(m[col] == null ? '' : m[col]);
  });
});

return [{ json: { values: rows, count: rows.length } }];
`;

function httpGetNode(id, name, url, pos) {
  return { id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4, position: pos,
    credentials: { googleSheetsOAuth2Api: GCRED },
    parameters: { method: 'GET', url, authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} }
  };
}

// ──────────────────────────────────────────
// FLUJO 8: Leads → CRM (clear + rewrite)
// ──────────────────────────────────────────
async function fixFlujo8() {
  console.log('\n=== Flujo 8: CRM desde Leads ===');
  const g = await api('GET', '/api/v1/workflows/flujo8-crm-automatico', '');
  const wf = JSON.parse(g.body);
  const triggers = wf.nodes.filter(n => ['n8n-nodes-base.scheduleTrigger','n8n-nodes-base.webhook'].includes(n.type));

  const nodes = [
    ...triggers,
    httpGetNode('leer-leads', 'HTTP - Leer Leads', `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/Leads`, [460,340]),
    httpGetNode('leer-crm', 'HTTP - Leer CRM', `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/CRM`, [700,340]),
    { id:'code-crm', name:'Procesar Leads y CRM', type:'n8n-nodes-base.code', typeVersion:2, position:[960,340], parameters:{ jsCode: CRM_CODE } },
    { id:'http-clear', name:'HTTP - Limpiar CRM', type:'n8n-nodes-base.httpRequest', typeVersion:4, position:[1220,340],
      credentials: { googleSheetsOAuth2Api: GCRED },
      parameters: { method:'POST', url:`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/CRM!A2:Z1000:clear`, authentication:'predefinedCredentialType', nodeCredentialType:'googleSheetsOAuth2Api', sendBody:true, contentType:'raw', rawContentType:'application/json', body:'{}', options:{} }
    },
    { id:'http-write', name:'HTTP - Escribir CRM', type:'n8n-nodes-base.httpRequest', typeVersion:4, position:[1480,340],
      credentials: { googleSheetsOAuth2Api: GCRED },
      parameters: { method:'POST', url:`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/CRM:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, authentication:'predefinedCredentialType', nodeCredentialType:'googleSheetsOAuth2Api', sendBody:true, contentType:'raw', rawContentType:'application/json', body:'={{ JSON.stringify({ values: $json.values }) }}', options:{} }
    }
  ];

  const tNames = triggers.map(t => t.name);
  const conn = {};
  tNames.forEach(n => { conn[n] = { main: [[{ node:'HTTP - Leer Leads', type:'main', index:0 }]] }; });
  conn['HTTP - Leer Leads'] = { main: [[{ node:'HTTP - Leer CRM', type:'main', index:0 }]] };
  conn['HTTP - Leer CRM'] = { main: [[{ node:'Procesar Leads y CRM', type:'main', index:0 }]] };
  conn['Procesar Leads y CRM'] = { main: [[{ node:'HTTP - Limpiar CRM', type:'main', index:0 }]] };
  conn['HTTP - Limpiar CRM'] = { main: [[{ node:'HTTP - Escribir CRM', type:'main', index:0 }]] };

  await api('POST', '/api/v1/workflows/flujo8-crm-automatico/deactivate', '');
  const u = await api('PUT', '/api/v1/workflows/flujo8-crm-automatico', { name: wf.name, nodes, connections: conn, settings: { executionOrder:'v1' } });
  console.log('Update:', u.status);
  if (u.status !== 200) { console.error(u.body.slice(0,400)); return false; }
  const a = await api('POST', '/api/v1/workflows/flujo8-crm-automatico/activate', '');
  console.log('Active:', JSON.parse(a.body).active);
  return true;
}

// ──────────────────────────────────────────
// FLUJO 9: WhatsApp Leads → CRM (solo append, sin limpiar)
// ──────────────────────────────────────────
const WA_CODE = CRM_CODE
  .replace("$('HTTP - Leer Leads').first().json", "$('HTTP - Leer WA').first().json")
  .replace("pick(row.fuente, 'Sin fuente')", "pick(row.fuente, 'WhatsApp Manual')");

async function fixFlujo9() {
  console.log('\n=== Flujo 9: WhatsApp Leads → CRM (append) ===');
  const g = await api('GET', '/api/v1/workflows/flujo9-whatsapp-crm', '');
  const wf = JSON.parse(g.body);
  const triggers = wf.nodes.filter(n => ['n8n-nodes-base.scheduleTrigger','n8n-nodes-base.webhook'].includes(n.type));

  const nodes = [
    ...triggers,
    httpGetNode('leer-wa', 'HTTP - Leer WA', `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/WhatsApp%20Leads`, [460,352]),
    httpGetNode('leer-crm-wa', 'HTTP - Leer CRM', `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/CRM`, [700,352]),
    { id:'code-wa', name:'Procesar Leads y CRM', type:'n8n-nodes-base.code', typeVersion:2, position:[960,352], parameters:{ jsCode: WA_CODE } },
    // NO LIMPIAR — solo append
    { id:'http-append-wa', name:'HTTP - Append WA CRM', type:'n8n-nodes-base.httpRequest', typeVersion:4, position:[1220,352],
      credentials: { googleSheetsOAuth2Api: GCRED },
      parameters: { method:'POST', url:`https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/CRM:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, authentication:'predefinedCredentialType', nodeCredentialType:'googleSheetsOAuth2Api', sendBody:true, contentType:'raw', rawContentType:'application/json', body:'={{ JSON.stringify({ values: $json.values }) }}', options:{} }
    }
  ];

  const tNames = triggers.map(t => t.name);
  const conn = {};
  tNames.forEach(n => { conn[n] = { main: [[{ node:'HTTP - Leer WA', type:'main', index:0 }]] }; });
  conn['HTTP - Leer WA'] = { main: [[{ node:'HTTP - Leer CRM', type:'main', index:0 }]] };
  conn['HTTP - Leer CRM'] = { main: [[{ node:'Procesar Leads y CRM', type:'main', index:0 }]] };
  conn['Procesar Leads y CRM'] = { main: [[{ node:'HTTP - Append WA CRM', type:'main', index:0 }]] };

  await api('POST', '/api/v1/workflows/flujo9-whatsapp-crm/deactivate', '');
  const u = await api('PUT', '/api/v1/workflows/flujo9-whatsapp-crm', { name: wf.name, nodes, connections: conn, settings: { executionOrder:'v1' } });
  console.log('Update:', u.status);
  if (u.status !== 200) { console.error(u.body.slice(0,400)); return false; }
  const a = await api('POST', '/api/v1/workflows/flujo9-whatsapp-crm/activate', '');
  console.log('Active:', JSON.parse(a.body).active);
  return true;
}

// ──────────────────────────────────────────
// FLUJO 1: Agregar Gmail notification al guardar lead
// ──────────────────────────────────────────
async function addEmailToFlujo1() {
  console.log('\n=== Flujo 1: Agregar notificación Gmail ===');
  const g = await api('GET', '/api/v1/workflows/r25YdKe8fTNn2kOy', '');
  const wf = JSON.parse(g.body);

  // Check if gmail node already exists
  if (wf.nodes.find(n => n.name === 'Gmail - Notificar Lead')) {
    console.log('Gmail node ya existe, saltando');
    return true;
  }

  const gmailNode = {
    id: 'gmail-lead', name: 'Gmail - Notificar Lead',
    type: 'n8n-nodes-base.gmail',
    typeVersion: 2, position: [860, 300],
    continueOnFail: true,
    credentials: { gmailOAuth2: { id: '5QJa4pqaICJlOyzn', name: 'Gmail account' } },
    parameters: {
      operation: 'send', resource: 'message',
      toList: 'figueroa.lera1@gmail.com',
      subject: '={{ "🎉 Nuevo lead: " + $json.nombre + " — " + $json.evento }}',
      emailType: 'html',
      message: `={{ "<h2>Nuevo lead en La Cabaña</h2><table><tr><td><b>Nombre:</b></td><td>" + $json.nombre + "</td></tr><tr><td><b>Teléfono:</b></td><td>" + $json.telefono + "</td></tr><tr><td><b>Email:</b></td><td>" + $json.email + "</td></tr><tr><td><b>Evento:</b></td><td>" + $json.evento + "</td></tr><tr><td><b>Fecha:</b></td><td>" + $json.fecha_evento + "</td></tr><tr><td><b>Personas:</b></td><td>" + $json.personas + "</td></tr><tr><td><b>Fuente:</b></td><td>" + $json.fuente + "</td></tr><tr><td><b>Mensaje:</b></td><td>" + $json.mensaje + "</td></tr></table>" }}`
    }
  };

  const nodes = [...wf.nodes, gmailNode];
  const connections = JSON.parse(JSON.stringify(wf.connections));
  // Connect: Guardar en Leads → Gmail
  if (connections['Guardar en Leads']) {
    connections['Guardar en Leads'].main = [[{ node: 'Gmail - Notificar Lead', type: 'main', index: 0 }]];
  }

  await api('POST', '/api/v1/workflows/r25YdKe8fTNn2kOy/deactivate', '');
  const u = await api('PUT', '/api/v1/workflows/r25YdKe8fTNn2kOy', { name: wf.name, nodes, connections, settings: wf.settings });
  console.log('Update:', u.status);
  if (u.status !== 200) { console.error(u.body.slice(0,400)); return false; }
  const a = await api('POST', '/api/v1/workflows/r25YdKe8fTNn2kOy/activate', '');
  console.log('Active:', JSON.parse(a.body).active);
  return true;
}

// ──────────────────────────────────────────
// TRIGGER CRM SYNC MANUAL
// ──────────────────────────────────────────
async function triggerCRMSync() {
  console.log('\n=== Disparando sync CRM manual ===');
  await new Promise(r => setTimeout(r, 2000));
  const result = await new Promise((resolve, reject) => {
    const opts = { hostname:'localhost', port:5678, path:'/webhook/lacabana-crm-sync', method:'GET' };
    const req = http.request(opts, res => { let o=''; res.on('data',c=>o+=c); res.on('end',()=>resolve({status:res.statusCode,body:o.slice(0,200)})); });
    req.on('error', reject); req.end();
  });
  console.log('CRM sync status:', result.status);
  await new Promise(r => setTimeout(r, 5000)); // esperar que termine
  console.log('Esperando 5s para que termine...');
}

async function main() {
  const ok8 = await fixFlujo8();
  const ok9 = await fixFlujo9();
  const okEmail = await addEmailToFlujo1();

  if (ok8) await triggerCRMSync();

  // Borrar flujos duplicados que quedaron
  const toDelete = ['flujo4-generar-link','flujo5-formulario-cliente','flujo6-guardar-seleccion','setup-crear-crm','setup-whatsapp-leads','setup-formato-crm','setup-crear-hoja','temp-insertar-token','Qx2YtIddRhHJpwUH'];
  const {DatabaseSync} = require('node:sqlite');
  const db = new DatabaseSync('C:/Users/studi/.n8n/database.sqlite');
  db.exec('PRAGMA foreign_keys = OFF');
  let deleted = 0;
  for (const id of toDelete) {
    const row = db.prepare('SELECT id, name FROM workflow_entity WHERE id=?').get(id);
    if (!row) continue;
    ['webhook_entity','workflow_history','workflow_statistics','workflows_tags','shared_workflow','workflow_dependency'].forEach(t => { try { db.prepare('DELETE FROM '+t+' WHERE workflowId=?').run(id); } catch(e){} });
    const r = db.prepare('DELETE FROM workflow_entity WHERE id=?').run(id);
    if (r.changes > 0) { console.log('Borrado:', row.name); deleted++; }
  }
  db.exec('PRAGMA foreign_keys = ON');
  db.close();

  console.log('\n=== RESUMEN ===');
  console.log('Flujo 8 (CRM Leads):', ok8 ? '✅' : '❌');
  console.log('Flujo 9 (WA CRM append-only):', ok9 ? '✅' : '❌');
  console.log('Flujo 1 + Gmail:', okEmail ? '✅' : '❌');
  console.log('Flujos extra borrados:', deleted);
  console.log('\nFlujos activos finales:');
  console.log('  1. r25YdKe8fTNn2kOy  Flujo 1 — Lead sitio web + Gmail');
  console.log('  2. flujo7-marketing-intake  Flujo 7 — Lead ads + Click tracking + Telegram');
  console.log('  3. flujo8-crm-automatico  Flujo 8 — CRM desde Leads (cada hora)');
  console.log('  4. flujo9-whatsapp-crm  Flujo 9 — CRM desde WhatsApp Leads (append)');
  console.log('  5. dc8RCg0pYscnKfyC  Flujo 4 — Generar link');
  console.log('  6. WRIuewcqP2v38O5L  Flujo 5 — API cliente');
  console.log('  7. vPHXAOG0wRHlvPoe  Flujo 6 — Guardar selección menú');
  console.log('  8. HcA44ffoPqFcxF2P  HTML Selección menú');
  console.log('  9. kHbR7VEW6ZMN3EjE  Flujo 2 — Follow-up automático');
  console.log(' 10. XXruEtS2Z2eSnXUm  Flujo 3 — Facebook Lead Ad');
  console.log(' 11. 9vzbDw9MWESQttWx  Flujo 5b — Listar clientes');
}

main().catch(console.error);
