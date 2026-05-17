/**
 * actualizar-crm-upsert.js — La Cabaña Eventos
 *
 * UPSERT real: nunca borra el CRM.
 *   · Leads nuevos → se agregan al final
 *   · Leads existentes → se actualizan solo campos auto-calculados
 *     (score, temperatura, proxima_accion, links)
 *   · Campos manuales siempre se preservan:
 *     etapa, contactos, pipeline, resultado, notas
 *
 * Primera ejecución: detecta estructura antigua y migra automáticamente.
 *
 * Uso: node actualizar-crm-upsert.js
 */
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const https = require('https');

const DB    = 'C:/Users/studi/.n8n/database.sqlite';
const KEY   = 'P+y9luag7NDGT4D1eRw5JMs65apHctE8';
const SHEET = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';

/* ── Desencriptado OAuth ─────────────────────────────────────────── */
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
// Encripta de vuelta con el mismo formato que usa n8n (AES-256-CBC + EVP)
function encData(data) {
  const salt = crypto.randomBytes(8);
  const { key, iv } = evp(KEY, salt, 32, 16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(data), 'utf8')), cipher.final()]);
  return Buffer.concat([Buffer.from('Salted__', 'utf8'), salt, encrypted]).toString('base64');
}
function refreshOAuth(clientId, clientSecret, refreshToken) {
  return new Promise((resolve, reject) => {
    const body = 'client_id=' + encodeURIComponent(clientId) + '&client_secret=' + encodeURIComponent(clientSecret) + '&refresh_token=' + encodeURIComponent(refreshToken) + '&grant_type=refresh_token';
    const opts = { hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, res => { let o = ''; res.on('data', c => o += c); res.on('end', () => resolve(JSON.parse(o))); });
    req.on('error', reject); req.write(body); req.end();
  });
}
async function getToken() {
  const db = new DatabaseSync(DB);
  const row = db.prepare("SELECT data FROM credentials_entity WHERE id='google-sheets-cred'").get();
  const cred = dec(row.data);
  const tok = cred.oauthTokenData;
  if (Date.now() >= (tok.expiry_date || 0) - 300000) {
    // Refrescar y GUARDAR en la DB para que dure otra hora sin tener que refrescar
    const fresh = await refreshOAuth(cred.clientId, cred.clientSecret, tok.refresh_token);
    if (fresh.error) { db.close(); console.error('Error refresh:', fresh.error); process.exit(1); }
    cred.oauthTokenData.access_token = fresh.access_token;
    cred.oauthTokenData.expiry_date  = Date.now() + (fresh.expires_in * 1000);
    if (fresh.refresh_token) cred.oauthTokenData.refresh_token = fresh.refresh_token;
    db.prepare("UPDATE credentials_entity SET data=? WHERE id='google-sheets-cred'").run(encData(cred));
    db.close();
    return fresh.access_token;
  }
  db.close();
  return tok.access_token;
}

