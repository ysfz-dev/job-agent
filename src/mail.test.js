// Checks each provider's link pattern against realistic alert markup.
//
// These emails cannot be fetched on demand — they arrive when they arrive — so
// the patterns are verified against fixtures shaped like the real thing. When a
// real alert lands, `node src/mail.js --all --dump` saves its HTML and any
// mismatch shows up here first.
//
//   node src/mail.test.js

import { gzipSync } from 'node:zlib';
import { parseAlert, PROVIDERS } from './mail.js';

// Indeed's "match" emails hide the destination inside a gzipped, base64url
// JSON blob: cts.indeed.com/v3/<blob>/<signature>. Built the same way here.
const ctsLink = (jk) => 'https://cts.indeed.com/v3/'
  + gzipSync(JSON.stringify({ u: `https://bh.indeed.com/rc/clk?jk=${jk}&from=jobi2a_jobmatch`, m: {} })).toString('base64url')
  + '/TsKKwLg5io1Mss5WuI1_cRcv05qplgdxI';

const card = (href, title, company, location) => `
  <table><tr><td>
    <a href="${href}">${title}</a>
    <p>${company}</p>
    <p>${location}</p>
    <a href="${href}">View job</a>
  </td></tr></table>`;

// The shape a real Indeed alert actually uses — sibling table cells with NO
// whitespace between them. This is the case that broke the first parser: the
// container's .text() came out as "Mobile DeveloperComputer World W.L.L.Manama"
// with nothing to split on, so every job parsed with an empty company and
// location, and the scorer could not assign a region to any of them.
const indeedCard = (jk, title, company, location) => `
  <table><tbody>
    <tr><td><h2><a href="https://bh.indeed.com/rc/clk?jk=${jk}&amp;from=alert">${title}</a></h2></td></tr>
    <tr><td><span>${company}</span></td></tr>
    <tr><td><span>${location}</span></td></tr>
  </tbody></table>`;

const FIXTURES = [
  {
    provider: 'linkedin',
    html: card(
      'https://www.linkedin.com/comm/jobs/view/4271839201/?trackingId=abc%3D&refId=xyz',
      'Senior .NET Developer', 'Batelco', 'Manama, Bahrain'),
    expect: { id: 'linkedin:4271839201', title: 'Senior .NET Developer', company: 'Batelco', location: 'Manama, Bahrain' },
  },
  {
    provider: 'indeed',
    html: card(
      'https://bh.indeed.com/rc/clk?jk=a1b2c3d4e5f6a7b8&fccid=9f8e7d&vjs=3',
      'Full Stack Developer (Angular/.NET)', 'Gulf Business Machines', 'Riyadh, Saudi Arabia'),
    expect: { id: 'indeed:a1b2c3d4e5f6a7b8', title: 'Full Stack Developer (Angular/.NET)' },
  },
  {
    provider: 'indeed-viewjob',
    html: card(
      'https://www.indeed.com/viewjob?jk=0099aabbccddeeff&from=alerts',
      'Software Engineer', 'Aramco Digital', 'Dhahran, Saudi Arabia'),
    expect: { id: 'indeed:0099aabbccddeeff', company: 'Aramco Digital' },
  },
  {
    provider: 'glassdoor',
    html: card(
      'https://www.glassdoor.com/partner/jobListing.htm?jobListingId=1009477123&pos=101',
      'Backend Engineer', 'Canva', 'Sydney, Australia'),
    expect: { id: 'glassdoor:1009477123', location: 'Sydney, Australia' },
  },
  {
    provider: 'indeed-real-layout',
    html: indeedCard('a1b2c3d4e5f6a7b8', 'Oracle APEX Developer (Bahraini National)',
      'Almoayyed International Group', 'Manama'),
    expect: {
      id: 'indeed:a1b2c3d4e5f6a7b8',
      title: 'Oracle APEX Developer (Bahraini National)',
      company: 'Almoayyed International Group',
      location: 'Manama',
    },
  },
  {
    // The feedback buttons carry the same job key and come first in the card;
    // they must not become the job's title.
    provider: 'indeed-match',
    html: `<a href="${ctsLink('9ba9be6fb32ef853')}">This is a bad match</a>`
      + indeedCard('x', 'Full-stack Engineer', 'CTM360', 'Manama')
        .replace('https://bh.indeed.com/rc/clk?jk=x&amp;from=alert', ctsLink('9ba9be6fb32ef853')),
    expect: { id: 'indeed:9ba9be6fb32ef853', title: 'Full-stack Engineer', company: 'CTM360', location: 'Manama' },
  },
  {
    provider: 'gulftalent',
    html: card(
      'https://www.gulftalent.com/jobs/senior-software-engineer-bahrain-412887',
      'Senior Software Engineer', 'Investcorp', 'Bahrain'),
    expect: { id: 'gulftalent:senior-software-engineer-bahrain-412887' },
  },
  {
    provider: 'bayt',
    html: card(
      'https://www.bayt.com/en/bahrain/jobs/net-developer-5210993/',
      '.NET Developer', 'Almoayyed Computers', 'Manama, Bahrain'),
    expect: { id: 'bayt:5210993', title: '.NET Developer' },
  },
];

