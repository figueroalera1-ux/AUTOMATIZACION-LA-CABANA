/**
 * fix-flujo8.js — Reemplaza el nodo executeCommand (no soportado)
 * con Schedule → HTTP Leer Leads → HTTP Leer CRM → Code Upsert
 * → HTTP batchUpdate → HTTP append
 */
const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const SHEET = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';
const WF_ID = 'flujo8-crm-automatico';

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

/* ── Lógica completa de upsert CRM (se ejecuta dentro del Code node) ─ */
const UPSERT_CODE = `
const leadsVals = $('Leer Leads').first().json.values || [];
const crmVals   = $('Leer CRM').first().json.values   || [];

const CRM_COLS = ['id','fecha_captura','nombre','telefono','email','evento','fecha_evento','personas','paquete','fuente','canal','campana','temperatura','score','etapa','email_1_fecha','email_2_fecha','email_3_fecha','whatsapp_contactado','cotizacion_enviada','visita_agendada','adelanto_fecha','contrato_fecha','menu_enviado','menu_registrado','resultado','proxima_accion','fecha_proxima_accion','dias_sin_contacto','whatsapp_link','llamar_link','email_link','cotizacion_link','notas','mensaje'];
const MANUAL = new Set(['etapa','email_1_fecha','email_2_fecha','email_3_fecha','whatsapp_contactado','cotizacion_enviada','visita_agendada','adelanto_fecha','contrato_fecha','menu_enviado','menu_registrado','resultado','notas']);

function colLetter(i){let s='';i++;while(i>0){const r=(i-1)%26;s=String.fromCharCode(65+r)+s;i=Math.floor((i-1)/26);}return s;}
const LAST_COL = colLetter(CRM_COLS.length - 1);

const now = new Date();
function clean(v){return String(v==null?'':v).trim();}
function pick(...args){for(const a of args){const t=clean(a);if(t)return t;}return '';}
function fone(v){const d=clean(v).replace(/\\D/g,'');if(!d)return '';return d.length===10?'52'+d:d;}
function parseDate(v){const t=clean(v);if(!t||t.toLowerCase().includes('no especific'))return null;const iso=t.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);if(iso)return new Date(+iso[1],+iso[2]-1,+iso[3]);const mx=t.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})/);if(mx)return new Date(+mx[3],+mx[2]-1,+mx[1]);const p=new Date(t);return isNaN(p)?null:p;}
function days(a,b){return(!a||!b)?'':Math.floor((b-a)/86400000);}
function addDays(d){const x=new Date(now);x.setDate(x.getDate()+d);return x.toLocaleDateString('es-MX',{timeZone:'America/Mexico_City'});}
function canalFn(f){const s=clean(f).toLowerCase();if(s.includes('facebook')||s.includes('meta'))return 'Facebook / Meta';if(s.includes('instagram'))return 'Instagram';if(s.includes('tiktok'))return 'TikTok';if(s.includes('sitio')||s.includes('website')||s.includes('web')||s.includes('cotizar'))return 'Sitio web';if(s.includes('whatsapp'))return 'WhatsApp';return 'Otro';}
function campanaFn(f){const p=clean(f).split('/').map(x=>x.trim()).filter(Boolean);return p[2]||p[0]||'';}
function scoreFn(row){let s=0;const tel=fone(row.telefono||'');const ev=clean(row.evento||'').toLowerCase();const pers=Number(clean(row.personas||'').replace(/\\D/g,''))||0;const fd=parseDate(row.fecha_evento);const dt=fd?days(now,fd):null;if(tel)s+=25;if(clean(row.email||''))s+=10;if(ev&&!ev.includes('no especific'))s+=15;if(fd)s+=15;if(clean(row.paquete||''))s+=10;if(pers>=100)s+=15;else if(pers>=50)s+=8;if(dt!==null&&dt>=0&&dt<=120)s+=15;if(ev.includes('boda')||ev.includes('xv')||ev.includes('quince'))s+=10;return Math.min(s,100);}
function tempFn(s){return s>=75?'CALIENTE':s>=45?'TIBIO':'FRÍO';}
function accionFn(t,etapa,tel,em){const e=clean(etapa).toLowerCase();if(['adelanto recibido','contrato firmado','menú enviado','menú registrado','ganado'].some(x=>e.includes(x.split(' ')[0]))){return 'Mantener / preparar evento';}if(e==='perdido')return 'Lead perdido — archivar';if(t==='CALIENTE'&&tel)return 'Llamar hoy + WhatsApp';if(t==='TIBIO'&&tel)return 'WhatsApp hoy';if(em)return 'Enviar email de seguimiento';return 'Revisar datos manualmente';}
function normalizeEtapa(e){const s=clean(e).toLowerCase();if(!s||s==='nuevo')return 'Nuevo';if(s.includes('contact'))return 'Contactado';if(s.includes('cotiz'))return 'Cotización enviada';if(s.includes('visit'))return 'Visita agendada';if(s.includes('adelant')||s.includes('anticip'))return 'Adelanto recibido';if(s.includes('contrat'))return 'Contrato firmado';if(s.includes('menu')&&s.includes('env'))return 'Menú enviado';if(s.includes('menu')&&s.includes('reg'))return 'Menú registrado';if(s.includes('ganad')||s.includes('cerrado')||s.includes('realizado'))return 'Ganado';if(s.includes('perdid'))return 'Perdido';return e||'Nuevo';}

const lHdr = leadsVals[0] || [];
const leads = leadsVals.slice(1).map(row=>{const o={};lHdr.forEach((h,i)=>{o[h]=row[i]||'';});return o;})
  .filter(r=>pick(r.id)&&pick(r.nombre,r.full_name,r.name)!=='(click sin formulario)');

const crmHdr = crmVals[0] || [];
const needsMigration = JSON.stringify(crmHdr) !== JSON.stringify(CRM_COLS);

const crmMap = {};
crmVals.slice(1).forEach((row,idx)=>{
  const o={};crmHdr.forEach((h,i)=>{o[h]=row[i]||'';});
  if(!o.etapa&&o.status)o.etapa=o.status;
  if(!o.email_1_fecha&&o.ultimo_email)o.email_1_fecha=o.ultimo_email;
  if(!o.whatsapp_link&&o.whatsapp)o.whatsapp_link=o.whatsapp;
  if(!o.llamar_link&&o.llamar)o.llamar_link=o.llamar;
  if(o.etapa)o.etapa=normalizeEtapa(o.etapa);
  if(!o.resultado)o.resultado='En proceso';
  if(!o.whatsapp_contactado)o.whatsapp_contactado='No';
  if(o.id)crmMap[o.id]={sheetRow:idx+2,data:o};
});

const toUpdate=[], toAppend=[];
const sorted=[...leads].sort((a,b)=>{const da=parseDate(a.fecha_captura),db2=parseDate(b.fecha_captura);return(db2?db2.getTime():0)-(da?da.getTime():0);});

for(const lead of sorted){
  const id=pick(lead.id);if(!id)continue;
  const nombre=pick(lead.nombre,lead.full_name,lead.name,'Sin nombre');
  const tel=fone(lead.telefono||lead.phone||'');
  const email=pick(lead.email,lead.correo);
  const fuente=pick(lead.fuente,'Sin fuente');
  const created=parseDate(lead.fecha_captura);
  const sc=scoreFn(lead);const t=tempFn(sc);
  const diasSin=created?Math.max(0,days(created,now)):'';
  const wa=tel?encodeURIComponent('Hola '+nombre+', soy de La Cabaña Eventos. Recibimos tu solicitud para '+pick(lead.evento,'tu evento')+' y me gustaría ayudarte.'):'';
  const existing=crmMap[id]?crmMap[id].data:null;
  const etapaActual=(existing&&existing.etapa)?existing.etapa:'Nuevo';
  const auto={id,fecha_captura:pick(lead.fecha_captura),nombre,telefono:tel,email,evento:pick(lead.evento),fecha_evento:pick(lead.fecha_evento),personas:pick(lead.personas),paquete:pick(lead.paquete),fuente,canal:canalFn(fuente),campana:campanaFn(fuente),temperatura:t,score:sc,proxima_accion:accionFn(t,etapaActual,Boolean(tel),Boolean(email)),fecha_proxima_accion:t==='CALIENTE'?addDays(0):t==='TIBIO'?addDays(1):addDays(3),dias_sin_contacto:diasSin,whatsapp_link:tel?'https://wa.me/'+tel+'?text='+wa:'',llamar_link:tel?'tel:+'+tel:'',email_link:email?'mailto:'+email+'?subject=Seguimiento%20La%20Caba%C3%B1a%20Eventos':'',cotizacion_link:'https://lacabanaeventos.com/cotizador.html',mensaje:pick(lead.mensaje)};
  const finalRow=CRM_COLS.map(col=>{if(MANUAL.has(col)){if(existing&&existing[col]!=null&&existing[col]!=='')return String(existing[col]);if(col==='etapa')return 'Nuevo';if(col==='resultado')return 'En proceso';if(col==='whatsapp_contactado')return 'No';return '';}const v=auto[col];return String(v==null?'':v);});
  if(existing&&!needsMigration){toUpdate.push({range:'CRM!A'+crmMap[id].sheetRow+':'+LAST_COL+crmMap[id].sheetRow,values:[finalRow]});}
  else{toAppend.push(finalRow);}
}

return [{json:{
  leadsCount:leads.length,updateCount:toUpdate.length,appendCount:toAppend.length,
  needsMigration,lastCol:LAST_COL,crmCols:CRM_COLS,
  batchData:{valueInputOption:'USER_ENTERED',data:toUpdate},
  appendRows:toAppend
}}];
`;

