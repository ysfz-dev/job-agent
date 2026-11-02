// One daily pass: fetch every source, score against the profile, keep the
// best, and write the dashboard's data file.
//
//   node src/run.js

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fetchAll } from './sources.js';
import profile from './profile.js';
import { contains, firstMatch } from './match.js';
import { rank } from './score.js';
import { ROOT } from './paths.js';
import { readEnv } from './env.js';

const DATA = path.join(ROOT, 'data');

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

// Keeping 4,000 full job descriptions for 30 days produced a 30MB store on the
// first run alone. Descriptions are trimmed, but from the MIDDLE rather than the
// end: "we are unable to sponsor visas" and the years-of-experience line are
// usually in the last paragraphs, and those are the two signals that decide
// whether an application is worth sending at all.
const HEAD = 4000;
const TAIL = 2500;
function compact(text) {
  const s = String(text || '');
  if (s.length <= HEAD + TAIL) return s;
  return `${s.slice(0, HEAD)} … ${s.slice(-TAIL)}`;
}

async function main() {
  const startedAt = new Date();
  await mkdir(DATA, { recursive: true });

  const config = await readJson(path.join(ROOT, 'config.json'), {});
  const applied = await readJson(path.join(DATA, 'applied.json'), {});
  const dismissed = await readJson(path.join(DATA, 'dismissed.json'), {});

  // Read before fetching: LinkedIn only spends a second request on a posting
  // whose description is not already stored.
  const store = await readJson(path.join(DATA, 'seen-jobs.json'), {});
  const known = new Set(Object.values(store).filter((j) => (j.description || '').length > 200).map((j) => j.id));
  const worthReading = (j) => {
    const t = (j.title || '').toLowerCase();
    return !firstMatch(t, profile.badTitles) && profile.goodTitles.some((g) => contains(t, g));
  };

  console.log(`\n[${startedAt.toISOString()}] fetching sources...`);
  const apiJobs = await fetchAll({
    linkedinOpts: { known, want: worthReading },
    ghSlugs: config.greenhouseSlugs || [],
    leverSlugs: config.leverSlugs || [],
    ashbySlugs: config.ashbySlugs || [],
    srSlugs: config.smartrecruitersSlugs || [],
    recruiteeSlugs: config.recruiteeSlugs || [],
    workableSlugs: config.workableSlugs || [],
    env: await readEnv(),
  });

  // Job-alert emails are read separately (src/mail.js) and merged here. They are
  // the only source with real Bahrain / Saudi coverage (Indeed, Bayt, GulfTalent),
  // so a run that cannot reach the mailbox still uses the last successful read.
  const liJobs = await readJson(path.join(DATA, 'email-jobs.json'), []);
  console.log(`  email-alerts ${String(liJobs.length).padStart(4)} jobs`);

  // These feeds serve a rolling window, not an archive — a strong match can
  // drop out of the API overnight while the posting itself is still open. So
  // everything seen is kept for 30 days and re-scored each run, rather than the
  // list being rebuilt from whatever today's snapshot happens to contain.
  const now = Date.now();
  const KEEP_MS = 30 * 86400000;

  for (const j of [...liJobs, ...apiJobs]) {
    const key = `${(j.company || '').toLowerCase().trim()}|${(j.title || '').toLowerCase().trim()}`;
    if (!key.trim() || key === '|') continue;
    // A source that returns no description today (LinkedIn search cards, alert
    // emails) must not wipe the one fetched on an earlier run.
    const description = compact(j.description) || store[key]?.description || '';
    store[key] = { ...(store[key] || {}), ...j, description,
                   firstSeen: store[key]?.firstSeen || now, lastSeen: now };
  }
  for (const [key, j] of Object.entries(store)) {
    if (now - (j.lastSeen || 0) > KEEP_MS) delete store[key];
  }
  await writeFile(path.join(DATA, 'seen-jobs.json'), JSON.stringify(store));

  const jobs = Object.values(store);
  const fresh = [...liJobs, ...apiJobs].length;
  console.log(`  ${'-'.repeat(12)} ${String(jobs.length).padStart(4)} unique (${fresh} in today's feeds, rest carried over)`);

  const ranked = rank(jobs)
    .filter((j) => j.score.total >= (config.minScore ?? 25))
    .filter((j) => !applied[j.id] && !dismissed[j.id]);

  const state = {
    generatedAt: startedAt.toISOString(),
    totalFetched: jobs.length,
    totalRanked: ranked.length,
    picks: ranked.slice(0, config.dailyPicks ?? 5),
    queue: ranked.slice(0, 60),
    appliedCount: Object.keys(applied).length,
  };

  await writeFile(path.join(DATA, 'jobs.json'), JSON.stringify(state, null, 2));

  // Append to history so the dashboard can show a trend rather than a snapshot.
  const history = await readJson(path.join(DATA, 'history.json'), []);
  history.push({
    at: startedAt.toISOString(),
    fetched: jobs.length,
    matched: ranked.length,
    applied: Object.keys(applied).length,
  });
  await writeFile(path.join(DATA, 'history.json'), JSON.stringify(history.slice(-180), null, 2));

  console.log(`\n  matched ${ranked.length} above score ${config.minScore ?? 25}`);
  console.log(`  today's picks:\n`);
  for (const j of state.picks) {
    console.log(`   ${String(j.score.total).padStart(4)}  ${j.title}`);
    console.log(`         ${j.company} — ${j.location}`);
    console.log(`         ${j.score.reasons.slice(0, 3).join(' · ')}`);
    console.log(`         ${j.url}\n`);
  }
  console.log(`  wrote data/jobs.json — dashboard: http://localhost:7171\n`);
}

main().catch((e) => { console.error('run failed:', e); process.exit(1); });
