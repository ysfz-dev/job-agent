// Builds the autofill bookmarklet: inlines your profile into autofill-src.js,
// strips it down, and writes public/autofill.html with a draggable link.
//
//   node src/build-autofill.js
//
// Re-run after editing profile.application — the values are baked in at build
// time, so the bookmarklet keeps working with the dashboard closed.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './paths.js';
import profile from './profile.js';

const src = await readFile(path.join(ROOT, 'src', 'autofill-src.js'), 'utf8');

const code = src
  .replace('__PROFILE__', JSON.stringify(profile.application))
  .replace(/^\s*\/\/.*$/gm, '')        // line comments
  .replace(/\/\*[\s\S]*?\*\//g, '')    // block comments
  .replace(/\n\s*\n/g, '\n')
  .trim();

const href = `javascript:${encodeURIComponent(code)}`;

const app = profile.application;
const blanks = Object.entries(app)
  .filter(([, v]) => v === '' || v === null)
  .map(([k]) => k);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Autofill — Job Agent</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f7f9; --surface:#fff; --ink:#16191d;
          --muted:#5d6570; --line:#e2e6ea; --accent:#0f6b72; --warn:#8a5a08; --warn-bg:#fdf3e2; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#14171a; --surface:#1c2126; --ink:#e8eaed; --muted:#9aa4b0;
            --line:#2a3038; --accent:#4bb9c2; --warn:#e8be6a; --warn-bg:#332711; }
  }
  * { box-sizing:border-box }
  body { margin:0; background:var(--bg); color:var(--ink);
         font:15px/1.6 -apple-system,"Segoe UI",Roboto,sans-serif }
  .wrap { max-width:760px; margin:0 auto; padding:32px 20px 80px }
  h1 { font-size:21px; margin:0 0 6px }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.07em;
       color:var(--muted); margin:30px 0 10px }
  .sub { color:var(--muted); margin:0 0 26px }
  .drag { display:inline-block; background:var(--accent); color:#fff; font-weight:600;
          padding:12px 22px; border-radius:9px; text-decoration:none; font-size:16px }
  .card { background:var(--surface); border:1px solid var(--line);
          border-radius:12px; padding:18px 20px; margin:14px 0 }
  ol { margin:0; padding-left:20px } li { margin:7px 0 }
  code { background:var(--bg); border:1px solid var(--line); border-radius:4px;
         padding:1px 5px; font:13px ui-monospace,Consolas,monospace }
  table { border-collapse:collapse; width:100%; font-size:14px }
  td { padding:5px 10px 5px 0; border-bottom:1px solid var(--line); vertical-align:top }
  td:first-child { color:var(--muted); white-space:nowrap; width:40% }
  .warn { background:var(--warn-bg); color:var(--warn); border-radius:9px; padding:14px 18px }
</style></head><body><div class="wrap">

<h1>Autofill</h1>
<p class="sub">Drag the button to your bookmarks bar. On any job application page,
click it — it fills what it recognises, outlines each field, and leaves the rest to you.</p>

<p><a class="drag" href="${href.replace(/"/g, '&quot;')}">Fill Application</a></p>

<div class="card">
  <h2 style="margin-top:0">Setting it up</h2>
  <ol>
    <li>Press <code>Ctrl+Shift+B</code> to show the bookmarks bar</li>
    <li>Drag the teal button onto it</li>
    <li>Open a job application, click the bookmark</li>
    <li><strong>Read every field</strong>, fix anything wrong, submit yourself</li>
  </ol>
</div>

<h2>What it fills</h2>
<div class="card">
<table>
${Object.entries(app)
  .filter(([, v]) => v !== '' && v !== null)
  .map(([k, v]) => `  <tr><td>${k.replace(/([A-Z])/g, ' $1').toLowerCase()}</td><td>${String(v)}</td></tr>`)
  .join('\n')}
</table>
</div>

${blanks.length ? `<h2>Left blank on purpose</h2>
<div class="warn">
  <strong>${blanks.join(', ')}</strong>
  <p style="margin:8px 0 0">These are the questions that get applications auto-rejected,
  and the right answer changes per posting — notice period, salary, and whether you need
  sponsorship in <em>that</em> country. A script guessing them is worse than a blank field,
  so it flags them amber and stops. Set them in <code>src/profile.js</code> under
  <code>application</code> once you have decided, then re-run
  <code>node src/build-autofill.js</code>.</p>
</div>` : ''}

<h2>Why this instead of a bot</h2>
<div class="card">
  <p style="margin:0">This is ordinary JavaScript running on a page you opened, in your
  own browser — the same thing a password manager does. There is no automation framework
  driving the session, so <code>navigator.webdriver</code> stays <code>false</code> and
  there is nothing for a site's bot detection to find. You stay the one who reads the
  form and presses submit, which is also the part worth keeping a human on.</p>
</div>

</div></body></html>`;

await mkdir(path.join(ROOT, 'public'), { recursive: true });
await writeFile(path.join(ROOT, 'public', 'autofill.html'), html);

console.log(`built public/autofill.html  (bookmarklet ${(href.length / 1024).toFixed(1)} KB)`);
if (blanks.length) console.log(`  left blank, by design: ${blanks.join(', ')}`);
