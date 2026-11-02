# Yousaf Yousafzai — Triage Brief

<!-- ============================================================
     THIS FILE IS YOURS. It is USER LAYER — never auto-updated by
     `node update-system.mjs`.

     Compact context for first-pass triage agents (`modes/triage.md`).
     Keep it short: only what changes a go/no-go decision.
     ============================================================ -->

## Identity
Mid-level full-stack engineer (Angular + ASP.NET Core / C#, SQL Server) — 3+ yrs, plus client-facing business consulting. Manama, Bahrain (AST, UTC+3). Bahraini national (GCC citizen): no visa or sponsorship needed anywhere in the GCC, eligible for Bahraini-nationals-only roles; NOT eligible for Saudi/Emirati/Qatari/Kuwaiti/Omani-national-only roles. Needs sponsorship for Canada/Australia.

## Target Archetypes
| # | Archetype | What they buy (your proof) |
|---|-----------|----------------------------|
| 1 | **Full-Stack Engineer (Angular + .NET)** | Delivers multi-tenant ERP modules end to end: SQL Server, ASP.NET Core APIs, PDF reporting, Angular UI |
| 2 | **Backend .NET / C# Engineer** | ASP.NET Core REST APIs, EF Core + Dapper data layers, SQL Server business logic |
| 3 | **Frontend Angular Engineer** | Built the shared Angular component library (Material, DevExtreme, Tailwind); full Arabic/English RTL |
| 4 | **ERP / Business Systems Developer** | Optimum ERP across 8 domains; ZATCA phase-2 e-invoicing and double-entry accounting in his own platform |
| 5 | **Technical Solutions / Pre-sales Consultant** (adjacent) | Pre-sales meetings; BIC time-attendance rollout end to end |

Analog titles that count as hits: Software Engineer/Developer (when the stack is .NET and/or Angular), Web Developer, Application Developer, Dotnet Developer, C# Developer, ERP Developer.

## Proof Points (use exact metrics in matching)
- Optimum ERP: one multi-tenant platform covering 8 business domains (HR, Finance, Procurement, Attendance, Access Control, Assets, Documents, CRM)
- Bahrain International Circuit time-attendance: requirements, biometric device integration over MQTT, rollout and staff training — end to end
- Tajer Al Fareej (live, solo founder): bilingual RTL e-commerce with Saudi ZATCA phase-2 e-invoicing, NestJS + PostgreSQL, Playwright tests, CI, React Native app

## Comp Strategy
No target set yet. Do not filter on comp; never quote a number.

## Location Scoring
- Bahrain (Manama), any arrangement → **5.0**
- Riyadh / Saudi Arabia → **4.5**
- Remote, open worldwide or to Bahrain → **4.5**
- Rest of the Gulf (UAE, Qatar, Kuwait, Oman) → **4.0**
- Canada with sponsorship → **3.5**; Australia with sponsorship → **3.0**
- Elsewhere, with explicit relocation/sponsorship → **2.5–3.0**
- Elsewhere without it, or "remote" limited to another country → **FAIL**

## Hard DQ Criteria — instant FAIL (< 3.0)
- Title names a competing primary stack (React, Vue, Java, Spring, Python, Django, Go, Ruby, PHP/Laravel-only, iOS/Android native)
- Senior-only bar: principal, staff, lead, architect, head of, director, manager, or 7+ years required
- Not an engineering/consulting role (sales quota, marketing, recruiting, design, data entry, teaching)
- Canada/Australia role that states it will not sponsor visas
- Location outside his list with no relocation/sponsorship and no remote-for-Bahrain option
- Talent marketplaces listing every stack (Toptal, Lemon.io and similar)

## Quick Scoring Guide

Bands are relative to `triage_threshold` (`config/profile.yml → pipeline.triage_threshold`,
default **3.5**), matching the verdict table in `modes/triage.md` — so a score at or
above the threshold is PASS, and only the band below it is MARGINAL.

| Score | Verdict | What it means |
|-------|---------|---------------|
| ≥ threshold (default 3.5) | **PASS** | Clears the bar — strong archetype + comp + location, gaps bridgeable |
| 3.0 – (threshold − 0.1) | **MARGINAL** | Borderline — shown to user as one line |
| < 3.0 | **FAIL** | Does not clear the bar — filtered |

## Soft Red Flags (−0.5 each, additive)
- Asks 5–6 years (he has 3+)
- Heavy cloud/DevOps ownership (Kubernetes, Terraform) as the core of the job — he has AZ-104 but not that depth
- Only one of Angular / .NET, with the other side in a stack he has not used
- No description published (cannot verify the stack)

## Priority Override List — always return PASS regardless of score
- (none yet)
