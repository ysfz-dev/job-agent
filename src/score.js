// Scores a posting against the profile. The output is a number plus the
// reasons behind it, because a ranked list you cannot interrogate is one you
// stop trusting after the first bad suggestion.

import profile from './profile.js';
import { contains, countMatches, firstMatch } from './match.js';

// "We cannot sponsor" is the most expensive thing to miss: it turns an
// application into a guaranteed rejection, so it is scored as a hard block.
const NO_SPONSOR = [
  'no visa sponsorship', 'not able to sponsor', 'unable to sponsor',
  'cannot sponsor', 'do not sponsor', 'does not sponsor', 'without sponsorship',
  'must be authorized to work', 'must be authorised to work',
  'must have the right to work', 'no relocation', 'us citizens only',
  'security clearance', 'citizenship required', 'green card',
];
const YES_SPONSOR = [
  'visa sponsorship', 'sponsorship available', 'we sponsor', 'will sponsor',
  'relocation package', 'relocation assistance', 'relocation support',
  'visa support', 'work permit provided',
];

// Talent marketplaces list every technology that exists in a single posting, so
// they match any profile perfectly and mean nothing. They are not employers,
// and applying to one is not applying for a job.
const MARKETPLACES = [
  'lemon.io', 'toptal', 'turing', 'andela', 'crossover', 'x-team', 'gun.io',
  'arc.dev', 'proxify', 'upstack', 'revelo', 'strider', 'gigster', 'braintrust',
  'remotasks', 'talently',
];

// Used to detect a posting naming so many stacks it cannot describe one role.
const ALL_STACKS = [
  'react', 'angular', 'vue', 'svelte', 'python', 'java', 'php', 'ruby',
  'golang', 'go', 'rust', 'c#', '.net', 'node', 'django', 'laravel', 'rails',
  'spring', 'kotlin', 'swift', 'flutter', 'scala', 'elixir', 'perl', 'c++',
];

// Stacks that mean this is somebody else's job.
const COMPETING = ['react', 'vue', 'svelte', 'python', 'java', 'php', 'ruby',
  'golang', 'rust', 'ios', 'android', 'flutter', 'kotlin', 'swift', 'scala',
  'elixir', 'salesforce', 'sap', 'wordpress', 'drupal', 'c++', 'perl',
  'haskell', 'erlang', 'objective-c', 'clojure'];

const OURS = ['angular', '.net', 'asp.net', 'c#', 'dotnet', 'blazor'];

// His secondary stack: not what he is hired for today, but what he has built
// and shipped on (his own platform).
const NEAR = ['typescript', 'nestjs', 'node.js', 'postgresql'];

// "Saudi National Bank" is an employer, not a quota.
const OTHER_NATIONALS = /\b(saudi|emirati|uae|qatari|kuwaiti|omani)\s+nationals?\b(?!\s+bank)|\b(saudis|emiratis|qataris|kuwaitis|omanis)\s+only\b|\bsaudi\s+only\b/;
const BAHRAINI_ONLY = /\bbahraini\s+(nationals?|only|candidates)\b|\bbahrainis\s+only\b/;

// A remote role whose location names a country is a residency requirement
// ("Brazil", "Philippines", "Remote - US"), not a worldwide role. These words
// say nothing about where; whatever is left after removing them is a place.
const REMOTE_WORDS = /\b(remote|job|jobs|anywhere|worldwide|global|home based|work from home|wfh|fully|first|friendly|flexible|hybrid)\b|[-–,()/|:&]/g;
const REMOTE_IN_TITLE = /\bremote\b\W*(?:from|in|within|only)?\s*(?:the\s+)?(eu|europe|us|usa|u\.s\.|uk|latam|emea|americas|apac|germany|spain|portugal|poland|india|brazil|canada|mexico)\b/;

