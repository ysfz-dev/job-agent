// Sends real applications by email: tailored letter in the body, CV attached.
//
// This is the one part of the project that acts in the outside world, so it is
// deliberately hard to fire by accident:
//
//   node src/send.js           dry run — prints exactly what WOULD be sent
//   node src/send.js --send    actually sends
//
// Reads and sends are split across two accounts on purpose. Alerts arrive in
// the throwaway mailbox; applications go out from the real address that is
// printed on the CV, because an application arriving from a "jobagent" account
// looks like a bot and replies need to reach the inbox actually being read.

import nodemailer from 'nodemailer';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, isMain } from './paths.js';
import { readEnv } from './env.js';
import { extractContact } from './contact.js';
import { writeLetter } from './letters.js';
import profile from './profile.js';
import { cvFor } from './cv.js';

const DATA = path.join(ROOT, 'data');

// A cap, not a target. Gmail allows far more, but a burst of identical-looking
// mail is what gets an address marked as spam — which would silently sink every
// application after it.
const MAX_PER_RUN = 8;

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(path.join(DATA, file), 'utf8')); } catch { return fallback; }
}

export function buildEmail(job, contact, cvPath) {
  return {
    to: contact.email,
    subject: `Application for ${job.title} — ${profile.name}`,
    text: writeLetter(job),
    attachments: [{ filename: path.basename(cvPath), path: cvPath }],
  };
}

async function main() {
  const live = process.argv.includes('--send');
  const env = await readEnv();

  const cvPath = env.CV_PATH || path.join(ROOT, 'resume', 'remote', 'Yousaf Yousafzai - Software Engineer.pdf');
  if (!existsSync(cvPath)) throw new Error(`CV not found at ${cvPath}. Set CV_PATH in .env.`);

  const state = await readJson('jobs.json', { picks: [], queue: [] });
  const sent = await readJson('sent.json', {});
  const applied = await readJson('applied.json', {});

  // Every ranked job, not just today's five — email-apply postings are rare
  // enough that restricting to the daily picks would usually find nothing.
  const candidates = [...(state.picks || []), ...(state.queue || [])];

  const outbox = [];
  const seenAddress = new Set();

  for (const job of candidates) {
    if (sent[job.id] || applied[job.id]) continue;
    const contact = extractContact(job);
    if (!contact) continue;

    // Never two applications to the same mailbox in one run: several postings
    // from one company share a careers@ address, and two emails ten seconds
    // apart reads as a mailing script, not a candidate.
    if (seenAddress.has(contact.email)) continue;
    seenAddress.add(contact.email);

    outbox.push({ job, contact });
    if (outbox.length >= MAX_PER_RUN) break;
  }

  if (!outbox.length) {
    console.log('Nothing to send: no ranked job carries an application address.');
    console.log('That is expected while the only sources are ATS boards — they');
    console.log('take form applications and publish no address. Bayt and Gulf');
    console.log('postings, which arrive by alert email, are the ones that do.');
    return;
  }

  console.log(`${outbox.length} application(s) ready${live ? '' : '  [DRY RUN — nothing will be sent]'}\n`);
  for (const { job, contact } of outbox) {
    console.log(`  to:      ${contact.email}   (${contact.confidence} confidence)`);
    console.log(`  subject: Application for ${job.title} — ${profile.name}`);
    console.log(`  role:    ${job.title} @ ${job.company} — ${job.location}`);
    console.log(`  cv:      ${cvFor(job).label} version`);
    console.log(`  because: "${contact.context}"`);
    console.log(`  link:    ${job.url}\n`);
  }

  if (!live) {
    console.log('Review the addresses above. If they look right:\n');
    console.log('    node src/send.js --send\n');
    return;
  }

  for (const k of ['SMTP_USER', 'SMTP_PASS']) {
    if (!env[k]) throw new Error(`.env is missing ${k} — needed to send from your real address.`);
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(env.SMTP_PORT || 465),
    secure: true,
    auth: { user: env.SMTP_USER, pass: (env.SMTP_PASS || '').replace(/\s+/g, '') },
  });

  await transport.verify();
  console.log(`sending as ${env.SMTP_USER}\n`);

  for (const { job, contact } of outbox) {
    // The regional CV for this job (photo and nationality in the Gulf, neither
    // in Canada/Australia); CV_PATH only if that version has not been built.
    const regional = cvFor(job).path;
    const mail = buildEmail(job, contact, existsSync(regional) ? regional : cvPath);
    try {
      const info = await transport.sendMail({ ...mail, from: `${profile.name} <${env.SMTP_USER}>`, replyTo: env.SMTP_USER });
      sent[job.id] = {
        at: new Date().toISOString(),
        to: contact.email,
        title: job.title,
        company: job.company,
        messageId: info.messageId,
      };
      console.log(`  sent -> ${contact.email}  (${job.title})`);
      await writeFile(path.join(DATA, 'sent.json'), JSON.stringify(sent, null, 2));
    } catch (e) {
      console.log(`  FAILED -> ${contact.email}: ${e.message}`);
    }
    // A human pause between sends. Identical timestamps are a spam signal.
    await new Promise((r) => setTimeout(r, 20000 + Math.random() * 25000));
  }

  console.log(`\n${Object.keys(sent).length} application(s) sent in total -> data/sent.json`);
}

if (isMain(import.meta.url)) {
  main().catch((e) => { console.error('send failed:', e.message); process.exit(1); });
}
