// Reads job-alert emails out of the dedicated mailbox and turns them into the
// same normalised Job shape the API sources produce.
//
// This is the most valuable source in the project, for two reasons.
//
// First, coverage: the free APIs have essentially no Bahrain or Saudi listings,
// which is exactly where he can work without a visa. Indeed, Bayt and GulfTalent
// cover the Gulf properly and none of them has a usable public API — Indeed
// retired theirs and blocks scraping.
//
// Second, legitimacy: an alert email is the provider deliberately sending you
// their listings. There is nothing to scrape, nothing to rate-limit, and nothing
// that breaks when they change their markup or their bot rules.
//
// So the setup is: create job alerts on every site you care about using the
// dedicated address, and let them all deliver to one inbox.
//
//   node src/mail.js          read unseen alerts
//   node src/mail.js --all    re-read the last 30 days
//   node src/mail.js --dump   save raw HTML of each provider's first email

import { connect, openFolder } from './imap.js';
import { simpleParser } from 'mailparser';
import * as cheerio from 'cheerio';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { ROOT, isMain } from './paths.js';
import { requireEnv } from './env.js';

const DATA = path.join(ROOT, 'data');

// One entry per job site. `link` must capture the posting's id in group 1 —
// that id is what makes the same job arriving in five daily alerts one job.
// `canonical` rebuilds a clean apply URL where the emailed link is a tracking
// redirect, which most of them are.
export const PROVIDERS = [
  {
    name: 'linkedin',
    from: /\blinkedin\./i,
    link: [/linkedin\.com\/comm\/jobs\/view\/(\d+)/i, /linkedin\.com\/jobs\/view\/(\d+)/i],
    canonical: (id) => `https://www.linkedin.com/jobs/view/${id}/`,
  },
  {
    name: 'indeed',
    // Indeed sends from several domains — indeed.com, indeedemail.com, and
    // per-country hosts. Matching "indeed." rather than "indeed.com" catches
    // all of them; "indeedemail.com" does NOT contain "indeed.com".
    from: /\bindeed(?:email)?\./i,
    // Indeed's alert links are all tracking redirects, but every one of them
    // carries the job key as ?jk= or &jk=.
    link: [/[?&]jk=([a-z0-9]{10,20})/i, /indeed\.com\/viewjob\?[^"']*jk=([a-z0-9]{10,20})/i],
    canonical: (id) => `https://www.indeed.com/viewjob?jk=${id}`,
  },
  {
    name: 'glassdoor',
    from: /glassdoor\./i,
    link: [/jobListingId=(\d+)/i, /glassdoor\.[a-z.]+\/job-listing\/[^"'?]*-JV_[^"'?]*?(\d{6,})/i],
    canonical: (id) => `https://www.glassdoor.com/job-listing/index.htm?jobListingId=${id}`,
  },
  {
    name: 'bayt',
    from: /\bbayt\./i,
    link: [/bayt\.com\/[a-z]{2}\/[a-z-]+\/jobs\/[^"'?]*-(\d{6,})\//i, /bayt\.com\/[^"']*?\/(\d{7,})\//i],
    canonical: null,
  },
  {
    name: 'gulftalent',
    from: /\bgulftalent\./i,
    link: [/gulftalent\.com\/jobs\/([a-z0-9-]{8,})/i],
    canonical: (id) => `https://www.gulftalent.com/jobs/${id}`,
  },
  {
    name: 'naukrigulf',
    from: /\bnaukrigulf\./i,
    link: [/naukrigulf\.com\/[^"']*?-(\d{6,})(?:\?|$|")/i],
    canonical: null,
  },
];

// The match emails also put feedback buttons on every card ("This is a bad
// match", "Yes", "No"), and those links carry the same job key as the title.
const CHROME = /^(view|see|apply|show|browse|more|all|unsubscribe|manage|update|search|find|open|click|here|jobs?|new jobs?|this is a|yes|no|edit profile|pause)\b/i;

// Indeed's "match" emails ("Full-stack Engineer @ CTM360") wrap every link as
//   cts.indeed.com/v3/<gzipped JSON, base64url>/<signature>
// so jk= never appears in the href itself and all 49 of them parsed to zero
// jobs. The real destination is the "u" field of that JSON.
export function unwrapLink(href) {
  const m = href.match(/cts\.indeed\.com\/v3\/([A-Za-z0-9_-]+)/);
  if (!m) return href;
  try {
    return JSON.parse(gunzipSync(Buffer.from(m[1], 'base64url')).toString()).u || href;
  } catch {
    return href;
  }
}

// Pulls "company" and "location" out of the block of text around a job link.
// These emails are nested tables with no stable classes, so anchoring on the
// href — the one thing that cannot change without breaking their own links —
// and reading the text around it survives template changes far better than any
// CSS selector would.
function contextFor($, el, title) {
  // Read each leaf element separately rather than calling .text() on the
  // container.
  //
  // These emails put the title, company and location in sibling table cells
  // with no whitespace between them, and cheerio's .text() concatenates with no
  // separator at all — a real Indeed alert came out as
  //   "Mobile DeveloperComputer World W.L.L.Manama"
  // which no amount of splitting on newlines can take apart. Elements with no
  // element children are the actual text-bearing cells, and taking each one's
  // text on its own keeps the boundaries the markup already provides.
  let node = $(el);
  let lines = [];

  for (let i = 0; i < 6; i++) {
    node = node.parent();
    if (!node.length) break;

    const found = [];
    node.find('*').each((_, n) => {
      const $n = $(n);
      if ($n.children().length) return;                 // not a leaf
      const t = $n.text().replace(/\s+/g, ' ').trim();
      if (t) found.push(t);
    });

    if (found.join(' ').length > title.length + 10) { lines = found; break; }
  }

  const at = lines.findIndex((l) => l.includes(title));
  const after = (at >= 0 ? lines.slice(at + 1) : lines)
    .filter((l) => !CHROME.test(l) && l.length < 90);

  return { context: lines.join(' | '), after };
}

export function parseAlert(html, providerHint = null) {
  const $ = cheerio.load(html);
  const jobs = new Map();

  $('a[href]').each((_, el) => {
    const href = unwrapLink($(el).attr('href') || '');
    if (!href) return;

    // Try the sending provider first, then everything else — a forwarded
    // digest can carry links from more than one site.
    const ordered = providerHint
      ? [providerHint, ...PROVIDERS.filter((p) => p !== providerHint)]
      : PROVIDERS;

    let provider = null;
    let id = null;
    for (const p of ordered) {
      for (const re of p.link) {
        const m = href.match(re);
        if (m) { provider = p; id = m[1]; break; }
      }
      if (provider) break;
    }
    if (!provider) return;

    const title = $(el).text().replace(/\s+/g, ' ').trim();
    if (!title || title.length < 3 || title.length > 120 || CHROME.test(title)) return;

    const { context, after } = contextFor($, el, title);
    const key = `${provider.name}:${id}`;
    const existing = jobs.get(key);

    const job = {
      source: `${provider.name}-alert`,
      id: key,
      title,
      company: after[0] || existing?.company || '',
      location: after[1] || existing?.location || '',
      remote: /\bremote\b/i.test(after.join(' ')),
      url: provider.canonical ? provider.canonical(id) : href,
      // Alert emails carry no description, so scoring runs on title, company
      // and location alone. Those three decide most rejections anyway; the
      // description is what you read when you open the posting.
      description: '',
      tags: [],
      postedAt: null,
      rawContext: context.slice(0, 300),
    };
    if (!existing || (!existing.company && job.company)) jobs.set(key, job);
  });

  return [...jobs.values()];
}

async function main() {
  const all = process.argv.includes('--all');
  const dump = process.argv.includes('--dump');
  const env = await requireEnv('IMAP_USER', 'IMAP_PASS');
  await mkdir(DATA, { recursive: true });

  const client = await connect(env);

  // IMAP_FOLDER scopes the reader to a single Gmail label. This matters: an app
  // password unlocks the whole mailbox whatever we do, so the least this code
  // can do is never open anything but the one folder job alerts land in. Set it
  // to JobAlerts and personal mail is never fetched, parsed, or held in memory.
  const folder = env.IMAP_FOLDER || 'INBOX';

  const lock = await openFolder(client, folder);
  console.log(`reading ${env.IMAP_USER} -> ${folder}\n`);

  const found = [];
  const perProvider = {};
  const dumped = new Set();
  let emails = 0;
  let skipped = 0;

  try {
    const since = new Date(Date.now() - 30 * 86400000);
    const uids = await client.search(all ? { since } : { seen: false, since });
    console.log(`${uids.length} message(s) in range\n`);

    if (uids.length) {
      for await (const msg of client.fetch(uids, { source: true })) {
        const parsed = await simpleParser(msg.source);
        const from = parsed.from?.text || '';
        const provider = PROVIDERS.find((p) => p.from.test(from));
        if (!provider) { skipped++; continue; }
        emails++;

        if (dump && !dumped.has(provider.name)) {
          dumped.add(provider.name);
          const file = path.join(DATA, `sample-${provider.name}.html`);
          await writeFile(file, parsed.html || parsed.textAsHtml || '');
          console.log(`  [saved data/sample-${provider.name}.html]`);
        }

        const jobs = parseAlert(parsed.html || parsed.textAsHtml || '', provider);
        perProvider[provider.name] = (perProvider[provider.name] || 0) + jobs.length;
        console.log(`  ${provider.name.padEnd(11)} "${(parsed.subject || '').slice(0, 52)}" -> ${jobs.length}`);
        found.push(...jobs);
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }

  const byId = new Map(found.map((j) => [j.id, j]));

  // Merge with previous runs: one run that reads nothing must not wipe the Gulf
  // coverage built up over the past month.
  let previous = [];
  try { previous = JSON.parse(await readFile(path.join(DATA, 'email-jobs.json'), 'utf8')); } catch {}
  for (const j of previous) if (!byId.has(j.id)) byId.set(j.id, j);

  const out = [...byId.values()];
  await writeFile(path.join(DATA, 'email-jobs.json'), JSON.stringify(out, null, 2));

  console.log(`\n${emails} alert email(s) read, ${skipped} non-job message(s) skipped`);
  for (const [name, n] of Object.entries(perProvider)) console.log(`  ${name.padEnd(11)} ${n} jobs`);
  console.log(`${found.length} jobs this run, ${out.length} total on file -> data/email-jobs.json`);

  if (emails === 0) {
    console.log('\nNo alert emails matched. Either none have arrived yet, or they are');
    console.log('from a sender not in PROVIDERS — run with --all --dump and check.');
  }
}

if (isMain(import.meta.url)) {
  main().catch((e) => { console.error('mail read failed:', e.message); process.exit(1); });
}
