// Each source returns a normalised Job:
//   { source, id, title, company, location, remote, url, description, tags, postedAt }
//
// Every source here is a public JSON API that is free and needs no key. Adzuna
// and Jooble are added separately because they need a free signup key, and they
// are the two that actually cover Bahrain / Saudi / Australia / Canada properly.

import * as cheerio from 'cheerio';

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; job-agent/0.1)' };

async function getJson(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

const strip = (h) => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

export const sources = {
  // RemoteOK is deliberately NOT a source. Its API is free to read, but the
  // apply_url on most listings redirects to remoteok.com/premium and asks for
  // payment before you can reach the employer. A job you cannot apply to is
  // not a job, and this project uses nothing that costs money.

  async remotive() {
    const out = [];
    for (const q of ['angular', 'dotnet', '.net', 'full stack', 'c#']) {
      try {
        const j = await getJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=50`);
        for (const x of j.jobs || []) {
          out.push({
            source: 'remotive',
            id: `remotive:${x.id}`,
            title: x.title,
            company: x.company_name,
            location: x.candidate_required_location || 'Remote',
            remote: true,
            url: x.url,
            description: strip(x.description),
            tags: x.tags || [],
            postedAt: x.publication_date,
          });
        }
      } catch { /* one query failing must not sink the run */ }
    }
    return out;
  },

  async arbeitnow() {
    const j = await getJson('https://www.arbeitnow.com/api/job-board-api');
    return (j.data || []).map((x) => ({
      source: 'arbeitnow',
      id: `arbeitnow:${x.slug}`,
      title: x.title,
      company: x.company_name,
      location: x.location || (x.remote ? 'Remote' : ''),
      remote: !!x.remote,
      url: x.url,
      description: strip(x.description),
      tags: x.tags || [],
      postedAt: x.created_at ? new Date(x.created_at * 1000).toISOString() : null,
    }));
  },

  async himalayas() {
    const j = await getJson('https://himalayas.app/jobs/api?limit=100');
    return (j.jobs || []).map((x) => ({
      source: 'himalayas',
      id: `himalayas:${x.guid}`,
      title: x.title,
      company: x.companyName,
      location: (x.locationRestrictions || []).join(', ') || 'Remote',
      remote: true,
      url: x.applicationLink,
      description: strip(x.description || x.excerpt),
      tags: [...(x.categories || []), ...(x.seniority || [])],
      // Epoch seconds, like Arbeitnow — read as ms it lands in January 1970.
      postedAt: x.pubDate ? new Date(x.pubDate * 1000).toISOString() : null,
    }));
  },

  async jobicy() {
    const j = await getJson('https://jobicy.com/api/v2/remote-jobs?count=100');
    return (j.jobs || []).map((x) => ({
      source: 'jobicy',
      id: `jobicy:${x.id}`,
      title: x.jobTitle,
      company: x.companyName,
      location: x.jobGeo || 'Remote',
      remote: true,
      url: x.url,
      description: strip(x.jobDescription || x.jobExcerpt),
      tags: [...(x.jobIndustry || []), ...(x.jobLevel ? [x.jobLevel] : [])],
      postedAt: x.pubDate,
    }));
  },
};

// The Muse. Note: its `location` query parameter does not actually filter —
// every country tried returned ~6,400 results and a "Toronto" query came back
// with a New York job. So it is pulled broadly by category, and location is
// decided by our own scorer from the `locations[]` field, which is real.
export async function themuse(pages = 5) {
  const out = [];
  for (const category of ['Software Engineering', 'Engineering']) {
    for (let page = 0; page < pages; page++) {
      try {
        const j = await getJson(
          `https://www.themuse.com/api/public/jobs?category=${encodeURIComponent(category)}&page=${page}`,
        );
        if (!j.results?.length) break;
        for (const x of j.results) {
          out.push({
            source: 'themuse',
            id: `muse:${x.id}`,
            title: x.name,
            company: x.company?.name || '',
            location: (x.locations || []).map((l) => l.name).join(', '),
            remote: (x.locations || []).some((l) => /remote|flexible/i.test(l.name)),
            url: x.refs?.landing_page,
            description: strip(x.contents),
            tags: [...(x.levels || []).map((l) => l.name), ...(x.categories || []).map((c) => c.name)],
            postedAt: x.publication_date,
          });
        }
      } catch { break; }
    }
  }
  return out;
}

