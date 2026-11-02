# Job Agent

Finds jobs, scores them against Yousaf's actual background, and drafts a cover
letter for each one. You read the letter and hit submit.

It does **not** auto-submit applications. Automating LinkedIn Easy Apply means
defeating their bot detection, which risks a permanent account restriction and
is not something this project does. What it automates is the slow part —
searching, filtering, and writing — which is most of the work.

```
npm run daily     one full pass: mail -> sources -> scoring -> letters
npm run serve     dashboard on http://localhost:7171
npm run mail      read job-alert emails only
npm test          check every alert parser against fixtures
npm run cv        build the six regional CVs -> resume/<region>/
```

Both the daily pass and the dashboard are registered as Windows scheduled tasks,
so they run with VS Code closed and survive a reboot:

```
powershell -ExecutionPolicy Bypass -File scripts\install-tasks.ps1
```

| Task | When |
|---|---|
| `JobAgent Daily` | 08:00 every day |
| `JobAgent Dashboard` | at logon, serves `:7171` |

Remove them with
`Unregister-ScheduledTask -TaskName 'JobAgent Daily','JobAgent Dashboard' -Confirm:$false`.

## Sources

No API key needed:

| Source | What it covers |
|---|---|
| **LinkedIn** (public job search) | Bahrain, Saudi, UAE, Qatar, Kuwait, Oman — the bulk of the Gulf market |
| **Workable job search** | ~400 Gulf roles across every employer on Workable |
| Greenhouse | ~2,500 — real companies, apply on their own ATS |
| Ashby | ~1,350 — same |
| Arbeitnow | 250 — mostly Europe |
| The Muse | 100 — broad |
| Jobicy, RemoteOK, Remotive, Himalayas, Lever | ~300 remote |

### Job-alert emails — the important one

Every site worth using in the Gulf has no usable API, but all of them will email
you their listings if you ask. So: create job alerts on each site using
`yousaf.jobagent973@gmail.com`, and the agent reads them all out of that one
inbox.

| Site | Covers | How |
|---|---|---|
| **Indeed** | Bahrain, Saudi, AU, CA | search -> *Activate job alert* on the results page |
| **Bayt** | Gulf — biggest Bahrain board | account -> Job Alerts |
| **GulfTalent** | Gulf, senior-leaning | account -> Job Alerts |
| **LinkedIn** | everywhere | saved search -> alert on |
| **Glassdoor** | AU, CA | search -> Create job alert |

Parsers for all six live in `PROVIDERS` in `src/mail.js`, verified by `npm test`.
Adding another site means adding one entry with a regex that captures the
posting id from that site's links.

Optional, free API keys for extra Australia/Canada depth:

| Source | Covers | Sign up |
|---|---|---|
| Adzuna | Australia, Canada | <https://developer.adzuna.com/> |
| Jooble | Bahrain, Saudi | <https://jooble.org/api/about> |

LinkedIn is read through its **signed-out** public job search (the pages anyone
sees at linkedin.com/jobs), not an account, so there is no account to get
restricted. Its terms still discourage automated reading, so it runs slowly —
~1 request a second, Gulf only, last 30 days — and when LinkedIn answers 429 it
waits 75s and carries on, giving up for the day after 12 waits. Expect the
LinkedIn step to take 5–15 minutes of the daily run.

Bayt sits behind a Cloudflare challenge and is not read directly; its alert
emails are the route in. Indeed blocks scrapers; its alert emails (including
the newer "Job @ Company" match emails, whose links are gzipped redirects) are
parsed in `src/mail.js`.

## Regional CVs

`npm run cv` builds one CV per market from `src/cv-content.js`, and warns if
any line there is no longer in `career-ops/cv.md`:

| Version | Layout | Photo | Says |
|---|---|---|---|
| bahrain | two-column, A4 | yes | Bahraini national, no visa or permit |
| saudi | two-column, A4 | yes | GCC national, no sponsorship in KSA; ZATCA first |
| gulf | two-column, A4 | yes | GCC national, no sponsorship |
| canada | single column, Letter, -ize spelling | no | open to relocating; sponsorship goes in the letter |
| australia | single column, A4 | no | work rights (needs 482 sponsorship), referees line |
| remote | single column, A4 | no | UTC+3 |

The photo is `resume/photo.jpg`. The dashboard shows a **CV · region** button on
every job, and `npm run send` attaches the matching version.

## How scoring works

`src/score.js` returns a number *and the reasons for it*, which the dashboard
shows. A ranked list you cannot interrogate is one you stop trusting after the
first bad suggestion.

Hard rejections: non-engineering roles, talent marketplaces (Toptal, Lemon.io —
they list every stack so they match everyone and mean nothing), postings naming
10+ stacks, and roles whose title names a competing stack (a React job is not
an Angular job).

