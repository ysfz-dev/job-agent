// Lists what is actually in the mailbox: sender, subject, and whether any
// provider in mail.js recognises it.
//
// The useful diagnostic when `npm run mail` reads messages but finds no jobs —
// it says immediately whether the alerts have not arrived, are sitting under a
// different label, or came from a sender the parser does not know about.
//
//   node src/inbox.js              read the folder named in .env
//   node src/inbox.js --folders    list every folder/label on the account
//   node src/inbox.js "Some Label" read one specific folder

import { requireEnv } from './env.js';
import { connect, openFolder } from './imap.js';
import { PROVIDERS } from './mail.js';

const env = await requireEnv('IMAP_USER', 'IMAP_PASS');
const arg = process.argv[2];

const client = await connect(env);

if (arg === '--folders') {
  console.log(`folders and labels on ${env.IMAP_USER}:\n`);
  for (const box of await client.list()) {
    const mark = box.path === (env.IMAP_FOLDER || 'INBOX') ? '  <- IMAP_FOLDER in .env' : '';
    console.log(`  ${box.path}${mark}`);
  }
  await client.logout();
  process.exit(0);
}

const folder = arg || env.IMAP_FOLDER || 'INBOX';
const lock = await openFolder(client, folder);

try {
  const uids = await client.search({ since: new Date(Date.now() - 60 * 86400000) });
  console.log(`${uids.length} message(s) in "${folder}" over the last 60 days\n`);

  let recognised = 0;
  for await (const msg of client.fetch(uids.length ? uids : [], { envelope: true })) {
    const addr = msg.envelope?.from?.[0]?.address || '(no sender)';
    const provider = PROVIDERS.find((p) => p.from.test(addr));
    if (provider) recognised++;
    const date = msg.envelope?.date ? new Date(msg.envelope.date).toISOString().slice(0, 10) : '          ';
    console.log(`${date}  ${addr.padEnd(38)} ${provider ? `-> ${provider.name}` : '   (not a job alert)'}`);
    console.log(`            ${(msg.envelope?.subject || '').slice(0, 78)}\n`);
  }

  console.log(`${recognised} of ${uids.length} recognised as job alerts`);
  if (uids.length && !recognised) {
    console.log('\nNone matched a known sender. Run with --dump in mail.js, or paste a');
    console.log('sender address here and it can be added to PROVIDERS in src/mail.js.');
  }
} finally {
  lock.release();
  await client.logout();
}