// Ashby: one public board per company, no key.
export async function ashby(slugs) {
  const out = [];
  for (const slug of slugs) {
    try {
      const j = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
      for (const x of j.jobs || []) {
        out.push({
          source: `ashby:${slug}`,
          id: `ashby:${slug}:${x.id}`,
          title: x.title,
          company: j.name || slug,
          location: x.location || '',
          remote: !!x.isRemote,
          url: x.jobUrl || x.applyUrl,
          description: strip(x.descriptionHtml || x.descriptionPlain),
          tags: [x.department, x.team].filter(Boolean),
          postedAt: x.publishedAt,
        });
      }
    } catch { /* a dead board slug must not sink the run */ }
  }
  return out;
}

// Adzuna and Jooble need a free signup key. They are the only two giving
// genuine Bahrain / Saudi / Australia / Canada coverage, so they stay wired up
// and simply return nothing until the keys are in .env.
export async function adzuna(env) {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) return [];
  const out = [];
  for (const code of ['au', 'ca', 'gb']) {
    for (const what of ['angular developer', 'dotnet developer', 'software engineer']) {
      try {
        const j = await getJson(
          `https://api.adzuna.com/v1/api/jobs/${code}/search/1`
          + `?app_id=${env.ADZUNA_APP_ID}&app_key=${env.ADZUNA_APP_KEY}`
          + `&results_per_page=50&what=${encodeURIComponent(what)}`,
        );
        for (const x of j.results || []) {
          out.push({
            source: `adzuna:${code}`,
            id: `adzuna:${x.id}`,
            title: x.title,
            company: x.company?.display_name || '',
            location: x.location?.display_name || '',
            remote: /remote/i.test(`${x.title} ${x.description || ''}`),
            url: x.redirect_url,
            description: strip(x.description),
            tags: [x.category?.label].filter(Boolean),
            postedAt: x.created,
          });
        }
      } catch { /* keep going */ }
    }
  }
  return out;
}

export async function jooble(env) {
  if (!env.JOOBLE_KEY) return [];
  const out = [];
  for (const location of ['Bahrain', 'Saudi Arabia', 'Australia', 'Canada']) {
    for (const keywords of ['angular', 'dotnet developer', 'software engineer']) {
      try {
        const r = await fetch(`https://jooble.org/api/${env.JOOBLE_KEY}`, {
          method: 'POST',
          headers: { ...UA, 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords, location, page: '1' }),
          signal: AbortSignal.timeout(30000),
        });
        if (!r.ok) continue;
        const j = await r.json();
        for (const x of j.jobs || []) {
          out.push({
            source: 'jooble',
            id: `jooble:${x.id || x.link}`,
            title: x.title,
            company: x.company || '',
            location: x.location || location,
            remote: /remote/i.test(`${x.title} ${x.snippet || ''}`),
            url: x.link,
            description: strip(x.snippet),
            tags: [x.type].filter(Boolean),
            postedAt: x.updated,
          });
        }
      } catch { /* keep going */ }
    }
  }
  return out;
}

// Greenhouse: one public endpoint per company, no key. This is where real
// engineering roles at real companies live — worth more than the remote
// aggregators for quality, and it is the ATS you apply on directly.
export async function greenhouse(slugs) {
  const out = [];
  for (const slug of slugs) {
    try {
      const j = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
      for (const x of j.jobs || []) {
        out.push({
          source: `greenhouse:${slug}`,
          id: `gh:${slug}:${x.id}`,
          title: x.title,
          company: x.company_name || slug,
          location: x.location?.name || '',
          remote: /remote/i.test(x.location?.name || ''),
          url: x.absolute_url,
          description: strip(x.content),
          tags: [],
          postedAt: x.updated_at,
        });
      }
    } catch { /* a dead board slug must not sink the run */ }
  }
  return out;
}

