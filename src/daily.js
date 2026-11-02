// The whole daily pass, in the order it has to happen:
//   1. read LinkedIn alert emails  -> data/linkedin-jobs.json
//   2. fetch the APIs, merge, score -> data/jobs.json
//   3. write a cover letter for each of today's picks -> data/letters.json
//   4. hand the best of the queue to career-ops -> career-ops/data/pipeline.md
//
// This is what Task Scheduler runs. It never throws: a failing mailbox must not
// stop the API sources from producing a list, and a failing run must not leave
// the dashboard showing nothing.

import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';
import { readEnv } from './env.js';

const LOG = path.join(ROOT, 'data', 'daily.log');

function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  try { appendFileSync(LOG, stamped + '\n'); } catch {}
}

function step(name, file, args = []) {
  return new Promise((resolve) => {
    log(`--- ${name} ---`);
    const p = spawn(process.execPath, [path.join(ROOT, 'src', file), ...args], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    p.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
    p.stderr.on('data', (d) => { out += d; process.stderr.write(d); });
    p.on('close', (code) => {
      try { appendFileSync(LOG, out); } catch {}
      if (code !== 0) log(`${name} exited ${code} — continuing`);
      resolve(code);
    });
  });
}

// Checking that .env exists is not the same as checking it is filled in. An
// .env with a blank IMAP_PASS reported "mailbox configured" and then failed
// every night, which reads as the mail step working and finding nothing —
// exactly the wrong signal when the real problem is a missing password.
const env = await readEnv();
const hasMailbox = !!(env.IMAP_USER && env.IMAP_PASS);

log(`daily pass starting (mailbox ${hasMailbox
  ? `configured: ${env.IMAP_USER} -> ${env.IMAP_FOLDER || 'INBOX'}`
  : 'NOT configured — IMAP_USER/IMAP_PASS missing from .env, skipping mail'})`);

if (hasMailbox) await step('job-alert emails', 'mail.js');
await step('sources + scoring', 'run.js');
await step('cover letters', 'letters.js');
await step('career-ops inbox', 'career-ops.js');

log('daily pass complete\n');