He is a **Bahraini national**: roles reserved for Bahraini nationals get +15,
roles reserved for Saudi, Emirati, Qatari, Kuwaiti or Omani nationals are
rejected. A remote role whose location names a country ("Brazil", "Remote -
US") is a residency requirement and is rejected. In the Gulf only, an
engineering role on another stack (React, Node) is kept at -25 instead of
rejected — the market is small enough that it is worth reading.

Then: stack overlap weighted by how central each skill is, doubled when it is in
the title · seniority against 3 years · location, matched **only** against the
location field · sponsorship language · ERP/multi-tenant/IoT domain familiarity ·
freshness.

Two bugs worth remembering, both fixed in `src/match.js`:

- `"Romania".includes("oman")` is `true`. Substring matching put a Bucharest job
  at the top of the list as a "no visa needed" Gulf role. Everything now matches
  on word boundaries.
- Matching location against the *description* made any posting that mentioned a
  Dubai office look like a Gulf job.

## career-ops — the second opinion

[career-ops](https://github.com/career-ops-hq/career-ops) (MIT) lives in
`career-ops/`, vendored into this private repo as a git subtree. The scorer here is fast and
explainable but only knows keywords; career-ops has Claude read the whole
posting against your CV, score it 1-5, and write a tailored CV PDF and cover
letter for the ones worth applying to.

The last step of `npm run daily` (or `npm run career-ops` on its own) appends
the best of the queue to `career-ops/data/pipeline.md`, its inbox. Then:

```
code career-ops              # open that folder as its own VS Code window
/career-ops pipeline         # in its Claude Code panel: evaluate the inbox
```

It has to be its own window: career-ops' instructions, `/career-ops` command
and Playwright browser (`career-ops/.mcp.json` — approve it on first use) only
load when Claude Code's working folder is `career-ops`.

Already set up there: `cv.md` (from the Business Consultant PDF — career-ops
fact-checks every tailored CV against it, so keep it true), `config/profile.yml`,
`modes/_profile.md` and `modes/_brief.md` (targeting and location policy, same
order as `src/profile.js`), and `portals.yml`. Salary target and notice period
are deliberately blank — fill them in `config/profile.yml` when decided.

`careerOps` in `config.json` sets which jobs go across: `minScore` (this
project's score, not career-ops'), `maxPerRun` (each one costs an evaluation),
and `dir`. Jobs you marked applied or dismissed are never sent, and nothing is
sent twice — dedup uses career-ops' own rules, so a job it already evaluated
stays out.

**Updating career-ops.** It is no longer its own git clone, so do NOT run
`npm run update` inside it — that script drives git and would act on this
repo instead. Pull upstream with git subtree from the job-agent root:

```
git subtree pull --prefix=career-ops https://github.com/career-ops-hq/career-ops.git main --squash
```

Your setup files there (`cv.md`, `config/profile.yml`, `modes/_profile.md`,
`_brief.md`, `_custom.md`, `portals.yml`, `voice-dna.md`, `.mcp.json`) are
committed here even though career-ops' own `.gitignore` lists them — upstream
never ships those files, so a pull cannot overwrite them. Its runtime output
(`data/`, `jds/`, `reports/`, `output/`) stays untracked.

## Files

```
src/sources.js   one adapter per job board -> a common Job shape
src/cv.js        regional CVs -> resume/<region>/  (npm run cv)
src/cv-content.js what the CV says — keep in step with career-ops/cv.md
src/match.js     word-boundary matching (14 tests in-file)
src/score.js     scoring + reasons
src/run.js       fetch, merge, score, rank -> data/jobs.json
src/mail.js      job-alert emails, 6 providers -> data/email-jobs.json
src/mail.test.js fixtures for every alert parser (npm test)
src/letters.js   per-posting cover letters -> data/letters.json
src/career-ops.js top of the queue -> career-ops/data/pipeline.md
src/daily.js     runs the four above, in order, never throwing
src/serve.js     dashboard server + applied/dismissed state
src/profile.js   Yousaf's profile — EDIT THIS to retune what it looks for
config.json      company board slugs, daily pick count, score threshold
```

`data/seen-jobs.json` keeps every posting for 30 days, because these feeds serve
a rolling window — a good match silently disappears from the API overnight while
the posting itself is still open. Descriptions are trimmed from the middle, not
the end: the sponsorship clause and the years-of-experience line are usually in
the last paragraphs.

## Tuning it

Everything worth changing is in `src/profile.js` (skills and their weights,
target regions, title filters) and `config.json` (`minScore`, `dailyPicks`,
which company boards to pull). Change a weight, run `npm run daily`, look at the
dashboard.

## The letters

`src/letters.js` assembles them — there is no paid model API in this project.
What makes them worth sending is that the evidence is *selected* per posting: a
job mentioning MQTT gets the device-integration paragraph, one mentioning ERP
gets the multi-tenant one, and the closing paragraph changes depending on
whether the role needs visa sponsorship.

**Read every letter before sending it.** They are a first draft with the right
facts in the right order, not a finished document.