let pass = 0;
let fail = 0;

for (const f of FIXTURES) {
  const jobs = parseAlert(f.html);
  const job = jobs[0];
  if (!job) {
    console.log(`  FAIL  ${f.provider.padEnd(16)} nothing parsed`);
    fail++;
    continue;
  }
  const wrong = Object.entries(f.expect).filter(([k, v]) => job[k] !== v);
  if (wrong.length) {
    console.log(`  FAIL  ${f.provider.padEnd(16)} ${wrong.map(([k, v]) => `${k}: got "${job[k]}" want "${v}"`).join('; ')}`);
    fail++;
  } else {
    console.log(`  ok    ${f.provider.padEnd(16)} ${job.id}  "${job.title}" @ ${job.company || '?'}`);
    pass++;
  }
}

// Chrome links ("View job", "Unsubscribe") must never become jobs of their own.
const noise = parseAlert(`
  <a href="https://www.linkedin.com/comm/jobs/view/4271839201/">View job</a>
  <a href="https://www.linkedin.com/comm/jobs/view/4271839201/">See all 47 jobs</a>`);
if (noise.length === 0) { console.log('  ok    chrome-links      correctly ignored'); pass++; }
else { console.log(`  FAIL  chrome-links      parsed ${noise.length} junk entries`); fail++; }

// Sender routing. Worth testing on its own because the addresses these sites
// send from are not the addresses you would guess: Indeed alone uses
// indeed.com, indeedemail.com and per-country hosts, and "indeedemail.com"
// does not contain the string "indeed.com".
const SENDERS = [
  ['alert@indeed.com', 'indeed'],
  ['noreply@indeed.com', 'indeed'],
  ['invitetoapply@indeed.com', 'indeed'],
  ['donotreply@indeedemail.com', 'indeed'],
  ['alert@bh.indeed.com', 'indeed'],
  ['jobalerts-noreply@linkedin.com', 'linkedin'],
  ['jobs-listings@linkedin.com', 'linkedin'],
  ['noreply@bayt.com', 'bayt'],
  ['alerts@gulftalent.com', 'gulftalent'],
  ['noreply@glassdoor.com', 'glassdoor'],
  ['no-reply@naukrigulf.com', 'naukrigulf'],
  ['friend@gmail.com', null],
  ['newsletter@medium.com', null],
];

console.log('');
for (const [addr, want] of SENDERS) {
  const got = PROVIDERS.find((p) => p.from.test(addr))?.name ?? null;
  if (got === want) {
    console.log(`  ok    ${addr.padEnd(32)} -> ${got || '(ignored)'}`);
    pass++;
  } else {
    console.log(`  FAIL  ${addr.padEnd(32)} -> ${got || '(ignored)'}, want ${want || '(ignored)'}`);
    fail++;
  }
}

console.log(`\n${pass} passed, ${fail} failed  (${PROVIDERS.length} providers configured)`);
process.exit(fail ? 1 : 0);
