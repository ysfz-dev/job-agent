// Feasibility check: how many stored postings actually name an address you can
// send a CV to? Run before trusting the email sender to be worth anything.
//
//   node src/scan-emails.js

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './paths.js';
import { extractContact } from './contact.js';

const store = JSON.parse(await readFile(path.join(ROOT, 'data', 'seen-jobs.json'), 'utf8'));
const jobs = Object.values(store);

let withEmail = 0;
const domains = new Map();
const samples = [];

for (const job of jobs) {
  const contact = extractContact(job);
  if (!contact) continue;
  withEmail++;
  const domain = contact.email.split('@')[1] || '?';
  domains.set(domain, (domains.get(domain) || 0) + 1);
  if (samples.length < 12) samples.push({ ...contact, title: job.title, company: job.company });
}

console.log(`${jobs.length} postings stored`);
console.log(`${withEmail} carry a usable application address (${(withEmail / jobs.length * 100).toFixed(1)}%)\n`);

console.log('samples:');
for (const s of samples) {
  console.log(`  ${s.email.padEnd(34)} ${s.title.slice(0, 44)} @ ${s.company}`);
}

console.log('\ntop domains:');
for (const [d, n] of [...domains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(n).padStart(4)}  ${d}`);
}
