const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzIzYjkzOC05MjllLTQ0OTgtYjYwOS05ODA3YWM3N2I0NjUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOGZkMjNiYjEtMmM5OS00NjY5LTlmMWMtOWE3NDM0OWE2NmMxIiwiaWF0IjoxNzc4MjAzODc4LCJleHAiOjE4MDk3Mzk4Nzg3Mzh9.HCk_awOYdXoqH3ZTP4VxJGjSNj-9BRLlCpdSydLITDk';
const NEW_CLIENT_ID = '684308157339-vttks3891r7rgu62mtrgjov3v2hkpso8.apps.googleusercontent.com';
const NEW_CLIENT_SECRET = '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';

function apiRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data || '';
    const opts = {
      hostname: 'localhost', port: 5678, path, method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = http.request(opts, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  // 1. List all credentials
  const list = await apiRequest('GET', '/api/v1/credentials?limit=50', '');
  if (list.status !== 200) {
    console.error('Error listing credentials:', list.status, list.body.slice(0, 300));
    return;
  }
  const creds = JSON.parse(list.body);
  console.log('\n=== CREDENCIALES EN N8N ===');
  (creds.data || []).forEach(c => console.log(`  [${c.id}] ${c.name} (${c.type})`));

  // 2. Find Google Sheets credential
  const googleCred = (creds.data || []).find(c =>
    c.type === 'googleSheetsOAuth2Api' || c.name.toLowerCase().includes('google sheets')
  );
  if (!googleCred) {
    console.error('\nNo se encontró credencial de Google Sheets');
    return;
  }
  console.log('\nCredencial encontrada:', googleCred.id, '|', googleCred.name);

  // 3. Delete old credential
  console.log('\nEliminando credencial antigua...');
  const del = await apiRequest('DELETE', `/api/v1/credentials/${googleCred.id}`, '');
  console.log('Delete status:', del.status);

  // 4. Create new credential with correct client ID/secret
  console.log('\nCreando nueva credencial...');
  const newCred = {
    name: 'Google Sheets account',
    type: 'googleSheetsOAuth2Api',
    data: {
      clientId: NEW_CLIENT_ID,
      clientSecret: NEW_CLIENT_SECRET
    }
  };
  const create = await apiRequest('POST', '/api/v1/credentials', JSON.stringify(newCred));
  console.log('Create status:', create.status);
  if (create.status !== 200 && create.status !== 201) {
    console.error('Error creando credencial:', create.body.slice(0, 500));
    return;
  }
  const created = JSON.parse(create.body);
  const newId = created.id;
  console.log('Nueva credencial ID:', newId);

  // 5. Update all workflows to use new credential ID
  const wfIds = ['pyon28AYRbqy7hai', '6QyAL3rmlIlQFL9n', 'jEEv3zGWFcOzFRjL'];
  for (const wfId of wfIds) {
    const g = await apiRequest('GET', `/api/v1/workflows/${wfId}`, '');
    if (g.status !== 200) { console.log(`Workflow ${wfId} no encontrado`); continue; }
    const wf = JSON.parse(g.body);

    let updated = false;
    const nodes = wf.nodes.map(n => {
      if (!n.credentials) return n;
      const newCreds = {};
      for (const [key, val] of Object.entries(n.credentials)) {
        if (key === 'googleSheetsOAuth2Api') {
          newCreds[key] = { id: newId, name: 'Google Sheets account' };
          updated = true;
        } else {
          newCreds[key] = val;
        }
      }
      return { ...n, credentials: newCreds };
    });

    if (!updated) { console.log(`Workflow ${wfId} (${wf.name}): sin Google Sheets, saltando`); continue; }

    await apiRequest('POST', `/api/v1/workflows/${wfId}/deactivate`, '');
    const u = await apiRequest('PUT', `/api/v1/workflows/${wfId}`, JSON.stringify({
      name: wf.name, nodes, connections: wf.connections, settings: wf.settings
    }));
    console.log(`Workflow ${wfId} (${wf.name}): update ${u.status}`);
    await apiRequest('POST', `/api/v1/workflows/${wfId}/activate`, '');
  }

  console.log('\n=== LISTO ===');
  console.log('Nueva credencial ID:', newId);
  console.log('\nAhora ve a n8n UI:');
  console.log('  Settings → Credentials → "Google Sheets account" → Edit');
  console.log('  Haz clic en "Sign in with Google"');
  console.log('  Inicia sesión con figueroa.lera1@gmail.com');
}

run().catch(console.error);
