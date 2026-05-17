const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const SHEET_ID = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';
const GCRED = { id: 'google-sheets-cred', name: 'Google Sheets account' };

function api(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = typeof data === 'object' && data !== null ? JSON.stringify(data) : (data || '');
    const opts = {
      hostname: 'localhost', port: 5678, path, method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = http.request(opts, res => {
      let out = ''; res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpNode(name, url, id_override) {
  return {
    id: id_override || name.toLowerCase().replace(/\s+/g, '-'),
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4,
    credentials: { googleSheetsOAuth2Api: GCRED },
    parameters: {
      method: 'GET', url,
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      options: {}
    }
  };
}

// ─────────────────────────────────────────────
// FLUJO 7 FIX
// ─────────────────────────────────────────────
// Leads columns in sheet order
const LEADS_BODY = `={{ JSON.stringify({ values: [[ $json.id??'', $json.nombre??'', $json.telefono??'', $json.email??'', $json.evento??'', $json.fecha_evento??'', $json.personas??'', $json.fuente??'', $json.status??'', $json.fecha_captura??'', $json.ultimo_email??'', $json.paquete??'', $json.mensaje??'' ]] }) }}`;
const CLICK_BODY = `={{ JSON.stringify({ values: [[ $json.id??'', $json.nombre??'', $json.telefono??'', $json.email??'', $json.evento??'', $json.fecha_evento??'', $json.personas??'', $json.paquete??'', $json.fuente??'', $json.status??'', $json.fecha_captura??'', $json.ultimo_email??'', $json.mensaje??'', $json.redirect_url??'' ]] }) }}`;

async function fixFlujo7() {
  console.log('\n=== Arreglando Flujo 7 ===');
  const g = await api('GET', '/api/v1/workflows/flujo7-marketing-intake', '');
  const wf = JSON.parse(g.body);

  const nodes = wf.nodes.map(n => {
    if (n.name === 'Sheets - Guardar click') {
      return {
        ...n,
        type: 'n8n-nodes-base.httpRequest', typeVersion: 4,
        continueOnFail: true,
        credentials: { googleSheetsOAuth2Api: GCRED },
        parameters: {
          method: 'POST',
          url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Click:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
          sendBody: true, contentType: 'raw', rawContentType: 'application/json',
          body: CLICK_BODY, options: {}
        }
      };
    }
    if (n.name === 'Sheets - Guardar lead marketing') {
      return {
        ...n,
        type: 'n8n-nodes-base.httpRequest', typeVersion: 4,
        continueOnFail: false,
        credentials: { googleSheetsOAuth2Api: GCRED },
        parameters: {
          method: 'POST',
          url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Leads:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
          sendBody: true, contentType: 'raw', rawContentType: 'application/json',
          body: LEADS_BODY, options: {}
        }
      };
    }
    return n;
  });

  await api('POST', '/api/v1/workflows/flujo7-marketing-intake/deactivate', '');
  const u = await api('PUT', '/api/v1/workflows/flujo7-marketing-intake', { name: wf.name, nodes, connections: wf.connections, settings: { executionOrder: 'v1' } });
  console.log('Update:', u.status);
  if (u.status !== 200) { console.error(u.body.slice(0, 400)); return false; }
  const a = await api('POST', '/api/v1/workflows/flujo7-marketing-intake/activate', '');
  console.log('Activate:', a.status, JSON.parse(a.body).active);
  return true;
}

// ─────────────────────────────────────────────
// FLUJO 8 / 9 CODE NODE (combined parse + process + merge)
// ─────────────────────────────────────────────
function buildCRMCode(leadsNodeName, crmNodeName) {
  return `
const MAX = 50;
const now = new Date();
const CRM_COLS = ['id','fecha_captura','nombre','telefono','email','evento','fecha_evento','personas','paquete','fuente','canal','campana','temperatura','score','etapa','proxima_accion','fecha_proxima_accion','dias_sin_contacto','status','ultimo_email','whatsapp','llamar','email_link','cotizacion_link','notas','mensaje'];

function clean(v){return String(v??'').trim();}
function pick(...vals){for(const v of vals){const t=clean(v);if(t)return t;}return '';}
function normalizePhone(v){const d=clean(v).replace(/\\D/g,'');if(!d)return '';if(d.length===10)return '52'+d;return d;}
function parseDate(v){const t=clean(v);if(!t||t.toLowerCase().includes('no especific'))return null;const iso=t.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);if(iso)return new Date(+iso[1],+iso[2]-1,+iso[3]);const mx=t.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})/);if(mx)return new Date(+mx[3],+mx[2]-1,+mx[1]);const p=new Date(t);return isNaN(p)?null:p;}
function daysBetween(a,b){if(!a||!b)return '';return Math.floor((b-a)/86400000);}
function addDays(d){const x=new Date(now);x.setDate(x.getDate()+d);return x.toLocaleDateString('es-MX',{timeZone:'America/Mexico_City'});}
function canal(f){const s=clean(f).toLowerCase();if(s.includes('facebook')||s.includes('fb')||s.includes('meta'))return 'Facebook / Meta';if(s.includes('instagram'))return 'Instagram';if(s.includes('tiktok'))return 'TikTok';if(s.includes('sitio')||s.includes('website')||s.includes('web'))return 'Sitio web';if(s.includes('whatsapp'))return 'WhatsApp';return 'Otro';}
function campagna(f){const p=clean(f).split('/').map(x=>x.trim()).filter(Boolean);return p[2]||p[0]||'';}
function scoreLead(row){let s=0;const phone=normalizePhone(row.telefono||'');const email=clean(row.email||'');const ev=clean(row.evento||'').toLowerCase();const pkg=clean(row.paquete||'').toLowerCase();const pers=Number(clean(row.personas||'').replace(/\\D/g,''))||0;const fechaEv=parseDate(row.fecha_evento);const daysTo=fechaEv?daysBetween(now,fechaEv):null;if(phone)s+=25;if(email)s+=10;if(ev&&!ev.includes('no especific'))s+=15;if(fechaEv)s+=15;if(pkg)s+=10;if(pers>=100)s+=15;else if(pers>=50)s+=8;if(daysTo!==null&&daysTo>=0&&daysTo<=120)s+=15;if(ev.includes('boda')||ev.includes('xv')||ev.includes('quince'))s+=10;return Math.min(s,100);}
function temperatura(s){if(s>=75)return 'CALIENTE';if(s>=45)return 'TIBIO';return 'FRIO';}
function nextAction(temp,status,hasPhone,hasEmail){const s=clean(status).toLowerCase();if(['anticipo','confirmado','realizado','cerrado'].includes(s))return 'Mantener / preparar evento';if(temp==='CALIENTE'&&hasPhone)return 'Llamar hoy + WhatsApp';if(temp==='TIBIO'&&hasPhone)return 'WhatsApp hoy';if(hasEmail)return 'Enviar email de seguimiento';return 'Revisar datos manualmente';}

// Parse leads from raw HTTP response
const leadsRaw = $('${leadsNodeName}').first().json;
const leadsVals = leadsRaw.values || [];
const leadsHeaders = leadsVals[0] || [];
const leads = leadsVals.slice(1).map(row => {
  const o = {};
  leadsHeaders.forEach((h,i) => o[h] = row[i]??'');
  return o;
}).filter(r => pick(r.id, r.ID) && pick(r.nombre, r.name, r.full_name) !== '(click sin formulario)');

// Parse existing CRM to preserve notas
const crmRaw = $input.first().json;
const crmVals = crmRaw.values || [];
const crmHeaders = crmVals[0] || [];
const notasIdx = crmHeaders.indexOf('notas');
const existingNotas = {};
crmVals.slice(1).forEach(row => {
  const id = row[0];
  if(id && notasIdx >= 0) existingNotas[id] = row[notasIdx] || '';
});

// Process leads -> CRM rows
const sorted = leads.sort((a,b) => {const da=parseDate(a.fecha_captura)?.getTime()||0;const db=parseDate(b.fecha_captura)?.getTime()||0;return db-da;}).slice(0,MAX);
const crmRows = [];
for(const row of sorted){
  const id = pick(row.id, row.ID);
  const nombre = pick(row.nombre, row.full_name, row.name, 'Sin nombre');
  const telefono = normalizePhone(row.telefono||row.phone||'');
  const email = pick(row.email, row.correo);
  const status = pick(row.status, 'nuevo');
  const fuente = pick(row.fuente, 'Sin fuente');
  const created = parseDate(row.fecha_captura);
  const diasSinContacto = row.ultimo_email ? 0 : (created ? Math.max(0,daysBetween(created,now)) : '');
  const score = scoreLead(row);
  const temp = temperatura(score);
  const accion = nextAction(temp,status,Boolean(telefono),Boolean(email));
  const fechaProxima = temp==='CALIENTE'?addDays(0):temp==='TIBIO'?addDays(1):addDays(3);
  const waText = encodeURIComponent('Hola '+nombre+', soy de La Cabaña Eventos. Recibimos tu solicitud para '+pick(row.evento,'tu evento')+' y me gustaría ayudarte con tu cotización.');
  const crm = {
    id, fecha_captura: pick(row.fecha_captura), nombre, telefono, email,
    evento: pick(row.evento), fecha_evento: pick(row.fecha_evento), personas: pick(row.personas),
    paquete: pick(row.paquete), fuente, canal: canal(fuente), campana: campagna(fuente),
    temperatura: temp, score, etapa: status,
    proxima_accion: accion, fecha_proxima_accion: fechaProxima,
    dias_sin_contacto: diasSinContacto, status, ultimo_email: pick(row.ultimo_email),
    whatsapp: telefono?'https://wa.me/'+telefono+'?text='+waText:'',
    llamar: telefono?'tel:+'+telefono:'',
    email_link: email?'mailto:'+email+'?subject='+encodeURIComponent('Seguimiento La Cabaña Eventos'):'',
    cotizacion_link: 'https://lacabanaeventos.com/cotizador.html',
    notas: existingNotas[id] || '',
    mensaje: pick(row.mensaje)
  };
  crmRows.push(crm);
}

const values = crmRows.map(row => CRM_COLS.map(col => String(row[col]??'')));
return [{ json: { values, count: values.length } }];
`.trim();
}

// ─────────────────────────────────────────────
// FLUJO 8 FIX
// ─────────────────────────────────────────────
async function fixFlujo8() {
  console.log('\n=== Arreglando Flujo 8 ===');
  const g = await api('GET', '/api/v1/workflows/flujo8-crm-automatico', '');
  const wf = JSON.parse(g.body);

  const triggers = wf.nodes.filter(n => n.type === 'n8n-nodes-base.scheduleTrigger' || n.type === 'n8n-nodes-base.webhook');

  const newNodes = [
    ...triggers,
    {
      id: 'http-leer-leads', name: 'HTTP - Leer Leads',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4,
      position: [460, 340],
      credentials: { googleSheetsOAuth2Api: GCRED },
      parameters: {
        method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Leads`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {}
      }
    },
    {
      id: 'http-leer-crm', name: 'HTTP - Leer CRM',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4,
      position: [700, 340],
      credentials: { googleSheetsOAuth2Api: GCRED },
      parameters: {
        method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/CRM`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {}
      }
    },
    {
      id: 'code-procesar-crm', name: 'Procesar Leads y CRM',
      type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [960, 340],
      parameters: { jsCode: buildCRMCode('HTTP - Leer Leads', 'HTTP - Leer CRM') }
    },
    {
      id: 'http-limpiar-crm', name: 'HTTP - Limpiar CRM',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4,
      position: [1220, 340],
      credentials: { googleSheetsOAuth2Api: GCRED },
      parameters: {
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/CRM!A2:Z1000:clear`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true, contentType: 'raw', rawContentType: 'application/json',
        body: '{}', options: {}
      }
    },
    {
      id: 'http-escribir-crm', name: 'HTTP - Escribir CRM',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4,
      position: [1480, 340],
      continueOnFail: true,
      credentials: { googleSheetsOAuth2Api: GCRED },
      parameters: {
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/CRM:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true, contentType: 'raw', rawContentType: 'application/json',
        body: '={{ JSON.stringify({ values: $json.values }) }}', options: {}
      }
    }
  ];

  const triggerNames = triggers.map(t => t.name);
  const connections = {};
  triggerNames.forEach(n => {
    connections[n] = { main: [[{ node: 'HTTP - Leer Leads', type: 'main', index: 0 }]] };
  });
  connections['HTTP - Leer Leads'] = { main: [[{ node: 'HTTP - Leer CRM', type: 'main', index: 0 }]] };
  connections['HTTP - Leer CRM'] = { main: [[{ node: 'Procesar Leads y CRM', type: 'main', index: 0 }]] };
  connections['Procesar Leads y CRM'] = { main: [[{ node: 'HTTP - Limpiar CRM', type: 'main', index: 0 }]] };
  connections['HTTP - Limpiar CRM'] = { main: [[{ node: 'HTTP - Escribir CRM', type: 'main', index: 0 }]] };

  await api('POST', '/api/v1/workflows/flujo8-crm-automatico/deactivate', '');
  const u = await api('PUT', '/api/v1/workflows/flujo8-crm-automatico', { name: wf.name, nodes: newNodes, connections, settings: { executionOrder: 'v1' } });
  console.log('Update:', u.status);
  if (u.status !== 200) { console.error(u.body.slice(0, 400)); return false; }
  const a = await api('POST', '/api/v1/workflows/flujo8-crm-automatico/activate', '');
  console.log('Activate:', a.status, JSON.parse(a.body).active);
  return true;
}

// ─────────────────────────────────────────────
// FLUJO 9 FIX (same as 8 but reads WhatsApp Leads)
// ─────────────────────────────────────────────
function buildCRMCodeWA() {
  return buildCRMCode('HTTP - Leer WA Leads', 'HTTP - Leer CRM WA').replace(
    "pick(row.fuente, 'Sin fuente')",
    "pick(row.fuente, 'WhatsApp Manual / Meta')"
  );
}

async function fixFlujo9() {
  console.log('\n=== Arreglando Flujo 9 ===');
  const g = await api('GET', '/api/v1/workflows/flujo9-whatsapp-crm', '');
  const wf = JSON.parse(g.body);

  const triggers = wf.nodes.filter(n => n.type === 'n8n-nodes-base.scheduleTrigger' || n.type === 'n8n-nodes-base.webhook');

  const newNodes = [
    ...triggers,
    {
      id: 'http-leer-wa', name: 'HTTP - Leer WA Leads',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4,
      position: [460, 352],
      credentials: { googleSheetsOAuth2Api: GCRED },
      parameters: {
        method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/WhatsApp%20Leads`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {}
      }
    },
    {
      id: 'http-leer-crm-wa', name: 'HTTP - Leer CRM WA',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4,
      position: [700, 352],
      credentials: { googleSheetsOAuth2Api: GCRED },
      parameters: {
        method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/CRM`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {}
      }
    },
    {
      id: 'code-procesar-wa', name: 'Procesar WA y CRM',
      type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [960, 352],
      parameters: { jsCode: buildCRMCodeWA() }
    },
    {
      id: 'http-limpiar-crm-wa', name: 'HTTP - Limpiar CRM WA',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4,
      position: [1220, 352],
      credentials: { googleSheetsOAuth2Api: GCRED },
      parameters: {
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/CRM!A2:Z1000:clear`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true, contentType: 'raw', rawContentType: 'application/json',
        body: '{}', options: {}
      }
    },
    {
      id: 'http-escribir-crm-wa', name: 'HTTP - Escribir CRM WA',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4,
      position: [1480, 352],
      continueOnFail: true,
      credentials: { googleSheetsOAuth2Api: GCRED },
      parameters: {
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/CRM:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true, contentType: 'raw', rawContentType: 'application/json',
        body: '={{ JSON.stringify({ values: $json.values }) }}', options: {}
      }
    }
  ];

  const triggerNames = triggers.map(t => t.name);
  const connections = {};
  triggerNames.forEach(n => {
    connections[n] = { main: [[{ node: 'HTTP - Leer WA Leads', type: 'main', index: 0 }]] };
  });
  connections['HTTP - Leer WA Leads'] = { main: [[{ node: 'HTTP - Leer CRM WA', type: 'main', index: 0 }]] };
  connections['HTTP - Leer CRM WA'] = { main: [[{ node: 'Procesar WA y CRM', type: 'main', index: 0 }]] };
  connections['Procesar WA y CRM'] = { main: [[{ node: 'HTTP - Limpiar CRM WA', type: 'main', index: 0 }]] };
  connections['HTTP - Limpiar CRM WA'] = { main: [[{ node: 'HTTP - Escribir CRM WA', type: 'main', index: 0 }]] };

  await api('POST', '/api/v1/workflows/flujo9-whatsapp-crm/deactivate', '');
  const u = await api('PUT', '/api/v1/workflows/flujo9-whatsapp-crm', { name: wf.name, nodes: newNodes, connections, settings: { executionOrder: 'v1' } });
  console.log('Update:', u.status);
  if (u.status !== 200) { console.error(u.body.slice(0, 400)); return false; }
  const a = await api('POST', '/api/v1/workflows/flujo9-whatsapp-crm/activate', '');
  console.log('Activate:', a.status, JSON.parse(a.body).active);
  return true;
}

// ─────────────────────────────────────────────
// TEST FLUJO 7
// ─────────────────────────────────────────────
async function testFlujo7() {
  console.log('\n=== Probando Flujo 7 (/lacabana-marketing-lead) ===');
  await new Promise(r => setTimeout(r, 1500));
  const payload = JSON.stringify({ nombre:'Test Marketing', telefono:'5599887766', email:'marketing@test.com', evento:'Boda', fecha_evento:'2026-12-01', personas:'100', mensaje:'Prueba flujo7', utm_source:'facebook', utm_campaign:'promo-may' });
  const result = await new Promise((resolve, reject) => {
    const opts = { hostname:'localhost', port:5678, path:'/webhook/lacabana-marketing-lead', method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)} };
    const req = http.request(opts, res => { let o=''; res.on('data',c=>o+=c); res.on('end',()=>resolve({status:res.statusCode,body:o})); });
    req.on('error', reject); req.write(payload); req.end();
  });
  console.log('Status:', result.status);
  const body = result.body.slice(0, 300);
  if (body.includes('updatedRows')) console.log('GUARDADO EN LEADS ✅');
  else console.log('Body:', body);
}

// ─────────────────────────────────────────────
// TEST FLUJO 7 CLICK TRACKING
// ─────────────────────────────────────────────
async function testFlujo7Click() {
  console.log('\n=== Probando Track Click (/lacabana-track-click) ===');
  const result = await new Promise((resolve, reject) => {
    const opts = { hostname:'localhost', port:5678, path:'/webhook/lacabana-track-click?utm_source=facebook&utm_campaign=mayo&url=https://lacabanaeventos.com/cotizador.html', method:'GET' };
    const req = http.request(opts, res => { let o=''; res.on('data',c=>o+=c); res.on('end',()=>resolve({status:res.statusCode,body:o.slice(0,200),location:res.headers.location})); });
    req.on('error', reject); req.end();
  });
  console.log('Status:', result.status, '| Redirect:', result.location || '(no location header)');
  if (result.status === 302 || result.status === 301) console.log('REDIRECT OK ✅');
}

async function main() {
  const ok7 = await fixFlujo7();
  const ok8 = await fixFlujo8();
  const ok9 = await fixFlujo9();

  if (ok7) {
    await testFlujo7();
    await testFlujo7Click();
  }

  console.log('\n=== RESUMEN ===');
  console.log('Flujo 7 (Marketing + Click tracking):', ok7 ? '✅ ARREGLADO' : '❌ FALLÓ');
  console.log('Flujo 8 (CRM automático):', ok8 ? '✅ ARREGLADO' : '❌ FALLÓ');
  console.log('Flujo 9 (WhatsApp CRM):', ok9 ? '✅ ARREGLADO' : '❌ FALLÓ');
  console.log('\nEndpoints activos:');
  console.log('  POST /webhook/lacabana-lead         → Flujo 1 (sitio web)');
  console.log('  POST /webhook/lacabana-marketing-lead → Flujo 7 (ads / cotizador)');
  console.log('  GET  /webhook/lacabana-track-click   → Flujo 7 (tracking clicks → redirige)');
  console.log('  GET  /webhook/lacabana-crm-sync      → Flujo 8 (sync manual CRM)');
  console.log('  GET  /webhook/lacabana-whatsapp-crm-sync → Flujo 9 (sync WA manual)');
}

main().catch(console.error);
