/**
 * setup-formato-crm.js — La Cabaña Eventos
 *
 * Configura el CRM visualmente: colores por etapa, temperatura,
 * encabezado guinda, fila congelada, columnas ajustadas.
 *
 * Ejecutar UNA VEZ (o cada vez que quieras resetear el formato):
 *   node setup-formato-crm.js
 */
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const https = require('https');

const DB    = 'C:/Users/studi/.n8n/database.sqlite';
const KEY   = 'P+y9luag7NDGT4D1eRw5JMs65apHctE8';
const SHEET = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';
const NCOLS = 35; // número de columnas del CRM

/* ── Desencriptado ──────────────────────────────────────────────── */
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

/* ── API helper (trabaja con /v4/spreadsheets/{id}...) ────────────*/
function apiReq(path, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'sheets.googleapis.com',
      path: '/v4/spreadsheets/' + SHEET + path,
      method: body ? 'POST' : 'GET',
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

/* ── Utilidades de color ────────────────────────────────────────── */
function rgb(hex) {
  return {
    red  : parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue : parseInt(hex.slice(5, 7), 16) / 255
  };
}
function white() { return { red: 1, green: 1, blue: 1 }; }
function black() { return { red: 0, green: 0, blue: 0 }; }

/* ── Definiciones de colores ────────────────────────────────────── */
// Etapa → color fondo de toda la fila (columna O = índice 14)
const ETAPA_COLORES = [
  { etapa: 'Nuevo',              bg: '#ECEFF1', fg: null },
  { etapa: 'Contactado',         bg: '#E3F2FD', fg: null },
  { etapa: 'Cotización enviada', bg: '#BBDEFB', fg: null },
  { etapa: 'Visita agendada',    bg: '#FFF9C4', fg: null },
  { etapa: 'Adelanto recibido',  bg: '#FFE0B2', fg: null },
  { etapa: 'Contrato firmado',   bg: '#C8E6C9', fg: null },
  { etapa: 'Menú enviado',       bg: '#A5D6A7', fg: null },
  { etapa: 'Menú registrado',    bg: '#4CAF50', fg: '#FFFFFF' },
  { etapa: 'Ganado',             bg: '#1B5E20', fg: '#FFFFFF' },
  { etapa: 'Perdido',            bg: '#FFCDD2', fg: null }
];

// Temperatura → color solo en la celda de temperatura (columna M = índice 12)
const TEMP_COLORES = [
  { val: 'CALIENTE', bg: '#C62828', fg: '#FFFFFF' },
  { val: 'TIBIO',    bg: '#E65100', fg: '#FFFFFF' },
  { val: 'FRÍO',     bg: '#1565C0', fg: '#FFFFFF' }
];

async function main() {
  // Token
  const db = new DatabaseSync(DB);
  const cred = db.prepare("SELECT data FROM credentials_entity WHERE id='google-sheets-cred'").get();
  db.close();
  const token = dec(cred.data).oauthTokenData.access_token;
  console.log('Token OK. Obteniendo metadata del spreadsheet...');

  // Obtener GID de la pestaña CRM
  const meta = await apiReq('', token, null);
  if (!meta.body.sheets) { console.error('No se pudo leer metadata:', JSON.stringify(meta.body).slice(0, 200)); return; }
  const crmSheet = meta.body.sheets.find(s => s.properties.title === 'CRM');
  if (!crmSheet) { console.error('Pestaña CRM no encontrada'); return; }
  const sheetId = crmSheet.properties.sheetId;
  console.log('CRM sheetId:', sheetId);

  const requests = [];

  // 1. Borrar todas las reglas de formato condicional existentes en CRM
  requests.push({ deleteConditionalFormatRule: { sheetId, index: 0 } });
  // (se ignora el error si no había reglas — las borramos de a una; lo hacemos manualmente con clearRequests aparte)

  // 2. Formato encabezado (fila 1): guinda con texto blanco negrita
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: NCOLS },
      cell: {
        userEnteredFormat: {
          backgroundColor: rgb('#6B1223'),
          textFormat: { foregroundColor: white(), bold: true, fontSize: 10 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'CLIP'
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
    }
  });

  // 3. Congelar primera fila
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount'
    }
  });

  // 4. Formato condicional por ETAPA (fila completa, basado en columna O)
  // columna O = índice 14 (0-based), letra 'O'
  // La fórmula CUSTOM_FORMULA se evalúa usando la primera celda del rango:
  // el rango empieza en fila 2 (índice 1), por eso la fórmula referencia $O2
  const dataRange = {
    sheetId,
    startRowIndex: 1, endRowIndex: 1000,
    startColumnIndex: 0, endColumnIndex: NCOLS
  };

  ETAPA_COLORES.forEach((item, idx) => {
    const fmt = { backgroundColor: rgb(item.bg) };
    if (item.fg) fmt.textFormat = { foregroundColor: rgb(item.fg) };
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [dataRange],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: '=$O2="' + item.etapa + '"' }]
            },
            format: fmt
          }
        },
        index: idx
      }
    });
  });

  // 5. Formato condicional por TEMPERATURA (solo celda de temperatura, columna M = índice 12)
  const tempRange = {
    sheetId,
    startRowIndex: 1, endRowIndex: 1000,
    startColumnIndex: 12, endColumnIndex: 13
  };
  TEMP_COLORES.forEach((item, idx) => {
    requests.push({
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

  // 6. Ajustar ancho de columnas automáticamente
  requests.push({
    autoResizeDimensions: {
      dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: NCOLS }
    }
  });

  // 7. Fijar altura de encabezado
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 35 },
      fields: 'pixelSize'
    }
  });

  // Primero borramos reglas de formato condicional existentes (puede haber 0-N)
  // Para evitar error si no hay reglas, hacemos una llamada aparte para limpiar
  console.log('Limpiando formatos condicionales existentes...');
  const existingRules = crmSheet.conditionalFormats || [];
  if (existingRules.length > 0) {
    const deleteReqs = existingRules.map((_, i) => ({
      deleteConditionalFormatRule: { sheetId, index: 0 } // siempre índice 0 porque cada delete corre el índice
    }));
    const delResp = await apiReq(':batchUpdate', token, { requests: deleteReqs });
    console.log('Reglas anteriores borradas:', delResp.status === 200 ? '✅' : 'status ' + delResp.status);
  }

  // Aplicar todos los formatos (sin el deleteConditionalFormatRule inicial)
  const finalRequests = requests.filter(r => !r.deleteConditionalFormatRule);
  console.log('Aplicando', finalRequests.length, 'operaciones de formato...');
  const resp = await apiReq(':batchUpdate', token, { requests: finalRequests });

  if (resp.status === 200) {
    console.log('\n✅ Formato CRM configurado correctamente');
    console.log('\nEtapas y colores:');
    ETAPA_COLORES.forEach(e => console.log('  ' + e.bg + '  →  ' + e.etapa));
    console.log('\nTemperaturas:');
    TEMP_COLORES.forEach(t => console.log('  ' + t.bg + '  →  ' + t.val));
  } else {
    console.error('Error aplicando formato:', JSON.stringify(resp.body).slice(0, 400));
  }
}

main().catch(console.error);
