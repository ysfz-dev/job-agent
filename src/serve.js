// The always-on dashboard. Runs independently of VS Code, of the terminal that
// started it, and of the daily job — it only reads what the daily job wrote.
//
//   node src/serve.js      -> http://localhost:7171

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './paths.js';
import { score } from './score.js';
import { writeLetter } from './letters.js';
import { cvFor, pdfPath, REGIONS } from './cv.js';

const DATA = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 7171);

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(path.join(DATA, file), 'utf8')); } catch { return fallback; }
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === '/api/state') {
      const [state, applied, dismissed, history] = await Promise.all([
        readJson('jobs.json', { picks: [], queue: [] }),
        readJson('applied.json', {}),
        readJson('dismissed.json', {}),
        readJson('history.json', []),
      ]);
      // Which regional CV each job should get, so the right one is a click away.
      const withCv = (jobs = []) => jobs.map((j) => {
        const { id, label } = cvFor(j);
        return { ...j, cv: { id, label } };
      });
      return send(res, 200, { ...state, picks: withCv(state.picks), queue: withCv(state.queue), applied, dismissed, history });
    }

    const cvMatch = url.pathname.match(/^\/cv\/([a-z]+)$/);
    if (cvMatch && REGIONS[cvMatch[1]]) {
      try {
        const pdf = await readFile(pdfPath(cvMatch[1]));
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        return res.end(pdf);
      } catch {
        return send(res, 404, { error: 'CV not built yet — run `npm run cv`' });
      }
    }

    // Marking a job applied or dismissed removes it from every future run, so
    // the same posting never occupies one of the five daily slots twice.
    if (url.pathname === '/api/mark' && req.method === 'POST') {
      const { id, action, job } = await readBody(req);
      if (!id || !['applied', 'dismissed', 'undo'].includes(action)) {
        return send(res, 400, { error: 'need id and action' });
      }
      const applied = await readJson('applied.json', {});
      const dismissed = await readJson('dismissed.json', {});

      delete applied[id];
      delete dismissed[id];

      // Enough of the job to render it later. Once marked, a job drops out of
      // the ranked feed, so anything not kept here is gone from the Applied and
      // Not-for-me views — including the region, which those views filter on.
      const snapshot = job && {
        at: new Date().toISOString(),
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        source: job.source,
        score: job.score?.total ?? null,
        region: job.score?.region ?? null,
      };
      if (action === 'applied') applied[id] = snapshot || { at: new Date().toISOString() };
      else if (action === 'dismissed') dismissed[id] = snapshot || { at: new Date().toISOString() };

      await writeFile(path.join(DATA, 'applied.json'), JSON.stringify(applied, null, 2));
      await writeFile(path.join(DATA, 'dismissed.json'), JSON.stringify(dismissed, null, 2));
      return send(res, 200, { ok: true, appliedCount: Object.keys(applied).length });
    }

    // Add a job by hand.
    //
    // The Gulf boards cannot be read automatically — Indeed, Bayt and
    // GulfTalent all block it, and scraping them is off the table. But there
    // are only about ten relevant Bahrain postings at any time, and he is
    // already looking at them in a browser. So the human does the finding,
    // which needs no permission from anyone, and the agent does the scoring,
    // the letter and the tracking, which is the part worth automating.
    if (url.pathname === '/api/add' && req.method === 'POST') {
      const body = await readBody(req);
      const title = (body.title || '').trim();
      if (!title) return send(res, 400, { error: 'title is required' });

      const manual = await readJson('manual-jobs.json', {});
      const id = `manual:${Date.now().toString(36)}`;

      const job = {
        source: 'added by hand',
        id,
        title,
        company: (body.company || '').trim(),
        location: (body.location || '').trim(),
        remote: /remote/i.test(`${body.location} ${body.description}`),
        url: (body.url || '').trim(),
        description: (body.description || '').trim(),
        tags: [],
        postedAt: new Date().toISOString(),
        addedAt: new Date().toISOString(),
      };

      manual[id] = job;
      await writeFile(path.join(DATA, 'manual-jobs.json'), JSON.stringify(manual, null, 2));

      // Score and write the letter immediately — waiting for tomorrow's 08:00
      // run to see whether a job you just pasted is worth applying to defeats
      // the point of pasting it.
      const scored = { ...job, score: score(job) };
      const letters = await readJson('letters.json', {});
      letters[id] = {
        title: job.title,
        company: job.company,
        writtenAt: new Date().toISOString(),
        text: writeLetter(scored),
      };
      await writeFile(path.join(DATA, 'letters.json'), JSON.stringify(letters, null, 2));

      const state = await readJson('jobs.json', { picks: [], queue: [] });
      state.queue = [scored, ...(state.queue || [])].sort((a, b) => b.score.total - a.score.total);
      if (scored.score.total > 0) state.picks = [scored, ...(state.picks || [])].slice(0, 8);
      state.totalRanked = (state.totalRanked || 0) + 1;
      await writeFile(path.join(DATA, 'jobs.json'), JSON.stringify(state, null, 2));

      return send(res, 200, { ok: true, id, score: scored.score });
    }

    if (url.pathname === '/api/letter') {
      const id = url.searchParams.get('id');
      const letters = await readJson('letters.json', {});
      return send(res, 200, letters[id] || null);
    }

    if (url.pathname === '/autofill' || url.pathname === '/autofill.html') {
      const page = await readFile(path.join(ROOT, 'public', 'autofill.html'), 'utf8');
      return send(res, 200, page, 'text/html; charset=utf-8');
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = await readFile(path.join(ROOT, 'public', 'index.html'), 'utf8');
      return send(res, 200, html, 'text/html; charset=utf-8');
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`job-agent dashboard on http://localhost:${PORT}`);
});