/* ── Sheets API ─────────────────────────────────────────────────── */
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
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(o) }); }
        catch (e) { resolve({ status: res.statusCode, body: o }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/* ── Columnas del CRM ───────────────────────────────────────────── */
const CRM_COLS = [
  'id', 'fecha_captura', 'nombre', 'telefono', 'email',
  'evento', 'fecha_evento', 'personas', 'paquete',
  'fuente', 'canal', 'campana',
  'temperatura', 'score', 'etapa',
  'email_1_fecha', 'email_2_fecha', 'email_3_fecha',
  'whatsapp_contactado',
  'cotizacion_enviada', 'visita_agendada',
  'adelanto_fecha', 'contrato_fecha',
  'menu_enviado', 'menu_registrado', 'resultado',
  'proxima_accion', 'fecha_proxima_accion', 'dias_sin_contacto',
  'whatsapp_link', 'llamar_link', 'email_link', 'cotizacion_link',
  'notas', 'mensaje'
];

// Campos que el usuario edita manualmente → NUNCA sobrescribir
const MANUAL = new Set([
  'etapa', 'email_1_fecha', 'email_2_fecha', 'email_3_fecha',
  'whatsapp_contactado', 'cotizacion_enviada', 'visita_agendada',
  'adelanto_fecha', 'contrato_fecha', 'menu_enviado', 'menu_registrado',
  'resultado', 'notas'
]);

// Calcula la letra de columna Sheets (índice 0-based → 'A', 'B', ..., 'AI')
function colLetter(i) {
  let s = ''; i++;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}
const LAST_COL = colLetter(CRM_COLS.length - 1); // 'AI' para 35 columnas

/* ── Funciones de proceso ───────────────────────────────────────── */
const now = new Date();
function clean(v) { return String(v == null ? '' : v).trim(); }
function pick() {
  for (let i = 0; i < arguments.length; i++) {
    const t = clean(arguments[i]); if (t) return t;
  }
  return '';
}
function fone(v) {
  const d = clean(v).replace(/\D/g, '');
  if (!d) return '';
  return d.length === 10 ? '52' + d : d;
}
function parseDate(v) {
  const t = clean(v);
  if (!t || t.toLowerCase().includes('no especific')) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const mx = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mx) return new Date(+mx[3], +mx[2] - 1, +mx[1]);
  const p = new Date(t); return isNaN(p) ? null : p;
}
function days(a, b) { return (!a || !b) ? '' : Math.floor((b - a) / 86400000); }
function addDays(d) {
  const x = new Date(now); x.setDate(x.getDate() + d);
  return x.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
}
function canalFn(f) {
  const s = clean(f).toLowerCase();
  if (s.includes('facebook') || s.includes('meta')) return 'Facebook / Meta';
  if (s.includes('instagram')) return 'Instagram';
  if (s.includes('tiktok')) return 'TikTok';
  if (s.includes('sitio') || s.includes('website') || s.includes('web') || s.includes('cotizar')) return 'Sitio web';
  if (s.includes('whatsapp')) return 'WhatsApp';
  return 'Otro';
}
function campanaFn(f) {
  const p = clean(f).split('/').map(x => x.trim()).filter(Boolean);
  return p[2] || p[0] || '';
}
function scoreFn(row) {
  let s = 0;
  const tel = fone(row.telefono || '');
  const ev = clean(row.evento || '').toLowerCase();
  const pers = Number(clean(row.personas || '').replace(/\D/g, '')) || 0;
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
function tempFn(s) { return s >= 75 ? 'CALIENTE' : s >= 45 ? 'TIBIO' : 'FRÍO'; }
function accionFn(t, etapa, tel, em) {
  const e = clean(etapa).toLowerCase();
  if (['adelanto recibido','contrato firmado','menú enviado','menú registrado','ganado'].some(x => e.includes(x.split(' ')[0]))) {
    return 'Mantener / preparar evento';
  }
  if (e === 'perdido') return 'Lead perdido — archivar';
  if (t === 'CALIENTE' && tel) return 'Llamar hoy + WhatsApp';
  if (t === 'TIBIO' && tel) return 'WhatsApp hoy';
  if (em) return 'Enviar email de seguimiento';
  return 'Revisar datos manualmente';
}

// Normaliza etapas de estructura antigua a las nuevas
function normalizeEtapa(e) {
  const s = clean(e).toLowerCase();
  if (!s || s === 'nuevo') return 'Nuevo';
  if (s.includes('contact')) return 'Contactado';
  if (s.includes('cotiz')) return 'Cotización enviada';
  if (s.includes('visit')) return 'Visita agendada';
  if (s.includes('adelant') || s.includes('anticip')) return 'Adelanto recibido';
  if (s.includes('contrat')) return 'Contrato firmado';
  if (s.includes('menu') && s.includes('env')) return 'Menú enviado';
  if (s.includes('menu') && s.includes('reg')) return 'Menú registrado';
  if (s.includes('ganad') || s.includes('cerrado') || s.includes('realizado')) return 'Ganado';
  if (s.includes('perdid')) return 'Perdido';
  return e || 'Nuevo';
}

/* ── Main ───────────────────────────────────────────────────────── */
async function main() {
  const token = await getToken();
  console.log('Token OK.');

  // Leer Leads
  const leadsResp = await sheetsReq('GET', '/values/Leads', token);
  if (leadsResp.body.error) { console.error('Error Leads:', leadsResp.body.error.message); return; }
  const leadsVals = leadsResp.body.values || [];
  const lHdr = leadsVals[0] || [];
  const leads = leadsVals.slice(1).map(row => {
    const o = {}; lHdr.forEach((h, i) => { o[h] = row[i] || ''; }); return o;
  }).filter(r => pick(r.id) && pick(r.nombre, r.full_name, r.name) !== '(click sin formulario)');
  console.log('Leads en hoja:', leads.length);

  // Leer CRM existente
  const crmResp = await sheetsReq('GET', '/values/CRM', token);
  const crmVals = crmResp.body.values || [];
  const crmHdr = crmVals[0] || [];

  const isOldStructure = crmHdr.length > 0 && (
    crmHdr.includes('status') ||
    crmHdr.includes('whatsapp') ||
    crmHdr.includes('llamar') ||
    !crmHdr.includes('email_1_fecha')
  );
  const needsMigration = JSON.stringify(crmHdr) !== JSON.stringify(CRM_COLS);

  if (needsMigration) {
    console.log('⚠️  Estructura antigua o nueva instalación — se ejecutará migración completa');
  } else {
    console.log('Estructura CRM: correcta ✅  |  Modo: UPSERT (nunca borra)');
  }
  console.log('CRM filas existentes:', Math.max(0, crmVals.length - 1));

  // Construir mapa: id → { sheetRow (1-based en Sheets), data (campos con nombres nuevos) }
  const crmMap = {};
  crmVals.slice(1).forEach((row, idx) => {
    const o = {};
    crmHdr.forEach((h, i) => { o[h] = row[i] || ''; });
    // Mapear nombres de columnas antiguas a nuevas
    if (!o.etapa && o.status) o.etapa = o.status;
    if (!o.email_1_fecha && o.ultimo_email) o.email_1_fecha = o.ultimo_email;
    if (!o.whatsapp_link && o.whatsapp) o.whatsapp_link = o.whatsapp;
    if (!o.llamar_link && o.llamar) o.llamar_link = o.llamar;
    if (o.etapa) o.etapa = normalizeEtapa(o.etapa);
    if (!o.resultado) o.resultado = 'En proceso';
    if (!o.whatsapp_contactado) o.whatsapp_contactado = 'No';
    if (o.id) crmMap[o.id] = { sheetRow: idx + 2, data: o };
  });

  // Procesar leads
  const toUpdate = [];  // [{ range, values: [[...]] }] para batchUpdate
  const toAppend = [];  // [[...]] para append
  let cntUpdate = 0, cntNew = 0;

  // Ordenar más recientes primero
  const sorted = [...leads].sort((a, b) => {
    const da = parseDate(a.fecha_captura), db2 = parseDate(b.fecha_captura);
    return (db2 ? db2.getTime() : 0) - (da ? da.getTime() : 0);
  });

  for (const lead of sorted) {
    const id = pick(lead.id); if (!id) continue;

    const nombre  = pick(lead.nombre, lead.full_name, lead.name, 'Sin nombre');
    const tel     = fone(lead.telefono || lead.phone || '');
    const email   = pick(lead.email, lead.correo);
    const fuente  = pick(lead.fuente, 'Sin fuente');
    const created = parseDate(lead.fecha_captura);
    const sc      = scoreFn(lead);
    const t       = tempFn(sc);
    const diasSin = created ? Math.max(0, days(created, now)) : '';

    const wa = tel
      ? encodeURIComponent('Hola ' + nombre + ', soy de La Cabaña Eventos. Recibimos tu solicitud para ' + pick(lead.evento, 'tu evento') + ' y me gustaría ayudarte.')
      : '';

    const existing = crmMap[id] ? crmMap[id].data : null;
    const etapaActual = (existing && existing.etapa) ? existing.etapa : 'Nuevo';

    // Campos auto-calculados
    const auto = {
      id,
      fecha_captura : pick(lead.fecha_captura),
      nombre, telefono: tel, email,
      evento        : pick(lead.evento),
      fecha_evento  : pick(lead.fecha_evento),
      personas      : pick(lead.personas),
      paquete       : pick(lead.paquete),
      fuente, canal: canalFn(fuente), campana: campanaFn(fuente),
      temperatura   : t,
      score         : sc,
      proxima_accion       : accionFn(t, etapaActual, Boolean(tel), Boolean(email)),
      fecha_proxima_accion : t === 'CALIENTE' ? addDays(0) : t === 'TIBIO' ? addDays(1) : addDays(3),
      dias_sin_contacto    : diasSin,
      whatsapp_link  : tel   ? 'https://wa.me/' + tel + '?text=' + wa : '',
      llamar_link    : tel   ? 'tel:+' + tel : '',
      email_link     : email ? 'mailto:' + email + '?subject=Seguimiento%20La%20Caba%C3%B1a%20Eventos' : '',
      cotizacion_link: 'https://lacabanaeventos.com/cotizador.html',
      mensaje        : pick(lead.mensaje)
    };

    // Construir fila final: auto + manuales (preservar existentes o poner defaults)
    const finalRow = CRM_COLS.map(col => {
      if (MANUAL.has(col)) {
        if (existing && existing[col] != null && existing[col] !== '') {
          return String(existing[col]);
        }
        // Defaults para lead nuevo
        if (col === 'etapa')               return 'Nuevo';
        if (col === 'resultado')           return 'En proceso';
        if (col === 'whatsapp_contactado') return 'No';
        return '';
      }
      const v = auto[col];
      return String(v == null ? '' : v);
    });

    if (existing && !needsMigration) {
      // UPSERT: actualizar fila existente en su posición
      cntUpdate++;
      toUpdate.push({
        range : 'CRM!A' + crmMap[id].sheetRow + ':' + LAST_COL + crmMap[id].sheetRow,
        values: [finalRow]
      });
    } else {
      // Nuevo lead (o migración)
      cntNew++;
      toAppend.push(finalRow);
    }
  }

  console.log('A actualizar:', cntUpdate, ' | A agregar:', cntNew);

  // ── Ruta A: Migración (primera vez o cambio de estructura) ──────
  if (needsMigration) {
    console.log('\n⚙  Migrando CRM a nueva estructura...');
    await sheetsReq('POST', '/values/CRM!A1:AZ1000:clear', token, {});

    const hResp = await sheetsReq(
      'PUT', '/values/CRM!A1:' + LAST_COL + '1?valueInputOption=USER_ENTERED',
      token, { values: [CRM_COLS] }
    );
    console.log('Encabezados escritos:', hResp.status === 200 ? '✅' : 'Error ' + hResp.status);

    if (toAppend.length > 0) {
      const aResp = await sheetsReq(
        'POST', '/values/CRM:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
        token, { values: toAppend }
      );
      if (aResp.body.updates) {
        console.log('Migración completa ✅  Filas escritas:', aResp.body.updates.updatedRows);
      } else {
        console.error('Error en migración:', JSON.stringify(aResp.body).slice(0, 300));
      }
    } else {
      console.log('Sin datos para migrar (Leads vacío).');
    }
    return;
  }

  // ── Ruta B: Upsert normal ───────────────────────────────────────
  // Actualizar filas existentes en lotes de 50
  if (toUpdate.length > 0) {
    for (let i = 0; i < toUpdate.length; i += 50) {
      const batch = toUpdate.slice(i, i + 50);
      const bResp = await sheetsReq('POST', '/values:batchUpdate', token, {
        valueInputOption: 'USER_ENTERED',
        data: batch
      });
      if (bResp.body.totalUpdatedRows !== undefined) {
        console.log('Actualizadas:', bResp.body.totalUpdatedRows, 'filas ✅');
      } else if (bResp.body.error) {
        console.error('Error actualizar:', bResp.body.error.message);
      } else {
        console.log('batchUpdate:', JSON.stringify(bResp.body).slice(0, 200));
      }
    }
  }

  // Agregar leads nuevos al final
  if (toAppend.length > 0) {
    const aResp = await sheetsReq(
      'POST', '/values/CRM:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
      token, { values: toAppend }
    );
    if (aResp.body.updates) {
      console.log('Nuevos leads agregados ✅:', aResp.body.updates.updatedRows, 'filas');
    } else {
      console.error('Error append:', JSON.stringify(aResp.body).slice(0, 300));
    }
  }

  if (toUpdate.length === 0 && toAppend.length === 0) {
    console.log('✅ CRM ya estaba al día — sin cambios.');
  }
}

main().catch(console.error);
