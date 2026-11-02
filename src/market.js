// How big is the actual addressable market? Stack match AND reachable location,
// which is the only intersection that matters.
//
// Worth running whenever sources change. The first run of this was the single
// most useful output of the project: 4,663 postings, 16 naming Angular and .NET,
// 458 in a country he can work in, and 4 in both — all four rejected for other
// reasons. The API sources, in other words, are close to useless for this
// profile, and no amount of scoring tuning changes that.
//
// The reason is structural: Greenhouse, Ashby, Lever and The Muse are US and EU
// product companies, and they build on React, Python and Go. Angular with
// ASP.NET Core is an enterprise stack — banks, government, ERP vendors,
// consultancies — and those employers do not post to startup job boards. In the
// Gulf they post to Bayt, GulfTalent, LinkedIn and Indeed, none of which has a
// usable API. Which is why the alert-email path is not a supplement here; it is
// the product.
//
//   node src/market.js

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './paths.js';
import { score } from './score.js';
import { contains, firstMatch } from './match.js';
import profile from './profile.js';

const OURS = ['angular', '.net', 'asp.net', 'c#', 'dotnet', 'blazor'];

const store = JSON.parse(await readFile(path.join(ROOT, 'data', 'seen-jobs.json'), 'utf8'));
const jobs = Object.values(store);

const bySource = new Map();
let stackHit = 0;
let inTarget = 0;
const both = [];

for (const job of jobs) {
  const blob = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const loc = (job.location || '').toLowerCase();

  const hasStack = contains(blob, 'angular') && OURS.some((s) => s !== 'angular' && contains(blob, s));
  const reachable = !!firstMatch(loc, profile.localRegions)
    || !!firstMatch(loc, profile.sponsorshipRegions)
    || /worldwide|anywhere|global/.test(loc);

  if (hasStack) stackHit++;
  if (reachable) inTarget++;
  if (hasStack && reachable) both.push(job);

  const src = (job.source || '?').split(':')[0];
  const row = bySource.get(src) || { total: 0, reachable: 0, stack: 0 };
  row.total++;
  if (reachable) row.reachable++;
  if (hasStack) row.stack++;
  bySource.set(src, row);
}

console.log(`${jobs.length} postings stored\n`);
console.log(`  ${String(stackHit).padStart(5)}  name Angular AND .NET`);
console.log(`  ${String(inTarget).padStart(5)}  in Bahrain / Saudi / Australia / Canada, or remote-worldwide`);
console.log(`  ${String(both.length).padStart(5)}  BOTH  <- the addressable market\n`);

if (both.length) {
  console.log('  the intersection:');
  for (const j of both) {
    const s = score(j);
    const verdict = s.total < 0 ? `REJECTED: ${s.reasons[0]}` : `score ${s.total}`;
    console.log(`    ${j.title.slice(0, 46).padEnd(48)} ${verdict}`);
  }
  console.log('');
}

console.log('  by source:');
console.log(`    ${'source'.padEnd(14)} ${'total'.padStart(6)} ${'reachable'.padStart(10)} ${'stack'.padStart(6)}`);
for (const [src, r] of [...bySource.entries()].sort((a, b) => b[1].total - a[1].total)) {
  console.log(`    ${src.padEnd(14)} ${String(r.total).padStart(6)} ${String(r.reachable).padStart(10)} ${String(r.stack).padStart(6)}`);
}
