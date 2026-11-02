// Opening the mailbox, with the failure modes spelled out.
//
// Gmail answers almost every IMAP problem with the same message — "Invalid
// credentials" — whether the password is wrong, IMAP is switched off, or the
// app password belongs to a different Google account. That single opaque error
// covers three unrelated causes, so it is worth translating once here rather
// than guessing at it every time.

import { ImapFlow } from 'imapflow';

export async function connect(env) {
  const client = new ImapFlow({
    host: env.IMAP_HOST || 'imap.gmail.com',
    port: Number(env.IMAP_PORT || 993),
    secure: true,
    auth: { user: env.IMAP_USER, pass: (env.IMAP_PASS || '').replace(/\s+/g, '') },
    logger: false,
  });

  try {
    await client.connect();
    return client;
  } catch (e) {
    if (e.authenticationFailed || e.serverResponseCode === 'AUTHENTICATIONFAILED') {
      throw new Error(
        `Gmail rejected the login for ${env.IMAP_USER}.\n\n`
        + '  Gmail reports all three of these as "Invalid credentials":\n\n'
        + '  1. IMAP is switched off  <- most common\n'
        + '     Gmail -> Settings -> Forwarding and POP/IMAP -> Enable IMAP -> Save\n\n'
        + '  2. The app password belongs to a different Google account.\n'
        + `     It must have been created while signed in as ${env.IMAP_USER},\n`
        + '     not any other account. Check at myaccount.google.com/apppasswords\n'
        + '     — if the list there is empty, you made it on the wrong account.\n\n'
        + '  3. The app password was revoked, or a character was lost on paste.\n'
        + '     Generate a fresh one and paste all 16 characters.\n',
      );
    }
    throw e;
  }
}

// Gmail labels are IMAP folders. Opening one that does not exist should say so
// and list what does, rather than failing with a bare protocol error.
export async function openFolder(client, folder) {
  try {
    return await client.getMailboxLock(folder);
  } catch {
    const names = [];
    for (const box of await client.list()) names.push(box.path);
    await client.logout();
    throw new Error(
      `No folder named "${folder}" on this account.\n\n  Folders that do exist:\n`
      + names.map((n) => `    ${n}`).join('\n')
      + '\n\n  Set IMAP_FOLDER in .env to one of those, exactly as spelled above.\n'
      + '  A Gmail label only appears here once at least one message carries it.\n',
    );
  }
}
