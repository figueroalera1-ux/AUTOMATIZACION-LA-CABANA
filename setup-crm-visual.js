/**
 * setup-crm-visual.js — La Cabaña Eventos
 *
 * - Colores MÁS VISIBLES por etapa (toda la fila)
 * - Menú desplegable en columna ETAPA (click → elegir etapa)
 * - Menú desplegable en RESULTADO (Ganado / Perdido / En proceso)
 * - Menú desplegable en WHATSAPP CONTACTADO (Sí / No)
 * - Temperatura con colores fuertes (CALIENTE=rojo, TIBIO=naranja, FRÍO=azul)
 * - Encabezado guinda fijo
 *
 * Ejecutar: node setup-crm-visual.js
 */
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const https  = require('https');

const DB    = 'C:/Users/studi/.n8n/database.sqlite';
const KEY   = 'P+y9luag7NDGT4D1eRw5JMs65apHctE8';
const SHEET = '1D2T7mC9xgLvfINQCUuHb_kWbsfFeVkr22OvWKqNkDCk';
const NCOLS = 35;

/* ── Crypto ─────────────────────────────────────────────────────── */
function evp(pw,salt,kl,il){const p=Buffer.from(pw,'utf8');let d=Buffer.alloc(0),prev=Buffer.alloc(0);while(d.length<kl+il){const h=crypto.createHash('md5');h.update(prev);h.update(p);h.update(salt);prev=h.digest();d=Buffer.concat([d,prev]);}return{key:d.slice(0,kl),iv:d.slice(kl,kl+il)};}
function dec(enc){const r=Buffer.from(enc,'base64');const s=r.slice(8,16),da=r.slice(16);const{key,iv}=evp(KEY,s,32,16);const d=crypto.createDecipheriv('aes-256-cbc',key,iv);return JSON.parse(Buffer.concat([d.update(da),d.final()]).toString('utf8'));}
function encData(data){const salt=crypto.randomBytes(8);const{key,iv}=evp(KEY,salt,32,16);const cipher=crypto.createCipheriv('aes-256-cbc',key,iv);const encrypted=Buffer.concat([cipher.update(Buffer.from(JSON.stringify(data),'utf8')),cipher.final()]);return Buffer.concat([Buffer.from('Salted__','utf8'),salt,encrypted]).toString('base64');}
function refreshOAuth(cid,cs,rt){return new Promise((resolve,reject)=>{const body='client_id='+encodeURIComponent(cid)+'&client_secret='+encodeURIComponent(cs)+'&refresh_token='+encodeURIComponent(rt)+'&grant_type=refresh_token';const opts={hostname:'oauth2.googleapis.com',path:'/token',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)}};const req=https.request(opts,res=>{let o='';res.on('data',c=>o+=c);res.on('end',()=>resolve(JSON.parse(o)))});req.on('error',reject);req.write(body);req.end();});}
async function getToken(){const db=new DatabaseSync(DB);const row=db.prepare("SELECT data FROM credentials_entity WHERE id='google-sheets-cred'").get();const cred=dec(row.data);const tok=cred.oauthTokenData;if(Date.now()>=(tok.expiry_date||0)-300000){const fresh=await refreshOAuth(cred.clientId,cred.clientSecret,tok.refresh_token);if(fresh.error){db.close();console.error('Error refresh:',fresh.error);process.exit(1);}cred.oauthTokenData.access_token=fresh.access_token;cred.oauthTokenData.expiry_date=Date.now()+(fresh.expires_in*1000);if(fresh.refresh_token)cred.oauthTokenData.refresh_token=fresh.refresh_token;db.prepare("UPDATE credentials_entity SET data=? WHERE id='google-sheets-cred'").run(encData(cred));db.close();return fresh.access_token;}db.close();return tok.access_token;}

