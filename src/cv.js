// One CV per region, built from src/cv-content.js.
//
// The same facts, presented the way each market expects them:
//
//   Gulf (Bahrain, Saudi, rest of GCC) — photo, and "Nationality: Bahraini"
//     as one quiet line under Contact. Gulf recruiters look for it; it needs
//     no explanation of visas beside it.
//   Canada, Australia — no photo, no nationality, no personal details. Both
//     countries' recruiters are trained to avoid them for anti-discrimination
//     reasons, and a photo can get a CV set aside unread. Single column,
//     because the ATSes there (Workday, Taleo, iCIMS) misread sidebars.
//   Remote — the same ATS-safe layout, with the time zone instead.
//
//   npm run cv      writes resume/<region>/Yousaf Yousafzai - Software Engineer.pdf
//
// PDFs are printed by the Microsoft Edge that ships with Windows, headless,
// so there is nothing to install.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { ROOT, isMain } from './paths.js';
import cv from './cv-content.js';

const OUT = path.join(ROOT, 'resume');
const FILE = 'Yousaf Yousafzai - Software Engineer';
const PHOTO = path.join(OUT, 'photo.jpg');

export const REGIONS = {
  bahrain: {
    label: 'Bahrain',
    layout: 'gulf',
    paper: 'A4',
  },
  saudi: {
    label: 'Saudi Arabia',
    layout: 'gulf',
    paper: 'A4',
    // ZATCA e-invoicing is a Saudi regulatory requirement he has already built
    // against the official sandbox — the line a Saudi hiring manager stops on.
    lead: ['zatca'],
  },
  gulf: {
    label: 'UAE, Qatar, Kuwait, Oman',
    layout: 'gulf',
    paper: 'A4',
    lead: ['qatar', 'bic'],
  },
  canada: {
    label: 'Canada',
    layout: 'ats',
    paper: 'Letter',
    spelling: 'us',
    // Sponsorship is said in the cover letter (src/letters.js), not here: a
    // Canadian CV carries no immigration status, and the letter can explain it.
    where: 'Manama, Bahrain · open to relocating to Canada',
  },
  australia: {
    label: 'Australia',
    layout: 'ats',
    paper: 'A4',
    where: 'Manama, Bahrain · open to relocating to Australia',
    // Australian recruiters expect work rights stated on the resume itself;
    // leaving it off reads as hiding it.
    workRights: 'Requires employer sponsorship (Skills in Demand visa, subclass 482). Available to relocate.',
    referees: true,
  },
  remote: {
    label: 'Remote / international',
    layout: 'ats',
    paper: 'A4',
    where: 'Manama, Bahrain · UTC+3 · remote, overlapping European and Gulf hours',
  },
};

// Which CV goes with a job, from the location tier the scorer matched.
// Anything else — a European role offering relocation — gets the
// international one: no photo is the safer default outside the Gulf.
const BY_TIER = {
  'Bahrain': 'bahrain',
  'Riyadh': 'saudi',
  'Saudi Arabia': 'saudi',
  'Gulf': 'gulf',
  'Canada': 'canada',
  'Australia': 'australia',
  'remote, worldwide': 'remote',
};

export const pdfPath = (id) => path.join(OUT, id, `${FILE}.pdf`);

export function cvFor(job) {
  const id = BY_TIER[job.score?.region] || 'remote';
  return { id, label: REGIONS[id].label, path: pdfPath(id) };
}

// --- text ------------------------------------------------------------------

const US = [['localisation', 'localization'], ['synchronised', 'synchronized'],
  ['organisation', 'organization'], ['optimise', 'optimize'], ['recognise', 'recognize']];

