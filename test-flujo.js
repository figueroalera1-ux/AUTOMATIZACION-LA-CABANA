// Test which node causes "Could not find property option" in Flujo 5
const flujo5 = require('./n8n-flows/flujo5-formulario-cliente.json');

// Try to load n8n-workflow and instantiate the Workflow class
try {
  const { Workflow } = require('C:/Users/studi/AppData/Roaming/npm/node_modules/n8n/node_modules/n8n-workflow/dist/Workflow.js');
  console.log('Workflow class loaded');

  // Try to create Workflow with each node isolated
  for (const node of flujo5.nodes) {
    try {
      console.log(`Testing node: ${node.name} (${node.type})`);
      // Create a minimal workflow with just this one node
      const testWf = {
        id: 'test',
        name: 'test',
        nodes: [node],
        connections: {},
        active: true,
        settings: {}
      };
      new Workflow({ id: 'test', nodes: testWf.nodes, connections: testWf.connections, active: true, settings: {} });
      console.log('  ✅ OK');
    } catch(e) {
      console.log(`  ❌ ERROR: ${e.message}`);
    }
  }
} catch(loadErr) {
  console.log('Could not load Workflow class:', loadErr.message);
}
