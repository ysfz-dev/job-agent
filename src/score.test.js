// Location scoring: the rules that decide whether a job is reachable at all.
//
// Every case here came from a wrong result on real data, not from imagination.
//
//   node src/score.test.js

import { score } from './score.js';

const job = (over) => ({
  title: 'Software Engineer (Angular / .NET)',
  company: 'Acme',
  location: '',
  description: 'We are looking for 3 years of Angular and ASP.NET Core experience.',
  tags: [],
  ...over,
});

const CASES = [
  // Priority order — Bahrain first, Australia last, all still positive.
  { name: 'Bahrain ranks first', j: { location: 'Manama, Bahrain' }, want: 'accept' },
  { name: 'Riyadh ranks second', j: { location: 'Riyadh, Saudi Arabia' }, want: 'accept' },
  { name: 'Canada accepted', j: { location: 'Toronto, Canada' }, want: 'accept' },
  { name: 'Australia accepted', j: { location: 'Sydney, Australia' }, want: 'accept' },
  { name: 'remote worldwide accepted', j: { location: 'Remote, Worldwide' }, want: 'accept' },

  // Outside the target countries.
  { name: 'Germany rejected', j: { location: 'Berlin, Germany' }, want: 'reject' },
  { name: 'Poland rejected', j: { location: 'Ozorkow, Poland' }, want: 'reject' },
  {
    name: 'Europe kept when it offers relocation',
    j: { location: 'Berlin, Germany', description: 'Angular and .NET. We offer visa sponsorship and a relocation package.' },
    want: 'accept',
  },

  // Residency lists. The bug this file exists for: a remote role listing three
  // countries scored as a Canadian job because "canada" appeared in the string.
  {
    name: 'multi-country remote list rejected',
    j: { location: 'Canada,  Mexico,  USA' },
    want: 'reject',
  },
  {
    name: 'residency wording rejected',
    j: {
      location: 'Remote - US',
      description: 'This role is only open to candidates who live in the United States.',
    },
    want: 'reject',
  },
  {
    name: 'multi-country list KEPT when Bahrain is on it',
    j: { location: 'Bahrain, UAE, Saudi Arabia' },
    want: 'accept',
  },

  // Residency wording on a worldwide-remote role. This case exists because
  // `worldwide` lost its definition during a refactor and only threw when
  // residency language was present — && short-circuited past it everywhere
  // else, so every other test passed against broken code.
  {
    name: 'worldwide remote with residency wording',
    j: {
      location: 'Remote, Worldwide',
      description: 'Angular and .NET. Residents of any country may apply.',
    },
    want: 'accept',
  },

  // Stack relevance. A job with NO stack overlap was scoring 60 on location and
  // seniority alone — the real case was Canonical's graduate role, whose title
  // names no language at all and whose description is C++, Rust, Go and Python.
  {
    name: 'C++ role with no stack overlap rejected',
    j: {
      title: 'Graduate Software Engineer, Open Source and Linux',
      location: 'Home based - Worldwide',
      description: 'You will write C++ and Rust on the Linux kernel, with some Python and Go.',
    },
    want: 'reject',
  },
  {
    name: 'React role rejected even when remote and junior',
    j: {
      title: 'Junior Software Engineer',
      location: 'Remote, Worldwide',
      description: 'A React and Node.js team building with Python on the back end.',
    },
    want: 'reject',
  },
  {
    name: 'generic posting kept but penalised',
    j: {
      title: 'Software Engineer',
      location: 'Manama, Bahrain',
      description: 'You will build and maintain internal business systems.',
    },
    want: 'accept',
  },

  // Non-engineering roles in a top-priority city. Riyadh is worth +40, which was
  // enough to float HR and operations jobs to the top of the list the moment
  // Gulf employers started coming in.
  {
    name: 'HR role in Riyadh rejected',
    j: {
      title: 'People Business Partner',
      location: 'Riyadh, Saudi Arabia',
      description: 'Partner with leaders on organisational design and talent strategy.',
    },
    want: 'reject',
  },
  {
    name: 'customer care in Riyadh rejected',
    j: {
      title: 'Customer Care Advisor (Voice)',
      location: 'Riyadh, Saudi Arabia',
      description: 'Handle inbound customer queries and resolve complaints.',
    },
    want: 'reject',
  },
  {
    name: 'fraud investigator in Riyadh rejected',
    j: {
      title: 'Senior Fraud Investigator',
      location: 'Riyadh, Saudi Arabia',
      description: 'Investigate suspicious transactions and file reports.',
    },
    want: 'reject',
  },
  {
    name: 'engineering title in Bahrain survives a thin description',
    j: {
      title: 'Software Engineer',
      location: 'Manama, Bahrain',
      description: 'No public description published on the posting.',
    },
    want: 'accept',
  },

  // Remote is not worldwide. A Brazilian role marked remote by its aggregator
  // topped the daily picks at 82.
  { name: 'remote restricted to Brazil rejected', j: { location: 'Brazil', remote: true }, want: 'reject' },
  { name: 'remote from EU in title rejected', j: { title: 'Backend Developer .Net - Remote from EU', location: 'Remote job', remote: true }, want: 'reject' },
  { name: 'plain remote kept', j: { location: 'Remote job', remote: true }, want: 'accept' },

  // Nationality: he is Bahraini.
  {
    name: 'Emirati-national programme rejected',
    j: { title: 'Associate Data Analyst (Emirati National)', location: 'Dubai, UAE' },
    want: 'reject',
  },
  {
    name: 'Saudi National Bank is not a quota',
    j: { company: 'Saudi National Bank', location: 'Riyadh, Saudi Arabia', description: 'Join Saudi National Bank. Angular and ASP.NET Core, 3 years.' },
    want: 'accept',
  },
  {
    name: 'Bahraini-national role boosted',
    j: { title: 'Software Developer (Bahraini)', location: 'Manama, Bahrain' },
    want: 'accept',
    flag: 'bahraini-only',
  },

  // Other engineering professions, and plural titles.
  { name: 'Civil Engineer in Bahrain rejected', j: { title: 'Civil Engineer', location: 'Bahrain', description: '' }, want: 'reject' },
  { name: '"Web Developers" plural accepted', j: { title: 'Web Developers – Bahrain', location: 'Bahrain', description: '' }, want: 'accept' },

  // In the Gulf, an engineering role on another stack is kept but ranked low.
  {
    name: 'React full-stack in Manama kept',
    j: { title: 'Full-stack Engineer', location: 'Manama, BH', description: 'React, Node.js and TypeScript on a security platform. 3 years.' },
    want: 'accept',
  },
  {
    name: 'React full-stack in Toronto still rejected',
    j: { title: 'Full-stack Engineer', location: 'Toronto, Canada', description: 'React, Node.js and TypeScript on a security platform. 3 years.' },
    want: 'reject',
  },
  {
    name: 'solutions consultant in Riyadh accepted',
    j: { title: 'Customer Solutions Consultant', location: 'Riyadh, Saudi Arabia', description: 'Pre-sales consultant for our CPaaS platform: run client meetings, map requirements and propose solutions to enterprise customers across the Kingdom. ERP and SaaS integration experience valued. 3 years.' },
    want: 'accept',
  },
];

let pass = 0;
let fail = 0;

for (const c of CASES) {
  const s = score(job(c.j));
  const got = s.total > 0 ? 'accept' : 'reject';
  if (got === c.want && (!c.flag || s.flags.includes(c.flag))) {
    console.log(`  ok    ${c.name.padEnd(42)} ${String(s.total).padStart(5)}`);
    pass++;
  } else {
    console.log(`  FAIL  ${c.name.padEnd(42)} ${String(s.total).padStart(5)}  want ${c.want}`);
    console.log(`        ${s.reasons.slice(0, 2).join(' | ')}`);
    fail++;
  }
}

// The priority list must actually order the way the profile says it does.
const order = ['Manama, Bahrain', 'Riyadh, Saudi Arabia', 'Jeddah, Saudi Arabia',
  'Remote, Worldwide', 'Dubai, UAE', 'Toronto, Canada', 'Sydney, Australia'];
const scores = order.map((l) => score(job({ location: l })).total);
const descending = scores.every((n, i) => i === 0 || scores[i - 1] >= n);
if (descending) { console.log(`  ok    priority order holds: ${scores.join(' > ')}`); pass++; }
else { console.log(`  FAIL  priority order broken: ${scores.join(', ')}`); fail++; }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