// SmartRecruiters, Recruitee and Workable: the three platforms `discover.js`
// found Gulf employers actually using. CTM360, Bahrain Airport Company and
// Unifonic all publish here — which makes these the first automated route into
// Bahrain and Saudi this project has had.
export async function smartrecruiters(slugs) {
  const out = [];
  for (const slug of slugs) {
    try {
      const list = await getJson(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`);
      for (const p of list.content || []) {
        // The list endpoint carries no description, and the scorer needs one to
        // judge the stack — so each posting is fetched individually. These are
        // small employers with a handful of roles, so the extra calls are cheap.
        let description = '';
        try {
          const full = await getJson(`https://api.smartrecruiters.com/v1/companies/${slug}/postings/${p.id}`);
          const sections = full.jobAd?.sections || {};
          description = strip(Object.values(sections).map((s) => s?.text || '').join(' '));
        } catch { /* fall back to the title alone */ }

        const city = p.location?.city || '';
        const country = (p.location?.country || '').toUpperCase();
        out.push({
          source: `smartrecruiters:${slug}`,
          id: `sr:${slug}:${p.id}`,
          title: p.name,
          company: p.company?.name || slug,
          location: [city, country].filter(Boolean).join(', '),
          remote: !!p.location?.remote,
          url: `https://jobs.smartrecruiters.com/${slug}/${p.id}`,
          description,
          tags: [p.typeOfEmployment?.label, p.experienceLevel?.label].filter(Boolean),
          postedAt: p.releasedDate,
        });
      }
    } catch { /* a dead slug must not sink the run */ }
  }
  return out;
}

export async function recruitee(slugs) {
  const out = [];
  for (const slug of slugs) {
    try {
      const j = await getJson(`https://${slug}.recruitee.com/api/offers/`);
      for (const o of j.offers || []) {
        out.push({
          source: `recruitee:${slug}`,
          id: `rec:${slug}:${o.id}`,
          title: o.title,
          company: o.company_name || slug,
          location: o.location || [o.city, o.country].filter(Boolean).join(', '),
          remote: /remote/i.test(`${o.location} ${o.remote}`),
          url: o.careers_url || o.url,
          description: strip(o.description + ' ' + (o.requirements || '')),
          tags: [o.department, o.employment_type].filter(Boolean),
          postedAt: o.published_at,
        });
      }
    } catch { /* ditto */ }
  }
  return out;
}

