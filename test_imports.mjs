// Test what breaks on Vercel - likely the Sui blockchain imports
// This mimics the top of api/chat.js

try {
  console.log('[1] Testing @google/generative-ai import...');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  console.log('    ✅ @google/generative-ai: OK');
} catch(e) {
  console.error('    ❌ @google/generative-ai FAILED:', e.message);
}

try {
  console.log('[2] Testing @mysten/sui/client import...');
  const { getFullnodeUrl, SuiClient } = await import('@mysten/sui/client');
  console.log('    ✅ @mysten/sui/client: OK');
} catch(e) {
  console.error('    ❌ @mysten/sui/client FAILED:', e.message.substring(0, 200));
}

try {
  console.log('[3] Testing @mysten/sui/keypairs/ed25519 import...');
  const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
  console.log('    ✅ @mysten/sui/keypairs/ed25519: OK');
} catch(e) {
  console.error('    ❌ @mysten/sui/keypairs/ed25519 FAILED:', e.message.substring(0, 200));
}

try {
  console.log('[4] Testing @mysten/sui/transactions import...');
  const { Transaction } = await import('@mysten/sui/transactions');
  console.log('    ✅ @mysten/sui/transactions: OK');
} catch(e) {
  console.error('    ❌ @mysten/sui/transactions FAILED:', e.message.substring(0, 200));
}

console.log('\nDone.');
