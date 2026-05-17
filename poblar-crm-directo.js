/**
 * Lee la pestaña Leads directamente desde Sheets API
 * y escribe el CRM calculado — sin pasar por n8n
 */
const {DatabaseSync} = require('node:sqlite');
const crypto = require('crypto');
const https = require('https');

const DB = 'C:/Users/studi/.n8n/database.sqlite';
const KEY = 'P+y9luag7NDGT4D1eRw5JMs65apHctE8';
const SHEET = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';

function evp(pw, salt, kl, il) {
  const p = Buffer.from(pw, 'utf8');
  let d = Buffer.alloc(0), prev = Buffer.alloc(0);
  while (d.length < kl + il) {
    const h = crypto.createHash('md5');
    h.update(prev); h.update(p); h.update(salt);
    prev = h.digest(); d = Buffer.concat([d, prev]);
  }
  return { key: d.slice(0, kl), iv: d.slice(kl, kl + il) };
}
function dec(enc) {
  const r = Buffer.from(enc, 'base64');
  const s = r.slice(8, 16), da = r.slice(16);
  const { key, iv } = evp(KEY, s, 32, 16);
  const d = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return JSON.parse(Buffer.concat([d.update(da), d.final()]).toString('utf8'));
}

function sheetsReq(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'sheets.googleapis.com',
      path: '/v4/spreadsheets/' + SHEET + path,
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    const req = https.request(opts, res => {
      let o = ''; res.on('data', c => o += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(o) }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// CRM processing functions
const now = new Date();
const CRM_COLS = ['id','fecha_captura','nombre','telefono','email','evento','fecha_evento','personas','paquete','fuente','canal','campana','temperatura','score','etapa','proxima_accion','fecha_proxima_accion','dias_sin_contacto','status','ultimo_email','whatsapp','llamar','email_link','cotizacion_link','notas','mensaje'];

function clean(v) { return String(v == null ? '' : v).trim(); }
function pick() { for (let i = 0; i < arguments.length; i++) { const t = clean(arguments[i]); if (t) return t; } return ''; }
function fone(v) { const d = clean(v).replace(/\D/g,''); if (!d) return ''; return d.length === 10 ? '52' + d : d; }
function parseDate(v) {
  const t = clean(v);
  if (!t || t.toLowerCase().includes('no especific')) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2]-1, +iso[3]);
  const mx = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mx) return new Date(+mx[3], +mx[2]-1, +mx[1]);
  const p = new Date(t);
  return isNaN(p) ? null : p;
}
function days(a, b) { return (!a || !b) ? '' : Math.floor((b - a) / 86400000); }
function addDays(d) { const x = new Date(now); x.setDate(x.getDate() + d); return x.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' }); }
function canalFn(f) {
  const s = clean(f).toLowerCase();
  if (s.includes('facebook') || s.includes('meta')) return 'Facebook / Meta';
  if (s.includes('instagram')) return 'Instagram';
  if (s.includes('tiktok')) return 'TikTok';
  if (s.includes('sitio') || s.includes('website') || s.includes('web') || s.includes('cotizar')) return 'Sitio web';
  if (s.includes('whatsapp')) return 'WhatsApp';
  return 'Otro';
}
function campanaFn(f) { const p = clean(f).split('/').map(x => x.trim()).filter(Boolean); return p[2] || p[0] || ''; }
function scoreFn(row) {
  let s = 0;
  const tel = fone(row.telefono || '');
  const ev = clean(row.evento || '').toLowerCase();
  const pers = Number(clean(row.personas || '').replace(/\D/g,'')) || 0;
  const fd = parseDate(row.fecha_evento);
  const dt = fd ? days(now, fd) : null;
  if (tel) s += 25;
  if (clean(row.email || '')) s += 10;
  if (ev && !ev.includes('no especific')) s += 15;
  if (fd) s += 15;
  if (clean(row.paquete || '')) s += 10;
  if (pers >= 100) s += 15; else if (pers >= 50) s += 8;
  if (dt !== null && dt >= 0 && dt <= 120) s += 15;
  if (ev.includes('boda') || ev.includes('xv') || ev.includes('quince')) s += 10;
  return Math.min(s, 100);
}
function tempFn(s) { return s >= 75 ? 'CALIENTE' : s >= 45 ? 'TIBIO' : 'FRIO'; }
function accionFn(t, st, tel, em) {
  const s = clean(st).toLowerCase();
  if (['anticipo','confirmado','realizado','cerrado'].includes(s)) return 'Mantener / preparar evento';
  if (t === 'CALIENTE' && tel) return 'Llamar hoy + WhatsApp';
  if (t === 'TIBIO' && tel) return 'WhatsApp hoy';
  if (em) return 'Enviar email de seguimiento';
  return 'Revisar datos manualmente';
}

async function main() {
  const db2 = new DatabaseSync(DB);
  const cred = db2.prepare("SELECT data FROM credentials_entity WHERE id='google-sheets-cred'").get();
  db2.close();
  const credData = dec(cred.data);
  const token = credData.oauthTokenData.access_token;
  console.log('Token obtenido. Leyendo Leads...');

  // 1. Read Leads
  const leadsResp = await sheetsReq('GET', '/values/Leads', token);
  if (leadsResp.body.error) { console.error('Error leyendo Leads:', leadsResp.body.error.message); return; }
  const leadsVals = leadsResp.body.values || [];
  const lHeaders = leadsVals[0] || [];
  const leads = leadsVals.slice(1).map(row => {
    const o = {};
    lHeaders.forEach((h, i) => { o[h] = row[i] || ''; });
    return o;
  }).filter(r => pick(r.id) && pick(r.nombre, r.full_name, r.name) !== '(click sin formulario)');
  console.log('Leads leídos:', leads.length);

  // 2. Read existing CRM (preserve notas)
  const crmResp = await sheetsReq('GET', '/values/CRM', token);
  const crmVals = crmResp.body.values || [];
  const crmHeaders = crmVals[0] || [];
  const notasIdx = crmHeaders.indexOf('notas');
  const oldNotas = {};
  crmVals.slice(1).forEach(row => { if (row[0] && notasIdx >= 0) oldNotas[row[0]] = row[notasIdx] || ''; });
  console.log('CRM existente filas:', crmVals.length - 1);

  // 3. Process leads → CRM rows
  const sorted = leads.sort((a, b) => {
    const da = parseDate(a.fecha_captura);
    const db = parseDate(b.fecha_captura);
    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
  }).slice(0, 100);

  const crmRows = sorted.map(row => {
    const id = pick(row.id);
    const nombre = pick(row.nombre, row.full_name, row.name, 'Sin nombre');
    const tel = fone(row.telefono || row.phone || '');
    const email = pick(row.email, row.correo);
    const status = pick(row.status, 'nuevo');
    const fuente = pick(row.fuente, 'Sin fuente');
    const created = parseDate(row.fecha_captura);
    const diasSin = row.ultimo_email ? 0 : (created ? Math.max(0, days(created, now)) : '');
    const sc = scoreFn(row);
    const t = tempFn(sc);
    const wa = tel ? encodeURIComponent('Hola ' + nombre + ', soy de La Cabaña Eventos. Recibimos tu solicitud para ' + pick(row.evento, 'tu evento') + ' y me gustaría ayudarte.') : '';
    const m = {
      id, fecha_captura: pick(row.fecha_captura), nombre, telefono: tel, email,
      evento: pick(row.evento), fecha_evento: pick(row.fecha_evento), personas: pick(row.personas),
      paquete: pick(row.paquete), fuente, canal: canalFn(fuente), campana: campanaFn(fuente),
      temperatura: t, score: sc, etapa: status,
      proxima_accion: accionFn(t, status, Boolean(tel), Boolean(email)),
      fecha_proxima_accion: t === 'CALIENTE' ? addDays(0) : t === 'TIBIO' ? addDays(1) : addDays(3),
      dias_sin_contacto: diasSin, status, ultimo_email: pick(row.ultimo_email),
      whatsapp: tel ? 'https://wa.me/' + tel + '?text=' + wa : '',
      llamar: tel ? 'tel:+' + tel : '',
      email_link: email ? 'mailto:' + email + '?subject=Seguimiento%20La%20Caba%C3%B1a%20Eventos' : '',
      cotizacion_link: 'https://lacabanaeventos.com/cotizador.html',
      notas: oldNotas[id] || '', mensaje: pick(row.mensaje)
    };
    return CRM_COLS.map(col => String(m[col] == null ? '' : m[col]));
  });
  console.log('Filas CRM calculadas:', crmRows.length);

  // 4. Clear CRM data rows
  console.log('Limpiando CRM!A2:Z1000...');
  const clearResp = await sheetsReq('POST', '/values/CRM!A2:Z1000:clear', token, {});
  console.log('Clear status:', clearResp.status, clearResp.body.clearedRange || clearResp.body.error);

  // 5. Append all CRM rows
  console.log('Escribiendo', crmRows.length, 'filas...');
  const appendResp = await sheetsReq('POST', '/values/CRM:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS', token, { values: crmRows });
  console.log('Append status:', appendResp.status);
  if (appendResp.body.updates) {
    console.log('CRM actualizado ✅ Filas escritas:', appendResp.body.updates.updatedRows, '| Rango:', appendResp.body.updates.updatedRange);
  } else {
    console.error('Error:', JSON.stringify(appendResp.body).slice(0, 300));
  }
}

main().catch(console.error);