const CREDS = { googleSheetsOAuth2Api: { id: 'google-sheets-cred', name: 'Google Sheets account' } };

const workflow = {
  name: 'Flujo 8 — CRM Upsert (automático cada hora)',
  nodes: [
    {
      id: 'schedule-crm',
      name: 'Schedule — Cada hora',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [240, 300],
      parameters: {
        rule: { interval: [{ field: 'hours', hoursInterval: 1 }] }
      }
    },
    {
      id: 'http-leer-leads',
      name: 'Leer Leads',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [460, 300],
      credentials: CREDS,
      parameters: {
        method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/Leads`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        options: {}
      }
    },
    {
      id: 'http-leer-crm',
      name: 'Leer CRM',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [680, 300],
      credentials: CREDS,
      parameters: {
        method: 'GET',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/CRM`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        options: {}
      }
    },
    {
      id: 'code-upsert',
      name: 'Calcular Upsert',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [900, 300],
      parameters: { jsCode: UPSERT_CODE }
    },
    {
      id: 'http-batch-update',
      name: 'Actualizar CRM',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1120, 300],
      continueOnFail: true,
      credentials: CREDS,
      parameters: {
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values:batchUpdate`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: '={{ JSON.stringify($json.batchData) }}',
        options: {}
      }
    },
    {
      id: 'http-append-leads',
      name: 'Agregar Leads Nuevos',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1340, 300],
      continueOnFail: true,
      credentials: CREDS,
      parameters: {
        method: 'POST',
        url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}/values/CRM:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleSheetsOAuth2Api',
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: `={{ JSON.stringify({ values: $('Calcular Upsert').first().json.appendRows }) }}`,
        options: {}
      }
    }
  ],
  connections: {
    'Schedule — Cada hora': { main: [[{ node: 'Leer Leads',        type: 'main', index: 0 }]] },
    'Leer Leads':           { main: [[{ node: 'Leer CRM',          type: 'main', index: 0 }]] },
    'Leer CRM':             { main: [[{ node: 'Calcular Upsert',   type: 'main', index: 0 }]] },
    'Calcular Upsert':      { main: [[{ node: 'Actualizar CRM',    type: 'main', index: 0 }]] },
    'Actualizar CRM':       { main: [[{ node: 'Agregar Leads Nuevos', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1', saveManualExecutions: true },
  staticData: null
};

async function main() {
  await api('POST', `/api/v1/workflows/${WF_ID}/deactivate`, null);
  console.log('Desactivado...');

  const r = await api('PUT', `/api/v1/workflows/${WF_ID}`, {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: null
  });
  console.log('PUT status:', r.s);
  if (r.s !== 200) { console.error('Error:', r.b.slice(0, 500)); return; }
  console.log('Flujo 8 actualizado ✅');

  const act = await api('POST', `/api/v1/workflows/${WF_ID}/activate`, null);
  const actR = JSON.parse(act.b);
  console.log('Activo:', actR.active);
  if (!actR.active) { console.error('Error activar:', act.b.slice(0, 300)); }
}

main().catch(console.error);