function speller(region) {
  if (region.spelling !== 'us') return (s) => s;
  return (s) => US.reduce((t, [a, b]) => t.replaceAll(a, b), s);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function rich(s, spell) {
  return esc(spell(s)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

// The bullets this region leads with, then the rest in their usual order.
function ordered(bullets, lead = []) {
  const first = lead.map((id) => bullets.find((b) => b.id === id)).filter(Boolean);
  return [...first, ...bullets.filter((b) => !first.includes(b))];
}

// --- layouts ---------------------------------------------------------------

const FONT = '<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">';

function experience(region, r) {
  const jobs = cv.jobs.map((j) => `
    <div class="job"><span class="date">${esc(j.dates)}</span>
      <div class="role">${r(j.role)}</div><div class="org">${r(j.org)}</div>
      ${j.intro ? `<p class="intro">${r(j.intro)}</p>` : ''}
      <ul>${ordered(j.bullets, region.lead).map((b) => `<li>${r(b.text)}</li>`).join('')}</ul>
    </div>`).join('');
  const projects = cv.projects.map((p) => `
    <div class="proj"><b>${r(p.name)}</b> <span class="muted">· ${r(p.meta)}</span>
      <ul>${ordered(p.bullets, region.lead).map((b) => `<li>${r(b.text)}</li>`).join('')}</ul>
    </div>`).join('');
  return { jobs, projects };
}

// The design of the CV he already sends in the Gulf (Documents/CV/cv.html),
// with the photo and nationality.
function gulf(region, photo) {
  const r = (s) => rich(s, speller(region));
  const { jobs, projects } = experience(region, r);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${FILE} — ${region.label}</title>${FONT}
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Open Sans', Arial, sans-serif; color: #1f2937; font-size: 8.7pt; line-height: 1.38; }
  .page { width: 210mm; min-height: 297mm; display: grid; grid-template-rows: auto 1fr; }
  header { background: #173a5e; color: #fff; padding: 9mm 13mm 8mm; display: flex; align-items: center; justify-content: space-between; }
  header h1 { font-size: 27pt; font-weight: 300; letter-spacing: 0.04em; line-height: 1; }
  header h1 b { font-weight: 800; }
  header p { margin-top: 3mm; font-size: 7.8pt; letter-spacing: 0.18em; text-transform: uppercase; color: #b9cbe0; font-weight: 600; }
  header img { width: 29mm; height: 29mm; border-radius: 50%; object-fit: cover; object-position: center 28%; border: 1.2mm solid #e8eef5; }
  .cols { display: grid; grid-template-columns: 66mm 1fr; }
  aside { background: #eef2f6; padding: 6mm 6mm 5mm 9mm; }
  main { padding: 6mm 11mm 5mm 8mm; }
  h2 { font-size: 8.8pt; letter-spacing: 0.16em; text-transform: uppercase; color: #173a5e; font-weight: 800; display: flex; align-items: center; gap: 2mm; margin: 0 0 2.2mm; }
  h2::after { content: ''; flex: 1; height: 1px; background: #c7d2de; }
  aside section + section, main section + section { margin-top: 3.6mm; }
  .contact div { margin-bottom: 0.8mm; font-size: 8.3pt; }
  h3 { font-size: 7.2pt; letter-spacing: 0.12em; text-transform: uppercase; color: #173a5e; font-weight: 800; margin: 1.8mm 0 0.3mm; }
  .skill { font-size: 8.3pt; }
  .edu b, .cert b { display: block; font-size: 9pt; }
  .muted { color: #6b7280; font-size: 8.4pt; }
  .lang { display: flex; justify-content: space-between; font-size: 8.8pt; margin-top: 1.6mm; }
  .bar { height: 1.3mm; background: #d5dde6; border-radius: 1mm; margin-top: 0.8mm; }
  .bar i { display: block; height: 100%; background: #2f6fa3; border-radius: 1mm; }
  .job { position: relative; padding-left: 5mm; border-left: 1px solid #c7d2de; margin-left: 1.6mm; padding-bottom: 2.2mm; }
  .job:last-child { padding-bottom: 0; }
  .job::before { content: ''; position: absolute; left: -1.7mm; top: 0.8mm; width: 2.4mm; height: 2.4mm; border: 0.6mm solid #173a5e; border-radius: 50%; background: #fff; }
  .date { display: inline-block; background: #e3ebf3; color: #173a5e; font-weight: 700; font-size: 8pt; padding: 0.4mm 2.6mm; border-radius: 3mm; }
  .role { font-size: 10pt; font-weight: 700; margin-top: 1mm; }
  .org { color: #4b5563; font-size: 8.9pt; }
  .intro { margin-top: 1mm; }
  ul { margin: 1.2mm 0 0 4mm; }
  li { margin-bottom: 0.45mm; }
  li::marker { color: #2f6fa3; }
  .proj > b { font-size: 9.8pt; }
  .proj + .proj { margin-top: 1.8mm; }
</style></head>
<body><div class="page">
<header>
  <div><h1>${esc(cv.name[0])} <b>${esc(cv.name[1])}</b></h1><p>${esc(cv.headline)}</p></div>
  ${photo ? `<img src="${photo}" alt="">` : ''}
</header>
<div class="cols">
<aside>
  <section class="contact"><h2>Contact</h2>
    <div>✉ ${esc(cv.email)}</div><div>☎ ${esc(cv.phone)}</div><div>● ${esc(cv.city)}</div><div>↗ ${esc(cv.linkedin)}</div>
    <div>⚑ Nationality: ${esc(cv.nationality)}</div>
  </section>
  <section><h2>Technical skills</h2>
    ${cv.skills.map(([k, v]) => `<h3>${esc(k)}</h3><div class="skill">${esc(v)}</div>`).join('')}
  </section>
  <section><h2>Consulting</h2><div class="skill">${esc(cv.consulting)}</div></section>
  <section class="edu"><h2>Education</h2><b>${esc(cv.education.degree)}</b><div>${esc(cv.education.school)}</div><div class="muted">${esc(cv.education.dates)}</div></section>
  <section class="cert"><h2>Certification</h2><b>${esc(cv.certification.name)}</b><div>${esc(cv.certification.issuer)}</div><div class="muted">${esc(cv.certification.date)}</div></section>
  <section><h2>Languages</h2>
    ${cv.languages.map(([l, lvl, pct]) => `<div class="lang"><b>${esc(l)}</b><span class="muted">${esc(lvl)}</span></div><div class="bar"><i style="width:${pct}%"></i></div>`).join('')}
  </section>
</aside>
<main>
  <section><h2>Profile</h2><p>${r(cv.profile)}</p></section>
  <section><h2>Work experience</h2>${jobs}</section>
  <section><h2>Projects</h2>${projects}</section>
</main>
</div>
</div></body></html>`;
}

// Single column, no photo, no personal details, real text everywhere — what
// an ATS parses cleanly and what Canadian and Australian recruiters expect.
function ats(region) {
  const r = (s) => rich(s, speller(region));
  const { jobs, projects } = experience(region, r);
  const size = region.paper === 'Letter' ? 'Letter' : 'A4';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${FILE} — ${region.label}</title>${FONT}
<style>
  @page { size: ${size}; margin: ${size === 'Letter' ? '7mm' : '9mm'} 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Open Sans', Arial, sans-serif; color: #1f2937; font-size: ${size === 'Letter' ? '8.2pt' : '8.5pt'}; line-height: 1.33; }
  header { border-bottom: 2px solid #173a5e; padding-bottom: 2.4mm; margin-bottom: 2mm; }
  h1 { font-size: 22pt; font-weight: 300; letter-spacing: 0.04em; line-height: 1; color: #173a5e; }
  h1 b { font-weight: 800; }
  .headline { margin-top: 1.6mm; font-size: 10pt; font-weight: 600; color: #374151; }
  .contact { margin-top: 1.4mm; font-size: 8.6pt; color: #4b5563; }
  h2 { font-size: 9pt; letter-spacing: 0.14em; text-transform: uppercase; color: #173a5e; font-weight: 800; margin: 3mm 0 1.4mm; border-bottom: 1px solid #c7d2de; padding-bottom: 0.8mm; }
  .job, .proj { margin-bottom: 2mm; break-inside: avoid; }
  .job .date { float: right; font-weight: 600; color: #4b5563; font-size: 8.6pt; }
  .role { font-size: 10pt; font-weight: 700; }
  .org { color: #4b5563; }
  .intro { margin-top: 0.8mm; }
  .muted { color: #6b7280; }
  ul { margin: 1mm 0 0 4.5mm; }
  li { margin-bottom: 0.5mm; }
  /* Two columns of plain text lines: still read top to bottom by a parser. */
  .skills { display: grid; grid-template-columns: 1fr 1fr; column-gap: 6mm; }
  .skills div { margin-bottom: 0.5mm; }
  .skills .wide { grid-column: 1 / -1; }
  .skills b { color: #173a5e; }
  .foot { margin-top: 1.5mm; font-style: italic; color: #4b5563; }
</style></head>
<body>
<header>
  <h1>${esc(cv.name[0])} <b>${esc(cv.name[1])}</b></h1>
  <div class="headline">${esc(cv.headline)}</div>
  <div class="contact">${esc(region.where)}<br>${esc(cv.email)} · ${esc(cv.phone)} · ${esc(cv.linkedin)} · ${esc(cv.portfolio)}${region.workRights ? `<br><b>Work rights:</b> ${esc(region.workRights)}` : ''}</div>
</header>
<h2>Profile</h2><p>${r(cv.profile)}</p>
<h2>Work experience</h2>${jobs}
<h2>Projects</h2>${projects}
<h2>Skills</h2>
<div class="skills">
  ${cv.skills.map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join('')}
  <div class="wide"><b>Consulting:</b> ${r(cv.consulting)}</div>
  <div class="wide"><b>Spoken languages:</b> ${cv.languages.map(([l, lvl]) => `${esc(l)} (${esc(lvl.toLowerCase())})`).join(', ')}</div>
</div>
<h2>Education &amp; certification</h2>
<div><b>${esc(cv.education.degree)}</b>, ${esc(cv.education.school)} <span class="muted">· ${esc(cv.education.dates)}</span></div>
<div><b>${esc(cv.certification.name)}</b>, ${esc(cv.certification.issuer)} <span class="muted">· ${esc(cv.certification.date)}</span></div>
${region.referees ? '<p class="foot">Referees available on request.</p>' : ''}
</body></html>`;
}

// --- checks and printing ---------------------------------------------------

// Every sentence on the CV must still be in career-ops/cv.md, the file
// career-ops fact-checks tailored CVs against. Drift is reported, not fixed:
// which of the two is right is a decision, not a merge.
function driftFrom(cvMd) {
  const norm = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').replace(/\.$/, '').trim().toLowerCase();
  const source = norm(cvMd);
  const lines = [cv.profile, ...cv.jobs.flatMap((j) => [j.intro, ...j.bullets.map((b) => b.text)]),
    ...cv.projects.flatMap((p) => p.bullets.map((b) => b.text))].filter(Boolean);
  return lines.filter((l) => !source.includes(norm(l)));
}

function findEdge() {
  return [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].find(existsSync);
}

function printPdf(browser, html, pdf) {
  const res = spawnSync(browser, [
    '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
    '--virtual-time-budget=8000',           // lets the web font load before printing
    `--print-to-pdf=${pdf}`, pathToFileURL(html).href,
  ], { timeout: 60000 });
  if (!existsSync(pdf)) throw new Error(`printing ${path.basename(html)} failed: ${res.stderr?.toString().slice(0, 300)}`);
}

// Chromium writes one "/Type /Page" object per page.
function pageCount(pdf) {
  return (readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length;
}

async function main() {
  const browser = findEdge();
  if (!browser) throw new Error('Microsoft Edge not found — it is needed to print the PDFs.');

  try {
    const drift = driftFrom(await readFile(path.join(ROOT, 'career-ops', 'cv.md'), 'utf8'));
    if (drift.length) {
      console.log('WARNING — these lines are not in career-ops/cv.md any more:');
      for (const l of drift) console.log(`  - ${l.slice(0, 100)}`);
      console.log('');
    }
  } catch { console.log('(career-ops/cv.md not found — skipping the fact check)\n'); }

  // Inlined, so the printed page cannot lose it to a relative path.
  const photo = existsSync(PHOTO)
    ? `data:image/jpeg;base64,${(await readFile(PHOTO)).toString('base64')}`
    : null;
  if (!photo) console.log(`no photo at ${PHOTO} — Gulf CVs will be printed without one\n`);

  const only = process.argv.slice(2);
  for (const [id, region] of Object.entries(REGIONS)) {
    if (only.length && !only.includes(id)) continue;
    const dir = path.join(OUT, id);
    await mkdir(dir, { recursive: true });
    const html = path.join(dir, `${FILE}.html`);
    await writeFile(html, region.layout === 'gulf' ? gulf(region, photo) : ats(region));
    printPdf(browser, html, pdfPath(id));

    const pages = pageCount(pdfPath(id));
    // The Gulf design is built as a single A4 sheet; a second page means
    // something grew and the layout needs trimming, not a two-page CV.
    const warn = region.layout === 'gulf' && pages > 1 ? '  <- spills onto a 2nd page, trim it' : '';
    console.log(`  ${id.padEnd(10)} ${region.label.padEnd(24)} ${pages} page(s)  ${path.relative(ROOT, pdfPath(id))}${warn}`);
  }
}

if (isMain(import.meta.url)) {
  main().catch((e) => { console.error('cv failed:', e.message); process.exit(1); });
}