export function score(job) {
  // NFKC folds the "𝗦𝗲𝗻𝗶𝗼𝗿 𝗘𝗥𝗣𝗡𝗲𝘅𝘁 𝗗𝗲𝘃𝗲𝗹𝗼𝗽𝗲𝗿" style of LinkedIn title (Unicode
  // bold letters) back to plain text, which no word match could read.
  const title = (job.title || '').normalize('NFKC').toLowerCase();
  const loc = (job.location || '').toLowerCase();
  const desc = (job.description || '').toLowerCase();
  const tags = (job.tags || []).join(' ').toLowerCase();
  const company = (job.company || '').toLowerCase();
  const body = `${desc} ${tags}`;
  const blob = `${title} ${body}`;

  let pts = 0;
  const reasons = [];
  const flags = [];
  const reject = (why) => ({ total: -100, reasons: [why], flags: ['reject'], matched: [] });

  // 1. Not an engineering role — nothing downstream can rescue it.
  const bad = firstMatch(title, profile.badTitles);
  if (bad) return reject(`not an engineering role ("${bad}")`);

  // 2. Talent marketplace, not an employer.
  const agency = MARKETPLACES.find((m) => company.includes(m) || title.includes(m));
  if (agency) return reject(`${job.company} is a talent marketplace, not an employer`);

  // Nationality. He is Bahraini: a role reserved for Bahraini nationals is one
  // he is among the few eligible for, and another GCC state's national-quota
  // role (Tamara's "(Emirati National)" programme, "Saudi National" hires) is
  // closed to him however well it fits.
  const otherNationals = title.match(OTHER_NATIONALS) || desc.match(OTHER_NATIONALS);
  if (otherNationals) return reject(`reserved for ${otherNationals[0].trim()} — not open to a Bahraini`);
  const bahrainiOnly = /\bbahrainis?\b/.test(title) || BAHRAINI_ONLY.test(desc);

  const stackCount = countMatches(body, ALL_STACKS);
  if (stackCount >= 10) {
    return reject(`names ${stackCount} different stacks — a talent-pool listing, not one role`);
  }

  // 3. Whose job is this? The title says, and it outranks any keyword soup
  //    buried further down the description.
  const titleOurs = OURS.filter((s) => contains(title, s));
  const titleCompeting = COMPETING.filter((s) => contains(title, s));
  if (titleCompeting.length && !titleOurs.length) {
    return reject(`a ${titleCompeting.join('/')} role, not an Angular/.NET one`);
  }
  if (titleOurs.length) { pts += 20; reasons.push(`title names ${titleOurs.join(', ')}`); }

  // 4. Stack overlap. A skill named in the title counts double — that is the
  //    role itself, not a nice-to-have buried in paragraph nine.
  const matched = [];
  for (const [skill, weight] of Object.entries(profile.skills)) {
    if (contains(title, skill)) { pts += weight * 2; matched.push(skill); }
    else if (contains(body, skill)) { pts += weight; matched.push(skill); }
  }
  if (matched.length) reasons.push(`stack: ${matched.slice(0, 8).join(', ')}`);

  // Does this posting involve his stack AT ALL?
  //
  // Checking only the title was not enough. "Graduate Software Engineer, Open
  // Source and Linux, Canonical Ubuntu" names no stack in its title, so nothing
  // rejected it — and it scored 60 on "graduate" plus "remote worldwide" plus a
  // stray IoT mention, with zero stack overlap. The description was C++, Rust,
  // Go and Python. Location and seniority points alone must never carry a job
  // that has nothing to do with what he writes.
  // Where the job is, decided here because whether an off-stack role is worth
  // a look depends on it. Walks profile.locationPriority in order and takes the
  // first tier that matches, so the ranking is the list's order — Bahrain, then
  // Riyadh, then the rest of Saudi, then remote, then the Gulf, then Canada,
  // then Australia. Matched against the location field ONLY: a description
  // that mentions a Dubai office is not a Dubai job.
  const tier = profile.locationPriority.find((t) => t.match.some((m) => contains(loc, m)));
  const local = !!tier && tier.flag === 'no-visa-needed';

  const anyOurs = OURS.some((s) => contains(blob, s));
  const engineeringTitle = profile.goodTitles.some((g) => contains(title, g));

  if (!anyOurs) {
    const rivals = COMPETING.filter((s) => contains(body, s));
    // In the Gulf a generic engineering role on another stack is still worth
    // reading: the market is small, he writes TypeScript daily, and CTM360's
    // "Full-stack Engineer" in Manama was being thrown away for saying React.
    // Ranked well below his own stack, but kept. Elsewhere it stays a reject —
    // abroad there are enough Angular/.NET roles that a React one is noise.
    //
    // TypeScript, NestJS and PostgreSQL are his own stack too — Tajer Al
    // Fareej runs on them — so a Riyadh "Backend Engineer (Node.js /
    // TypeScript, NestJS)" is a near miss, not a different profession.
    const near = NEAR.some((s) => contains(blob, s));
    if (rivals.length && local && engineeringTitle) {
      pts -= near ? 10 : 25;
      reasons.push(`built on ${rivals.slice(0, 3).join(', ')} — not your stack, but a Gulf role`);
    } else if (rivals.length) {
      return reject(`built on ${rivals.slice(0, 3).join(', ')} — no Angular or .NET anywhere in the posting`);
    }

    // Neither an engineering title nor a trace of his stack.
    //
    // Once Gulf employers came in, the top of the list filled with "People
    // Business Partner", "Customer Care Advisor" and "Senior Fraud
    // Investigator" — scoring 24, 12 and 14 purely because Riyadh is worth +40.
    // Location points were carrying roles that are not engineering at all.
    // Blocklisting each title is a losing game; requiring the job to be
    // recognisably his profession is not.
    if (!engineeringTitle) {
      return reject(`"${job.title}" is not an engineering role — no engineering title, no Angular or .NET`);
    }

    // An absent description is not evidence of a bad stack fit — it is no
    // evidence at all, and the two must not be scored the same way. CTM360's
    // "Software Engineer" in Manama publishes no description, and the full -30
    // for "no Angular or .NET mentioned" pushed a real Bahrain engineering role
    // below the threshold on the strength of a blank field.
    if (desc.trim().length < 200) {
      pts -= 5;
      flags.push('unknown-stack');
      reasons.push('no description published — stack unknown, worth opening');
    } else {
      // Abroad, a role that never names his stack is noise. In the Gulf it is
      // most of the market — ServiceNow, Power Platform, Odoo, NestJS — and -30
      // was pushing every one of them under the threshold.
      pts -= local ? 10 : 30;
      reasons.push('no Angular or .NET mentioned anywhere');
    }
  }

  // The bullseye: his actual daily pairing.
  const ng = contains(blob, 'angular');
  const net = OURS.some((s) => s !== 'angular' && contains(blob, s));
  if (ng && net) { pts += 30; flags.push('exact-stack'); reasons.push('Angular + .NET — exact stack match'); }

  // 5. Title shape and seniority. He has 3 years.
  if (profile.goodTitles.some((g) => contains(title, g))) pts += 12;
  else { pts -= 10; reasons.push('not a standard engineering title'); }

  // Matched on word boundaries, not substrings: the title is "Staff Backend
  // Engineer", never the literal "staff engineer", so `includes` missed every
  // one of them and put staff-level roles in front of a 3-year candidate.
  if (/\b(staff|principal|head of|director|vp|chief|architect|distinguished|manager)\b/.test(title)) {
    pts -= 35; flags.push('too-senior'); reasons.push('staff/principal level — well past 3 years');
  }
  if (/\b(senior|sr\.?|lead)\b/.test(title)) { pts -= 10; flags.push('senior-stretch'); }
  if (/\b(junior|graduate|entry|associate)\b/.test(title)) { pts += 10; reasons.push('junior/mid level'); }

  const yrs = desc.match(/(\d+)\s*\+?\s*(?:to|-|–)?\s*\d*\s*years?/);
  if (yrs) {
    const n = parseInt(yrs[1], 10);
    if (n >= 8) { pts -= 30; flags.push('too-senior'); reasons.push(`asks ${n}+ years`); }
    else if (n >= 6) { pts -= 15; reasons.push(`asks ${n}+ years`); }
    else if (n >= 1 && n <= 4) { pts += 12; reasons.push(`asks ${n}+ years — fits`); }
  }

  // 6. Location points, from the tier matched above.
  const sponsorRegion = !!tier && tier.flag === 'needs-sponsorship';
  const worldwide = !!tier && !tier.flag;   // the remote-worldwide tier

  if (tier) {
    pts += tier.points;
    if (tier.flag) flags.push(tier.flag);
    const rank = profile.locationPriority.indexOf(tier) + 1;
    reasons.push(`${job.location} — ${tier.label}, priority ${rank} of ${profile.locationPriority.length}`);
  }
  else if (job.remote) {
    // Remote is not worldwide. Aggregators mark every listing remote, and a
    // Brazilian affirmative-action role scored 82 and topped the daily picks
    // because "Brazil" plus remote earned +2 instead of a rejection.
    const place = loc.replace(REMOTE_WORDS, ' ').trim();
    const titleRegion = title.match(REMOTE_IN_TITLE);
    if (place || titleRegion) {
      return reject(`remote, but only for people in ${place ? job.location : titleRegion[1].toUpperCase()}`);
    }
    pts += 2;
  }
  else {
    // Everywhere else. A -12 penalty was far too soft: a perfect Angular/.NET
    // match in Hungary out-scored every Bahrain job, because the stack bonuses
    // add to ~50 and the location cost was a rounding error. Location is closer
    // to a requirement than a preference here — you cannot take a job in Poland
    // without someone moving you there.
    //
    // So an office outside the four target countries is a rejection, unless the
    // posting itself says it will sponsor or relocate. Those stay visible, but
    // ranked below anything in the Gulf.
    const willMove = YES_SPONSOR.some((p) => desc.includes(p));
    if (!willMove) {
      return reject(`${job.location || 'location unstated'} — outside Bahrain, Saudi, Australia and Canada`);
    }
    pts -= 40;
    flags.push('outside-target');
    reasons.push(`${job.location} — outside your target countries, but offers relocation`);
  }

  // Residency requirements, which are not the same thing as a location.
  //
  // "Toronto, Canada" is a job in Canada that might relocate you. "Canada,
  // Mexico, USA" is a remote role you must ALREADY live in one of to be
  // eligible — and a naive match on "canada" scored one of those as a priority
  // target. From Manama it is not applicable at any salary.
  //
  // The tell is a location field naming several countries: that is a remote
  // eligibility list, not an office. If none of them is somewhere he can
  // already be, the role is closed to him however well the stack fits.
  const COUNTRIES = ['usa', 'united states', 'u.s.', 'mexico', 'canada', 'brazil',
    'argentina', 'colombia', 'uk', 'united kingdom', 'ireland', 'germany', 'france',
    'spain', 'portugal', 'poland', 'netherlands', 'india', 'philippines', 'latam',
    'emea', 'apac', 'europe', 'australia', 'new zealand', 'singapore', 'japan'];
  const listed = COUNTRIES.filter((c) => contains(loc, c));

  const RESIDENCY = /(must (be )?(reside|live|located|based)|only open to candidates who (live|reside)|you must (live|reside)|required to (live|reside)|residents? of)/i;
  const saysResidency = RESIDENCY.test(desc);

  if (!local && (listed.length >= 2 || (saysResidency && !worldwide))) {
    // Eligible only if somewhere he can already be is on the list.
    const reachable = profile.locationPriority
      .filter((t) => t.flag === 'no-visa-needed')
      .some((t) => t.match.some((m) => contains(loc, m)));
    if (!reachable) {
      return reject(
        listed.length >= 2
          ? `remote but restricted to ${job.location} — you must already live there`
          : `${job.location} — requires residency you do not have`,
      );
    }
  }

  if (bahrainiOnly) {
    pts += 15; flags.push('bahraini-only');
    reasons.push('reserved for Bahraini nationals — you qualify, few others do');
  }

  // 7. Sponsorship language.
  const blocked = NO_SPONSOR.find((p) => desc.includes(p));
  const offered = YES_SPONSOR.find((p) => desc.includes(p));
  if (offered) { pts += 25; flags.push('sponsors'); reasons.push(`says "${offered}"`); }
  if (blocked && !local) {
    pts -= 50; flags.push('no-sponsorship'); reasons.push(`says "${blocked}" — likely auto-reject`);
  }

  // 8. Domain familiarity.
  for (const [d, w] of [['erp', 10], ['multi-tenant', 8], ['fintech', 4], ['iot', 6], ['saas', 3]]) {
    if (contains(blob, d)) { pts += w; reasons.push(`domain: ${d}`); }
  }

  // 9. Freshness — a posting older than six weeks is usually already filled.
  if (job.postedAt) {
    const days = (Date.now() - new Date(job.postedAt).getTime()) / 86400000;
    if (days > 45) { pts -= 20; reasons.push(`posted ${Math.round(days)} days ago`); }
    else if (days <= 7) { pts += 8; reasons.push('posted this week'); }
  }

  // `region` is the location tier this job matched, carried out so the dashboard
  // can group by it without re-deriving the match from the location string.
  return { total: Math.round(pts), reasons, flags, matched, region: tier ? tier.label : null };
}

export function rank(jobs) {
  return jobs
    .map((j) => ({ ...j, score: score(j) }))
    .filter((j) => j.score.total > 0)
    .sort((a, b) => b.score.total - a.score.total);
}
