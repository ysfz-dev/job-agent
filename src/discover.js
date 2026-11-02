// Finds which employers publish their jobs through an ATS with a public API.
//
// This is the way into the Gulf. The aggregators do not cover Bahrain and the
// job boards block automated reading — but almost every company runs its
// careers page on a hosted ATS, and most of those ATSes expose the same board
// over a documented, public, unauthenticated endpoint. CTM360 turned out to be
// on SmartRecruiters; one call returned all four of their open roles.
//
// So instead of asking an aggregator what exists, ask each employer directly.
// No key, no scraping, no rate limiting, and it does not break when a job board
// changes its markup.
//
//   node src/discover.js                 probe the built-in company list
//   node src/discover.js acme "big corp" probe specific names
//
// Confirmed boards are written to config.json, so the next `npm run daily`
// picks them up.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './paths.js';
import { COMPANIES } from './companies.js';

// Each probe returns the number of open postings, or null if this company is
// not on that ATS. A 200 with zero jobs still proves the board exists — the
// company simply is not hiring today — so those are reported separately.
const ATS = {
  smartrecruiters: {
    url: (s) => `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=1`,
    count: (j) => (typeof j.totalFound === 'number' ? j.totalFound : null),
  },
  greenhouse: {
    url: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`,
    count: (j) => (Array.isArray(j.jobs) ? j.jobs.length : null),
  },
  lever: {
    url: (s) => `https://api.lever.co/v0/postings/${s}?mode=json`,
    count: (j) => (Array.isArray(j) ? j.length : null),
  },
  ashby: {
    url: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    count: (j) => (Array.isArray(j.jobs) ? j.jobs.length : null),
  },
  workable: {
    url: (s) => `https://apply.workable.com/api/v1/widget/accounts/${s}?details=true`,
    count: (j) => (Array.isArray(j.jobs) ? j.jobs.length : null),
  },
  recruitee: {
    url: (s) => `https://${s}.recruitee.com/api/offers/`,
    count: (j) => (Array.isArray(j.offers) ? j.offers.length : null),
  },
};

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; job-agent/0.1)' };

// Companies name their board unpredictably: "Gulf Business Machines" might be
// gbm, gulfbusinessmachines, or gulf-business-machines. Try the plausible ones.
export function slugsFor(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const words = base.split(/\s+/);
  const out = new Set([
    base.replace(/\s+/g, ''),
    base.replace(/\s+/g, '-'),
    words[0],
  ]);
  if (words.length > 1) out.add(words.map((w) => w[0]).join(''));   // initialism
  return [...out].filter((s) => s.length >= 2 && s.length <= 40);
}

async function probe(ats, slug) {
  const spec = ATS[ats];
  try {
    const r = await fetch(spec.url(slug), { headers: UA, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const text = await r.text();
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) return null;
    const n = spec.count(JSON.parse(text));
    return n === null ? null : n;
  } catch {
    return null;
  }
}

const REGION = /bahrain|manama|muharraq|riffa|saudi|riyadh|jeddah|khobar|dammam|dhahran|ksa|uae|dubai|abu dhabi|sharjah|qatar|doha|kuwait|oman|muscat|egypt|cairo|jordan|amman|mena|gcc|middle east/i;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Does this board actually belong to the company we searched for?
//
// Guessing slugs from a name produces first-words and initialisms that collide
// with unrelated boards: "national" is a Toronto company, "abc" is ThoughtWorks,
// "be" is a firm in Curaçao, and "dga" is a set of US political campaigns. Six
// of the first fourteen hits were the wrong employer entirely.
//
// A board is accepted only if its own company name matches exactly, or it is
// posting jobs in the region. A loose name match with jobs in Toronto is not
// the Bahraini bank.
async function verify(ats, slug, name) {
  const urls = {
    greenhouse: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    smartrecruiters: `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=10`,
    lever: `https://api.lever.co/v0/postings/${slug}?mode=json`,
    ashby: `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
    workable: `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`,
    recruitee: `https://${slug}.recruitee.com/api/offers/`,
  };
  try {
    const j = await (await fetch(urls[ats], { headers: UA, signal: AbortSignal.timeout(12000) })).json();
    let company = '';
    let locations = [];

    if (ats === 'greenhouse') {
      company = j.jobs?.[0]?.company_name || '';
      locations = (j.jobs || []).slice(0, 15).map((x) => x.location?.name);
    } else if (ats === 'smartrecruiters') {
      company = j.content?.[0]?.company?.name || '';
      locations = (j.content || []).map((x) => `${x.location?.city} ${x.location?.country}`);
    } else if (ats === 'lever') {
      locations = (j || []).slice(0, 15).map((x) => x.categories?.location);
    } else if (ats === 'ashby') {
      company = j.name || '';
      locations = (j.jobs || []).slice(0, 15).map((x) => x.location);
    } else if (ats === 'workable') {
      company = j.name || '';
      locations = (j.jobs || []).slice(0, 15).map((x) => `${x.city} ${x.country}`);
    } else if (ats === 'recruitee') {
      company = j.offers?.[0]?.company_name || '';
      locations = (j.offers || []).slice(0, 15).map((x) => x.location);
    }

    const exactName = company && norm(company) === norm(name);
    const inRegion = locations.filter(Boolean).some((l) => REGION.test(l));
    return { ok: exactName || inRegion, company, sample: locations.filter(Boolean)[0] || '' };
  } catch {
    return { ok: false, company: '', sample: '' };
  }
}

async function findBoard(name) {
  for (const slug of slugsFor(name)) {
    for (const ats of Object.keys(ATS)) {
      // SmartRecruiters answers 200 {"totalFound":0} for ANY slug, "asdfghjkl"
      // included, so an empty board proves nothing — and an empty board is
      // worth nothing to us regardless. Require at least one open posting.
      const n = await probe(ats, slug);
      if (n === null || n === 0) continue;

      const v = await verify(ats, slug, name);
      if (v.ok) return { name, ats, slug, jobs: n, company: v.company, sample: v.sample };
    }
  }
  return null;
}

// Bounded concurrency: polite to the ATS hosts and fast enough that probing a
// couple of hundred companies finishes while you are still reading the output.
async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : COMPANIES;

console.log(`probing ${names.length} companies across ${Object.keys(ATS).length} ATS platforms...\n`);

const results = (await mapLimit(names, 8, async (name) => {
  const hit = await findBoard(name);
  if (hit) {
    const label = `${hit.jobs} open`;
    console.log(`  FOUND  ${name.padEnd(30)} ${hit.ats.padEnd(15)} ${hit.slug.padEnd(20)} ${String(hit.jobs).padStart(3)} open   ${hit.sample}`);
  }
  return hit;
})).filter(Boolean);

console.log(`\n${results.length} of ${names.length} companies have a public job board\n`);

const byAts = {};
for (const r of results) (byAts[r.ats] ||= []).push(r.slug);

const configPath = path.join(ROOT, 'config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));

const KEY = {
  smartrecruiters: 'smartrecruitersSlugs',
  greenhouse: 'greenhouseSlugs',
  lever: 'leverSlugs',
  ashby: 'ashbySlugs',
  workable: 'workableSlugs',
  recruitee: 'recruiteeSlugs',
};

for (const [ats, slugs] of Object.entries(byAts)) {
  const key = KEY[ats];
  const merged = [...new Set([...(config[key] || []), ...slugs])];
  config[key] = merged;
  console.log(`  config.${key}: +${slugs.length} (${merged.length} total)`);
}

await writeFile(configPath, JSON.stringify(config, null, 2));
console.log('\nwrote config.json — run `npm run daily` to pull them in.');
