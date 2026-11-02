// Hands the best of today's ranked jobs to career-ops (./career-ops).
//
// This project finds and ranks; career-ops is the second opinion. It runs
// inside Claude Code, reads the full posting against cv.md, scores it 1-5, and
// writes a tailored CV + cover letter for the ones worth it. Its inbox is
// career-ops/data/pipeline.md — this step appends to it, and you process it with
// `/career-ops pipeline` from inside that folder.
//
// The writing goes through career-ops' own appendToPipeline and loadSeenUrls, not
// a copy of them: that file has a lock, a sanitizer and a dedup rule that knows
// about its tracker and scan history, and a second writer with its own idea of
// the format is how lines get dropped.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, isMain } from './paths.js';

const DATA = path.join(ROOT, 'data');

async function readJson(name, fallback) {
  try { return JSON.parse(await readFile(path.join(DATA, name), 'utf8')); }
  catch { return fallback; }
}

// The feeds disagree on what a date is: ISO strings, epoch seconds, epoch ms,
// or nothing. career-ops wants epoch ms or nothing.
function toEpochMs(v) {
  if (typeof v === 'number' && v > 0) return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : undefined; }
  return undefined;
}

export async function exportToCareerOps() {
  const config = JSON.parse(await readFile(path.join(ROOT, 'config.json'), 'utf8'));
  const opts = { dir: 'career-ops', minScore: 60, maxPerRun: 10, ...config.careerOps };
  const dir = path.resolve(ROOT, opts.dir);

  const scanPath = path.join(dir, 'scan.mjs');
  if (!existsSync(scanPath)) {
    console.log(`  career-ops not found at ${dir} — skipping`);
    return 0;
  }
  const { appendToPipeline, loadSeenUrls, normalizeUrlForDedup } = await import(pathToFileURL(scanPath).href);

  const [state, applied, dismissed] = await Promise.all([
    readJson('jobs.json', { queue: [] }),
    readJson('applied.json', {}),
    readJson('dismissed.json', {}),
  ]);

  // Anything already in the inbox, already evaluated, or already in its tracker.
  const { seen } = loadSeenUrls();

  const offers = [];
  for (const j of state.queue ?? []) {
    if (offers.length >= opts.maxPerRun) break;
    if (!j.url || (j.score?.total ?? 0) < opts.minScore) continue;
    if (applied[j.id] || dismissed[j.id]) continue;
    const key = normalizeUrlForDedup(j.url);
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push({
      url: j.url,
      company: j.company,
      title: j.title,
      location: j.location || undefined,
      postedAt: toEpochMs(j.postedAt),
      note: `job-agent ${j.score.total} — ${j.score.reasons.slice(0, 2).join('; ')}`,
    });
  }

  await appendToPipeline(offers);
  console.log(`  ${offers.length} new job(s) -> ${path.join(dir, 'data', 'pipeline.md')}`);
  for (const o of offers) console.log(`    ${o.company} — ${o.title}`);
  return offers.length;
}

if (isMain(import.meta.url)) await exportToCareerOps();
