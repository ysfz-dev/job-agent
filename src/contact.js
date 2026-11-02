// Finds the address a CV should actually be sent to.
//
// The hard part is not finding an email in a job posting — it is refusing the
// wrong one. Postings are full of addresses that must never receive a CV:
// privacy officers, legal, accessibility contacts, press, and the applicant
// tracking system's own no-reply. Sending a CV to a company's GDPR inbox is
// worse than not applying, so the default here is to send nothing unless the
// address is clearly a recruiting one.

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// Local parts that mean "this is where applications go".
const HIRING = /^(careers?|jobs?|hr|recruit(ing|ment)?|hiring|talent|cv|resume|apply|applications?|employment|vacanc(y|ies)|join|people|hrd|hrm)([._-]?[a-z0-9]+)?$/i;

// Local parts that must never receive a CV, however the posting is worded.
//
// The accessibility group is the important one and was not obvious. US postings
// carry a legally required EEO paragraph naming a disability-accommodation
// contact, so those addresses appear in thousands of postings — cloudflare.com
// showed up 348 times in one scan. They are the most *common* address in a job
// description and the most wrong: that inbox is for candidates requesting
// accommodations, not for unsolicited CVs.
const NEVER = new RegExp(
  '^('
  + 'no-?reply|do-?not-?reply|donotreply|mailer-?daemon|unsubscribe|notifications?|alerts?'
  + '|privacy|dpo|gdpr|legal|compliance|security|abuse|ethics'
  + '|press|media|marketing|sales|support|help|info|contact|hello|admin|webmaster|postmaster'
  + '|billing|invoice|finance|accounts?payable'
  // accessibility / accommodation boilerplate
  + '|accessib\\w*|accommodat\\w*|assistance|ada|eeo|disability|reasonable\\w*'
  // internal-employee HR, not recruiting
  + '|myhr|hrhelp|hrsupport|benefits|payroll|employee\\w*|askhr'
  + ')',
  'i',
);

// Domains belonging to job boards and ATS vendors, not employers.
const NOT_EMPLOYER = /(indeed|linkedin|glassdoor|bayt|gulftalent|naukri|greenhouse|lever|ashby|workable|smartrecruiters|workday|jobvite|icims|taleo|myworkday|recruitee|teamtailor|personio|remoteok|remotive|himalayas|jobicy|arbeitnow|themuse|example|sentry|google|gmail|googlemail|yahoo|hotmail|outlook)\./i;

// Phrases that, near an address, mean "apply here".
const APPLY_CONTEXT = /(send|email|e-mail|forward|submit|share|apply|application|cv|resume|r[ée]sum[ée])/i;

export function extractContact(job) {
  const text = `${job.description || ''} ${job.rawContext || ''}`;
  if (!text.trim()) return null;

  const seen = new Set();
  const candidates = [];

  for (const match of text.matchAll(EMAIL)) {
    const email = match[0].toLowerCase().replace(/[.,;:)\]}'"]+$/, '');
    if (seen.has(email)) continue;
    seen.add(email);

    const [local, domain] = email.split('@');
    if (!local || !domain) continue;
    if (NEVER.test(local)) continue;
    if (NOT_EMPLOYER.test(domain)) continue;

    // Look at the words immediately around the address.
    const at = match.index ?? 0;
    const window = text.slice(Math.max(0, at - 160), at + 80);

    const isHiringBox = HIRING.test(local);
    const hasContext = APPLY_CONTEXT.test(window);

    // Both signals are required. A recruiting-looking mailbox alone is not
    // enough — "careers@" also appears in "visit careers@ourcompany for our
    // culture page" — and apply-ish wording alone is not enough either, since
    // the EEO paragraph is full of the word "application". Demanding both is
    // what separates "send your CV to jobs@x.com" from boilerplate.
    if (!isHiringBox || !hasContext) continue;

    // An explicit instruction, not merely a nearby verb.
    const explicit = /(send|email|e-mail|forward|submit|share)[^.]{0,60}(cv|resume|r[ée]sum[ée]|application)[^.]{0,60}$|(cv|resume|r[ée]sum[ée])[^.]{0,40}(to|at)\s*$/i.test(window);

    candidates.push({
      email,
      confidence: explicit ? 'high' : 'medium',
      context: window.replace(/\s+/g, ' ').trim().slice(-140),
    });
  }

  if (!candidates.length) return null;
  const rank = { high: 0, medium: 1 };
  candidates.sort((a, b) => rank[a.confidence] - rank[b.confidence]);
  return candidates[0];
}