export async function workable(slugs) {
  const out = [];
  for (const slug of slugs) {
    try {
      const j = await getJson(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`);
      for (const x of j.jobs || []) {
        out.push({
          source: `workable:${slug}`,
          id: `wk:${slug}:${x.shortcode || x.id}`,
          title: x.title,
          company: j.name || slug,
          location: [x.city, x.country].filter(Boolean).join(', '),
          remote: !!x.telecommuting,
          url: x.url || x.application_url,
          description: strip(`${x.description || ''} ${x.requirements || ''}`),
          tags: [x.department, x.employment_type].filter(Boolean),
          postedAt: x.published_on,
        });
      }
    } catch { /* ditto */ }
  }
  return out;
}

// Workable's own job search (jobs.workable.com) — every employer on Workable,
// searchable by country. This is the biggest Gulf source the project has:
// Saudi alone returns ~200 developer roles, against the 169 Gulf jobs every
// other source together collected in a month. Gulf startups and IT firms run on
// Workable far more than on Greenhouse or Lever, and per-company slugs cannot
// find employers nobody has thought to list.
const WORKABLE_COUNTRIES = ['Bahrain', 'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Oman'];
const WORKABLE_QUERIES = ['developer', 'software engineer', 'angular', '.net', 'full stack', 'solutions consultant'];

export async function workableSearch({ pages = 3 } = {}) {
  const out = [];
  for (const location of WORKABLE_COUNTRIES) {
    for (const query of WORKABLE_QUERIES) {
      let token = '';
      for (let page = 0; page < pages; page++) {
        try {
          const qs = new URLSearchParams({ query, location });
          if (token) qs.set('pageToken', token);
          const j = await getJson(`https://jobs.workable.com/api/v1/jobs?${qs}`);
          for (const x of j.jobs || []) {
            const l = x.location || {};
            out.push({
              source: 'workable-search',
              id: `wks:${x.id}`,
              title: x.title,
              company: x.company?.title || '',
              location: [l.city, l.countryName].filter(Boolean).join(', ') || (x.locations || []).join(', '),
              remote: x.workplace === 'remote',
              url: x.url,
              description: strip(`${x.description || ''} ${x.requirementsSection || ''}`),
              tags: [x.department, x.employmentType].filter(Boolean),
              postedAt: x.created,
            });
          }
          token = j.nextPageToken;
          if (!token) break;
        } catch { break; }
        // A few dozen requests in a row; spaced out so it reads as a person paging.
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  return out;
}

// LinkedIn's public job search — the pages anyone sees at linkedin.com/jobs
// without signing in. This is where most of the Gulf market actually is: the
// alert emails were meant to cover it, but in two months exactly one LinkedIn
// alert reached the mailbox, and Bahrain was showing two jobs while LinkedIn
// itself shows hundreds.
//
// No account is involved, so there is no account to get restricted — the worst
// case is LinkedIn answering 429 for a while, and the source then stops for
// the day and returns what it has. Kept deliberately slow: ~1 request a second,
// Gulf only, last 30 days.
const BROWSER = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};
const LINKEDIN_PAGES = { 'Bahrain': 10, 'Saudi Arabia': 8, 'United Arab Emirates': 6, 'Qatar': 3, 'Kuwait': 3, 'Oman': 3 };
const LINKEDIN_QUERIES = ['software engineer', 'developer', '.net', 'angular', 'full stack', 'solutions consultant'];
const pause = (ms) => new Promise((r) => setTimeout(r, ms + Math.random() * ms));

class RateLimited extends Error {}

// LinkedIn answers 429 after a few dozen requests, and the block lifts within
// about a minute (measured: 429, 429, then 200s from ~45s on). So a 429 means
// wait and carry on, not give up — the first version stopped at 159 jobs,
// before fetching a single description. After BACKOFFS waits it does give up.
const BACKOFF_MS = 75000;
const BACKOFFS = 12;

async function getHtml(url, budget) {
  for (;;) {
    const r = await fetch(url, { headers: BROWSER, signal: AbortSignal.timeout(30000) });
    if (r.ok) return r.text();
    if (r.status !== 429 && r.status !== 999) throw new Error(`${r.status} ${r.statusText}`);
    if (budget.left-- <= 0) throw new RateLimited(`${r.status}`);
    await new Promise((res) => setTimeout(res, BACKOFF_MS));
  }
}

// `known` is the set of job ids already stored WITH a description, so a
// posting seen yesterday is not fetched again. `want` decides which new
// postings are worth a second request for their description at all — titles
// the scorer would throw away anyway are not.
export async function linkedin({ known = new Set(), want = () => true, maxDetails = 80 } = {}) {
  const found = new Map();
  const budget = { left: BACKOFFS };
  try {
    for (const [location, pages] of Object.entries(LINKEDIN_PAGES)) {
      for (const keywords of LINKEDIN_QUERIES) {
        for (let page = 0; page < pages; page++) {
          const qs = new URLSearchParams({ keywords, location, f_TPR: 'r2592000', start: String(page * 10) });
          const $ = cheerio.load(await getHtml(`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${qs}`, budget));
          const cards = $('[data-entity-urn^="urn:li:jobPosting:"]');
          cards.each((_, el) => {
            const $c = $(el);
            const id = $c.attr('data-entity-urn').split(':').pop();
            const text = (sel) => $c.find(sel).first().text().replace(/\s+/g, ' ').trim();
            found.set(id, {
              source: 'linkedin',
              id: `linkedin:${id}`,
              title: text('.base-search-card__title'),
              company: text('.base-search-card__subtitle'),
              location: text('.job-search-card__location'),
              remote: /remote/i.test(text('.job-search-card__location')),
              url: `https://www.linkedin.com/jobs/view/${id}/`,
              description: '',
              tags: [],
              postedAt: $c.find('time').attr('datetime') || null,
            });
          });
          await pause(1200);
          if (cards.length < 10) break;          // last page
        }
      }
    }

    let details = 0;
    for (const [id, job] of found) {
      if (details >= maxDetails) break;
      if (known.has(job.id) || !want(job)) continue;
      const $ = cheerio.load(await getHtml(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`, budget));
      job.description = strip($('.show-more-less-html__markup').html());
      job.tags = $('.description__job-criteria-item span').map((_, s) => $(s).text().trim()).get();
      details++;
      await pause(1200);
    }
  } catch (e) {
    if (!(e instanceof RateLimited)) throw e;
    console.log(`  linkedin     rate-limited (${e.message}) — keeping the ${found.size} found so far`);
  }
  return [...found.values()];
}

export async function lever(slugs) {
  const out = [];
  for (const slug of slugs) {
    try {
      const j = await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      for (const x of j) {
        out.push({
          source: `lever:${slug}`,
          id: `lever:${slug}:${x.id}`,
          title: x.text,
          company: slug,
          location: x.categories?.location || '',
          remote: /remote/i.test(x.categories?.location || ''),
          url: x.hostedUrl,
          description: strip(x.descriptionPlain || x.description),
          tags: [x.categories?.team, x.categories?.commitment].filter(Boolean),
          postedAt: x.createdAt ? new Date(x.createdAt).toISOString() : null,
        });
      }
    } catch { /* ditto */ }
  }
  return out;
}

export async function fetchAll({ ghSlugs = [], leverSlugs = [], ashbySlugs = [], srSlugs = [], recruiteeSlugs = [], workableSlugs = [], linkedinOpts = {}, env = {} } = {}) {
  const report = (name) => (jobs) => {
    console.log(`  ${name.padEnd(12)} ${String(jobs.length).padStart(4)} jobs`);
    return jobs;
  };

  const tasks = Object.entries(sources).map(async ([name, fn]) => {
    try { return report(name)(await fn()); }
    catch (e) { console.log(`  ${name.padEnd(12)} FAILED: ${e.message}`); return []; }
  });

  tasks.push(themuse().then(report('themuse')).catch(() => []));
  tasks.push(greenhouse(ghSlugs).then(report('greenhouse')).catch(() => []));
  tasks.push(lever(leverSlugs).then(report('lever')).catch(() => []));
  tasks.push(ashby(ashbySlugs).then(report('ashby')).catch(() => []));
  tasks.push(smartrecruiters(srSlugs).then(report('smartrecr.')).catch(() => []));
  tasks.push(recruitee(recruiteeSlugs).then(report('recruitee')).catch(() => []));
  tasks.push(workable(workableSlugs).then(report('workable')).catch(() => []));
  tasks.push(workableSearch().then(report('workable-gulf')).catch(() => []));
  tasks.push(linkedin(linkedinOpts).then(report('linkedin')).catch((e) => { console.log(`  linkedin     FAILED: ${e.message}`); return []; }));
  tasks.push(adzuna(env).then(report('adzuna')).catch(() => []));
  tasks.push(jooble(env).then(report('jooble')).catch(() => []));

  const all = (await Promise.all(tasks)).flat();

  // Same role cross-posted to three aggregators is one job.
  const seen = new Map();
  for (const j of all) {
    if (!j.title || !j.url) continue;
    const key = `${(j.company || '').toLowerCase().trim()}|${j.title.toLowerCase().trim()}`;
    if (!seen.has(key)) seen.set(key, j);
  }
  return [...seen.values()];
}
