/**
 * fix-formato-crm.js
 * Corrige letras blancas + reaplica formato visual del CRM
 * Incluye refresco automático de token OAuth2
 */
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const https = require('https');

const DB    = 'C:/Users/studi/.n8n/database.sqlite';
const KEY   = 'P+y9luag7NDGT4D1eRw5JMs65apHctE8';
const SHEET = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';
const NCOLS = 35;

function evp(pw,salt,kl,il){const p=Buffer.from(pw,'utf8');let d=Buffer.alloc(0),prev=Buffer.alloc(0);while(d.length<kl+il){const h=crypto.createHash('md5');h.update(prev);h.update(p);h.update(salt);prev=h.digest();d=Buffer.concat([d,prev]);}return{key:d.slice(0,kl),iv:d.slice(kl,kl+il)};}
function dec(enc){const r=Buffer.from(enc,'base64');const s=r.slice(8,16),da=r.slice(16);const{key,iv}=evp(KEY,s,32,16);const d=crypto.createDecipheriv('aes-256-cbc',key,iv);return JSON.parse(Buffer.concat([d.update(da),d.final()]).toString('utf8'));}

/* ── Refresco de token OAuth2 ────────────────────────────────────── */
function refreshOAuth(clientId, clientSecret, refreshToken) {
  return new Promise((resolve, reject) => {
    const body = [
      'client_id='     + encodeURIComponent(clientId),
      'client_secret=' + encodeURIComponent(clientSecret),
      'refresh_token=' + encodeURIComponent(refreshToken),
      'grant_type=refresh_token'
    ].join('&');
    const opts = {
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, res => {
      let o = ''; res.on('data', c => o += c);
      res.on('end', () => resolve(JSON.parse(o)));
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

function encData(data) {
  const salt = crypto.randomBytes(8);
  const { key, iv } = evp(KEY, salt, 32, 16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(data), 'utf8')), cipher.final()]);
  return Buffer.concat([Buffer.from('Salted__', 'utf8'), salt, encrypted]).toString('base64');
}
async function getToken() {
  const db = new DatabaseSync(DB);
  const row = db.prepare("SELECT data FROM credentials_entity WHERE id='google-sheets-cred'").get();
  const cred = dec(row.data);
  const tok = cred.oauthTokenData;
  if (Date.now() >= (tok.expiry_date || 0) - 300000) {
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

/* ── API helpers ─────────────────────────────────────────────────── */
function apiReq(path, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'sheets.googleapis.com',
      path: '/v4/spreadsheets/' + SHEET + path,
      method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
    };
    const req = https.request(opts, res => {
      let o = ''; res.on('data', c => o += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(o) }); } catch(e) { resolve({ status: res.statusCode, body: o }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr); req.end();
  });
}

function rgb(hex) {
  return { red: parseInt(hex.slice(1,3),16)/255, green: parseInt(hex.slice(3,5),16)/255, blue: parseInt(hex.slice(5,7),16)/255 };
}

const ETAPA_COLORES = [
  { etapa: 'Nuevo',              bg: '#ECEFF1' },
  { etapa: 'Contactado',         bg: '#E3F2FD' },
  { etapa: 'Cotización enviada', bg: '#BBDEFB' },
  { etapa: 'Visita agendada',    bg: '#FFF9C4' },
  { etapa: 'Adelanto recibido',  bg: '#FFE0B2' },
  { etapa: 'Contrato firmado',   bg: '#C8E6C9' },
  { etapa: 'Menú enviado',       bg: '#A5D6A7' },
  { etapa: 'Menú registrado',    bg: '#4CAF50', fg: '#FFFFFF' },
  { etapa: 'Ganado',             bg: '#1B5E20', fg: '#FFFFFF' },
  { etapa: 'Perdido',            bg: '#FFCDD2' }
];
const TEMP_COLORES = [
  { val: 'CALIENTE', bg: '#C62828', fg: '#FFFFFF' },
  { val: 'TIBIO',    bg: '#E65100', fg: '#FFFFFF' },
  { val: 'FRÍO',     bg: '#1565C0', fg: '#FFFFFF' }
];

async function main() {
  const token = await getToken();

  // Obtener GID de la pestaña CRM
  const meta = await apiReq('?fields=sheets.properties', token, null);
  if (!meta.body.sheets) { console.error('Error metadata:', JSON.stringify(meta.body).slice(0,200)); return; }
  const crmTab = meta.body.sheets.find(s => s.properties.title === 'CRM');
  if (!crmTab) { console.error('Pestaña CRM no encontrada'); return; }
  const sheetId = crmTab.properties.sheetId;
  console.log('CRM sheetId:', sheetId);

  const requests = [];

  // 1. PRIMERO: resetear TODA el área de datos a texto NEGRO + fondo blanco
  //    Esto elimina cualquier texto blanco heredado
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: NCOLS },
      cell: {
        userEnteredFormat: {
          textFormat: { foregroundColor: { red:0.1, green:0.1, blue:0.1 }, bold: false, fontSize: 10 },
          backgroundColor: { red:1, green:1, blue:1 },
          horizontalAlignment: 'LEFT',
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'CLIP'
        }
      },
      fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy)'
    }
  });

  // 2. Formato encabezado: guinda + texto blanco (SOLO fila 1)
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: NCOLS },
      cell: {
        userEnteredFormat: {
          backgroundColor: rgb('#6B1223'),
          textFormat: { foregroundColor: { red:1, green:1, blue:1 }, bold: true, fontSize: 10 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'CLIP'
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
    }
  });

  // 3. Congelar fila 1
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount'
    }
  });

  // 4. Altura del encabezado
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 35 },
      fields: 'pixelSize'
    }
  });

  // 5. Borrar reglas de formato condicional anteriores (si existen)
  //    Hacemos 20 intentos de borrar índice 0 — si no había, falla silencioso
  for (let i = 0; i < 20; i++) {
    requests.push({ deleteConditionalFormatRule: { sheetId, index: 0 } });
  }

  // Aplicar reset + encabezado primero (sin los delete que pueden fallar)
  const baseReqs = requests.filter(r => !r.deleteConditionalFormatRule);
  console.log('Aplicando reset de texto y encabezado...');
  const r1 = await apiReq(':batchUpdate', token, { requests: baseReqs });
  console.log('Reset:', r1.status === 200 ? '✅' : 'Error ' + r1.status, r1.status !== 200 ? JSON.stringify(r1.body).slice(0,200) : '');

  // Borrar reglas condicionales existentes (ignorar errores)
  console.log('Borrando reglas de formato condicional antiguas...');
  for (let i = 0; i < 15; i++) {
    const d = await apiReq(':batchUpdate', token, { requests: [{ deleteConditionalFormatRule: { sheetId, index: 0 } }] });
    if (d.status !== 200) break; // ya no hay más reglas
  }
  console.log('Reglas anteriores eliminadas ✅');

  // 6. Agregar formato condicional por ETAPA (toda la fila, fondo de color)
  const dataRange = { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: NCOLS };
  const condRequests = [];

  ETAPA_COLORES.forEach((item, idx) => {
    const fmt = { backgroundColor: rgb(item.bg) };
    // Solo aplicar texto blanco si hay fg definido
    if (item.fg) {
      fmt.textFormat = { foregroundColor: rgb(item.fg) };
    }
    condRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [dataRange],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$O2="' + item.etapa + '"' }] },
            format: fmt
          }
        },
        index: idx
      }
    });
  });

  // Temperatura (solo columna M = índice 12)
  const tempRange = { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 12, endColumnIndex: 13 };
  TEMP_COLORES.forEach((item, idx) => {
    condRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [tempRange],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: item.val }] },
            format: {
              backgroundColor: rgb(item.bg),
              textFormat: { foregroundColor: rgb(item.fg), bold: true }
            }
          }
        },
        index: ETAPA_COLORES.length + idx
      }
    });
  });

  // Autoajustar columnas
  condRequests.push({ autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: NCOLS } } });

  console.log('Aplicando', condRequests.length, 'reglas de formato condicional...');
  const r2 = await apiReq(':batchUpdate', token, { requests: condRequests });
  if (r2.status === 200) {
    console.log('\n✅ CRM formateado correctamente');
    console.log('Abre la hoja y verás:');
    console.log('  Encabezado: guinda oscuro con texto blanco');
    console.log('  Datos: texto negro legible, fila coloreada por etapa');
    console.log('\nEtapas configuradas:');
    ETAPA_COLORES.forEach(e => console.log('  ' + e.etapa + (e.fg ? ' (texto blanco)' : '')));
  } else {
    console.error('Error formato condicional:', JSON.stringify(r2.body).slice(0,400));
  }
}

main().catch(console.error);