/* ── API ────────────────────────────────────────────────────────── */
function apiReq(path,token,body){return new Promise((resolve,reject)=>{const bodyStr=body?JSON.stringify(body):'';const opts={hostname:'sheets.googleapis.com',path:'/v4/spreadsheets/'+SHEET+path,method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Content-Length':Buffer.byteLength(bodyStr)}};const req=https.request(opts,res=>{let o='';res.on('data',c=>o+=c);res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(o)});}catch(e){resolve({status:res.statusCode,body:o})}})});req.on('error',reject);if(bodyStr)req.write(bodyStr);req.end();});}

function rgb(hex){return{red:parseInt(hex.slice(1,3),16)/255,green:parseInt(hex.slice(3,5),16)/255,blue:parseInt(hex.slice(5,7),16)/255};}

/* ── Definiciones ───────────────────────────────────────────────── */
// Colores MÁS VISIBLES — difícil confundirlos entre sí
const ETAPAS = [
  { etapa: 'Nuevo',              bg: '#E8EAF6', fg: '#1A237E' }, // Índigo claro / texto azul oscuro
  { etapa: 'Contactado',         bg: '#E1F5FE', fg: '#01579B' }, // Celeste / texto azul
  { etapa: 'Cotización enviada', bg: '#FFF8E1', fg: '#E65100' }, // Amarillo / texto naranja
  { etapa: 'Visita agendada',    bg: '#FFF3E0', fg: '#BF360C' }, // Durazno / texto rojo
  { etapa: 'Adelanto recibido',  bg: '#FCE4EC', fg: '#880E4F' }, // Rosa / texto fucsia
  { etapa: 'Contrato firmado',   bg: '#E8F5E9', fg: '#1B5E20' }, // Verde menta / texto verde
  { etapa: 'Menú enviado',       bg: '#F9FBE7', fg: '#33691E' }, // Lima / texto verde
  { etapa: 'Menú registrado',    bg: '#43A047', fg: '#FFFFFF' }, // Verde / texto blanco
  { etapa: 'Ganado',             bg: '#1B5E20', fg: '#FFFFFF' }, // Verde oscuro / texto blanco
  { etapa: 'Perdido',            bg: '#B71C1C', fg: '#FFFFFF' }  // Rojo oscuro / texto blanco
];

const TEMPS = [
  { val: 'CALIENTE', bg: '#C62828', fg: '#FFFFFF' },
  { val: 'TIBIO',    bg: '#E65100', fg: '#FFFFFF' },
  { val: 'FRÍO',     bg: '#1565C0', fg: '#FFFFFF' }
];

// Columnas en el CRM (índice 0-based):
// A=id B=fecha_captura C=nombre D=telefono E=email F=evento G=fecha_evento H=personas I=paquete
// J=fuente K=canal L=campana M=temperatura N=score O=etapa
// P=email_1_fecha Q=email_2_fecha R=email_3_fecha S=whatsapp_contactado
// T=cotizacion_enviada U=visita_agendada V=adelanto_fecha W=contrato_fecha
// X=menu_enviado Y=menu_registrado Z=resultado
// AA=proxima_accion AB=fecha_proxima_accion AC=dias_sin_contacto
// AD=whatsapp_link AE=llamar_link AF=email_link AG=cotizacion_link AH=notas AI=mensaje

async function main() {
  const token = await getToken();
  console.log('Token OK.');

  // GID de la pestaña CRM
  const meta = await apiReq('?fields=sheets.properties', token, null);
  if (!meta.body.sheets) { console.error('Error metadata:', JSON.stringify(meta.body).slice(0,200)); return; }
  const crmTab = meta.body.sheets.find(s => s.properties.title === 'CRM');
  if (!crmTab) { console.error('Pestaña CRM no encontrada'); return; }
  const sheetId = crmTab.properties.sheetId;
  console.log('CRM sheetId:', sheetId);

  const requests = [];

  // ── 1. Reset área de datos: texto negro, fondo blanco ──────────
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: NCOLS },
      cell: {
        userEnteredFormat: {
          textFormat: { foregroundColor: rgb('#212121'), bold: false, fontSize: 10 },
          backgroundColor: { red:1, green:1, blue:1 },
          horizontalAlignment: 'LEFT',
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'CLIP'
        }
      },
      fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy)'
    }
  });

  // ── 2. Encabezado: guinda + blanco (fila 1 únicamente) ─────────
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: NCOLS },
      cell: {
        userEnteredFormat: {
          backgroundColor: rgb('#6B1223'),
          textFormat: { foregroundColor: { red:1,green:1,blue:1 }, bold: true, fontSize: 10 },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'CLIP'
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
    }
  });

  // ── 3. Congelar fila 1 ──────────────────────────────────────────
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount'
    }
  });

  // ── 4. Altura encabezado ────────────────────────────────────────
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 35 },
      fields: 'pixelSize'
    }
  });

  // ── 5. Dropdown ETAPA (columna O = índice 14) ───────────────────
  requests.push({
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 14, endColumnIndex: 15 },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: ETAPAS.map(e => ({ userEnteredValue: e.etapa }))
        },
        inputMessage: 'Selecciona la etapa del lead en el pipeline',
        showCustomUi: true,
        strict: false
      }
    }
  });

  // ── 6. Dropdown RESULTADO (columna Z = índice 25) ───────────────
  requests.push({
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 25, endColumnIndex: 26 },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: [
            { userEnteredValue: 'En proceso' },
            { userEnteredValue: 'Ganado' },
            { userEnteredValue: 'Perdido' }
          ]
        },
        inputMessage: '¿Se ganó o perdió este lead?',
        showCustomUi: true,
        strict: false
      }
    }
  });

  // ── 7. Dropdown WHATSAPP CONTACTADO (columna S = índice 18) ─────
  requests.push({
    setDataValidation: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 18, endColumnIndex: 19 },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: [
            { userEnteredValue: 'No' },
            { userEnteredValue: 'Sí' }
          ]
        },
        showCustomUi: true,
        strict: false
      }
    }
  });

  // ── 8. Autoajustar columnas ─────────────────────────────────────
  requests.push({
    autoResizeDimensions: {
      dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: NCOLS }
    }
  });

  // Aplicar todo lo anterior primero
  console.log('Aplicando formato base y dropdowns...');
  const r1 = await apiReq(':batchUpdate', token, { requests });
  if (r1.status !== 200) {
    console.error('Error formato base:', JSON.stringify(r1.body).slice(0,300));
    return;
  }
  console.log('Formato base ✅');

  // ── 9. Borrar reglas de formato condicional anteriores ──────────
  console.log('Limpiando reglas de formato condicional anteriores...');
  for (let i = 0; i < 20; i++) {
    const d = await apiReq(':batchUpdate', token, {
      requests: [{ deleteConditionalFormatRule: { sheetId, index: 0 } }]
    });
    if (d.status !== 200) break;
  }
  console.log('Reglas anteriores eliminadas ✅');

  // ── 10. Agregar formato condicional por ETAPA (fila completa) ───
  const dataRange = {
    sheetId,
    startRowIndex: 1, endRowIndex: 1000,
    startColumnIndex: 0, endColumnIndex: NCOLS
  };

  const condRequests = [];
  ETAPAS.forEach((item, idx) => {
    condRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [dataRange],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: '=$O2="' + item.etapa + '"' }]
            },
            format: {
              backgroundColor: rgb(item.bg),
              textFormat: { foregroundColor: rgb(item.fg) }
            }
          }
        },
        index: idx
      }
    });
  });

  // Temperatura (solo columna M = índice 12)
  const tempRange = {
    sheetId,
    startRowIndex: 1, endRowIndex: 1000,
    startColumnIndex: 12, endColumnIndex: 13
  };
  TEMPS.forEach((item, idx) => {
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
        index: ETAPAS.length + idx
      }
    });
  });

  console.log('Aplicando', condRequests.length, 'reglas de color...');
  const r2 = await apiReq(':batchUpdate', token, { requests: condRequests });
  if (r2.status !== 200) {
    console.error('Error colores:', JSON.stringify(r2.body).slice(0,400));
    return;
  }

  console.log('\n✅ CRM visual configurado correctamente');
  console.log('\n📋 Pipeline con colores (columna ETAPA tiene menú desplegable):');
  ETAPAS.forEach(e => console.log('   ' + e.etapa));
  console.log('\n💡 Para cambiar la etapa de un lead:');
  console.log('   1. Haz clic en la celda de la columna ETAPA del lead');
  console.log('   2. Aparece un menú con las opciones');
  console.log('   3. Selecciona la etapa → la fila cambia de color automáticamente');
}

main().catch(console.error);
