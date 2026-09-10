// Load .env from backend directory (works when run from monorepo root)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Node 18 compatibility: undici (used by Next.js in workspace) expects global File
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File {};
}

// Node 18 compatibility: Mongoose 9 / mongodb driver 7 expects global crypto.getRandomValues
if (!globalThis.crypto) {
  try {
    const nodeCrypto = require('crypto');
    globalThis.crypto = nodeCrypto.webcrypto || nodeCrypto;
  } catch (_) {}
}
