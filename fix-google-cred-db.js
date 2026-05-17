const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');

const DB_PATH = 'C:/Users/studi/.n8n/database.sqlite';
const ENCRYPTION_KEY = 'P+y9luag7NDGT4D1eRw5JMs65apHctE8';
const NEW_CLIENT_ID = '684308157339-vttks3891r7rgu62mtrgjov3v2hkpso8.apps.googleusercontent.com';
const NEW_CLIENT_SECRET = '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';

// CryptoJS uses OpenSSL EVP_BytesToKey for key+IV derivation
function evpBytesToKey(password, salt, keyLen, ivLen) {
  const pass = Buffer.from(password, 'utf8');
  let d = Buffer.alloc(0);
  let prev = Buffer.alloc(0);
  while (d.length < keyLen + ivLen) {
    const hash = crypto.createHash('md5');
    hash.update(prev);
    hash.update(pass);
    hash.update(salt);
    prev = hash.digest();
    d = Buffer.concat([d, prev]);
  }
  return { key: d.slice(0, keyLen), iv: d.slice(keyLen, keyLen + ivLen) };
}

function decrypt(encBase64, password) {
  const raw = Buffer.from(encBase64, 'base64');
  if (raw.slice(0, 8).toString('ascii') !== 'Salted__') throw new Error('Not CryptoJS format');
  const salt = raw.slice(8, 16);
  const data = raw.slice(16);
  const { key, iv } = evpBytesToKey(password, salt, 32, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

function encrypt(dataObj, password) {
  const salt = crypto.randomBytes(8);
  const { key, iv } = evpBytesToKey(password, salt, 32, 16);
  const plaintext = Buffer.from(JSON.stringify(dataObj), 'utf8');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const result = Buffer.concat([Buffer.from('Salted__', 'ascii'), salt, enc]);
  return result.toString('base64');
}

const db = new DatabaseSync(DB_PATH);
const creds = db.prepare("SELECT id, name, type, data FROM credentials_entity WHERE type = 'googleSheetsOAuth2Api'").all();
console.log('Credenciales Google Sheets:', creds.length);

for (const cred of creds) {
  console.log('\nID:', cred.id, '| Nombre:', cred.name);

  let data;
  try {
    data = decrypt(cred.data, ENCRYPTION_KEY);
    console.log('ClientId actual:', data.clientId || '(none)');
    console.log('Tiene token:', !!data.oauthTokenData);
  } catch (e) {
    console.error('Error descifrando:', e.message);
    continue;
  }

  const newData = {
    clientId: NEW_CLIENT_ID,
    clientSecret: NEW_CLIENT_SECRET
    // oauthTokenData omitted — forces fresh re-auth
  };

  const encNew = encrypt(newData, ENCRYPTION_KEY);
  const verify = decrypt(encNew, ENCRYPTION_KEY);
  if (verify.clientId !== NEW_CLIENT_ID) { console.error('Verificación FALLÓ'); continue; }
  console.log('Verificación OK');

  const r = db.prepare("UPDATE credentials_entity SET data = ? WHERE id = ?").run(encNew, cred.id);
  console.log('Actualizado en DB:', r.changes > 0 ? 'SI' : 'NO');
}

db.close();
console.log('\n=== LISTO ===');
console.log('Ve a n8n UI → Settings → Credentials → "Google Sheets account" → Edit → Sign in with Google');
console.log('Usa: figueroa.lera1@gmail.com');
