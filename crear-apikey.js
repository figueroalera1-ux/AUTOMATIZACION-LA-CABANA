const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const db = new DatabaseSync('C:/Users/studi/.n8n/database.sqlite');

// Get user ID
const user = db.prepare("SELECT id, email FROM user LIMIT 1").get();
console.log('User:', user.email, '| ID:', user.id);

// Check user_api_keys schema
const schema = db.prepare("PRAGMA table_info(user_api_keys)").all();
console.log('API Keys columns:', schema.map(c => c.name).join(', '));

// Check existing keys
const existing = db.prepare("SELECT id, label, apiKey FROM user_api_keys WHERE userId = ?").all(user.id);
console.log('Existing keys:', existing.length);
if (existing.length > 0) {
  console.log('Existing key:', existing[0].apiKey);
  db.close();
  process.exit(0);
}

// Create a new API key (n8n uses a specific format)
const apiKey = 'n8n_api_' + crypto.randomBytes(32).toString('hex');
const keyId = crypto.randomUUID();
const now = new Date().toISOString();

db.prepare(`
  INSERT INTO user_api_keys (id, userId, label, apiKey, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(keyId, user.id, 'temp-test-key', apiKey, now, now);

console.log('Created API key:', apiKey);
db.close();
