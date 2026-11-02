// Reads .env. Kept deliberately tiny and dependency-free — the file holds the
// mailbox app password and the Adzuna/Jooble keys, and it is gitignored.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './paths.js';

export async function readEnv() {
  try {
    const txt = await readFile(path.join(ROOT, '.env'), 'utf8');
    const env = {};
    for (const line of txt.split(/\r?\n/)) {
      if (/^\s*#/.test(line)) continue;
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2];
    }
    return env;
  } catch {
    return {};
  }
}

export async function requireEnv(...keys) {
  const env = await readEnv();
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`.env is missing ${missing.join(', ')} — copy .env.example to .env and fill it in.`);
  }
  return env;
}
