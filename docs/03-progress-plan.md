# 03 - Progress plan (ADHD Check hackathon)

Status: living document. Version 0.1, written 2026-10-19. Requirements are in `docs/02-specification-cahier-des-charges.md`; user needs in `docs/01-user-needs.md`; the 48 h plan by role comes from `research/03-tech-stack.md` section 12.

## 1. Team

Roles R1 to R5 follow `research/03-tech-stack.md` section 12. Names are TODO until the team is known.

| Role | Name | Main responsibility | Main FR and NFR owned |
|---|---|---|---|
| R1 Game dev | TODO | `packages/game`: Phaser scenes, go/no-go engine, timing, session recorder, QR-launch route | FR-01 to FR-16, FR-60 to FR-64, NFR-20 to NFR-22, NFR-25, NFR-31, NFR-35, NFR-40 |
| R2 Scoring / data | TODO | `packages/contracts` (with R3), `packages/scoring`, thresholds file, fixtures, demo seed data | FR-20 to FR-26, FR-55 (data), NFR-23, NFR-24 |
| R3 Backend | TODO | Supabase (Frankfurt), migrations, RLS, `/api/sessions`, auth, rate limit, secrets audit, Realtime or polling | FR-11 (server side), FR-30, FR-39, FR-41, FR-55, FR-56, NFR-01 to NFR-03, NFR-06, NFR-10 to NFR-13 |
| R4 Parent dashboard + payments | TODO | Next.js dashboard, result card, missions, progress chart, Stripe, Resend | FR-31 to FR-38, FR-40, FR-42, FR-43, FR-45 to FR-48, FR-50, NFR-05, NFR-14, NFR-30, NFR-36, NFR-41, NFR-42, NFR-45 |
| R5 Pitch / clinical / regulatory | TODO | Intended purpose, claims and string review, consent text, safety checklists, demo script, pitch, jury Q&A | FR-34 and FR-36 texts (review), NFR-04, NFR-07, NFR-50 to NFR-53, NFR-60, NFR-61, open decisions in 02 section 10 |

If the team has 4 people, R5 is shared (PROPOSAL: R2 and R5 merge, since scoring limits and claims are the same story). TODO: confirm once names are known.

## 2. Timeline

**TODO: replace with the real deadlines.** The exact hackathon schedule is not known; 03 plans for "24 to 48 h". Hours are relative to the kick-off (H+0). If the event is 24 h, halve every slot and keep the milestone order.

| Phase | Hours (from 03 section 12) | Focus |
|---|---|---|
| 1 | H+0 to H+12 | Scaffold, contracts, Supabase and RLS, Phaser loop, auth shell, claim wording |
| 2 | H+12 to H+30 | Feature build: game polish, scorer, API, dashboard, Stripe, regulatory and GDPR slides |
| 3 | H+30 to H+48 | Email, gating, demo seed, hardening, rehearsal, pitch |

| Milestone | When | Exit criterion | Source of the time |
|---|---|---|---|
| M1 Contracts frozen | H+6 | `SessionMetrics` v1, `ScoreResult` v1 and table names merged in `packages/contracts` and `supabase/migrations`; owners sign off in the PR | 03 section 12 ("Interfaces freeze at hour 6") |
| M2 End-to-end walking skeleton | H+12 (PROPOSAL) | QR opens a bare game on the demo tablet, a session posts, a score is saved, the parent sees a plain result card | PROPOSAL: end of phase 1 |
| M3 Feature complete | H+30 (PROPOSAL) | Every Must FR passes its acceptance criterion; Should FRs done or explicitly cut in section 3 | PROPOSAL: end of phase 2 |
| M4 Demo rehearsal | H+44 (PROPOSAL) | Full demo script (section 5) run twice on the production alias with the demo tablet; fallback recording made | PROPOSAL |
| M5 Pitch | H+48 (TODO: real slot) | Pitch delivered | TODO |

## 3. Progress tracker

Status values: `todo`, `doing`, `done`. Update in the same PR that changes the status. PR link: paste the GitHub PR URL.

| ID | Title | Owner | Priority | Status | PR |
|---|---|---|---|---|---|
| FR-01 | Session link and QR open the game | R1 | Must | doing | server side (play links): https://github.com/mateidragomir74/adhdcheck/pull/6; play page: https://github.com/mateidragomir74/adhdcheck/pull/13 (waits for the go/no-go game) |
| FR-02 | Onboarding and practice round | R1 | Must | todo | |
| FR-03 | Calibration block | R1 | Must | todo | |
| FR-04 | Go/no-go task with declared parameters | R1 | Must | todo | |
| FR-05 | Mini-game levels, no failure screen | R1 | Must | todo | |
| FR-06 | rAF onset and pointerdown timestamps | R1 | Must | todo | |
| FR-07 | Off-target taps | R1 | Must | todo | |
| FR-08 | Device facts | R1 | Must | todo | |
| FR-09 | Trial outcome classification | R1 with R2 | Must | todo | |
| FR-10 | Emit valid SessionMetrics v1 | R1 with R2 | Must | todo | |
| FR-11 | Upload to /api/sessions | R1 with R3 | Must | doing | server side: https://github.com/mateidragomir74/adhdcheck/pull/5, https://github.com/mateidragomir74/adhdcheck/pull/6 |
| FR-12 | Offline retry, no replay | R1 | Should | doing | https://github.com/mateidragomir74/adhdcheck/pull/8 (upload retries), https://github.com/mateidragomir74/adhdcheck/pull/13 (play page) |
| FR-13 | Demo round 60 to 90 s | R1 | Must | todo | |
| FR-14 | Full screen and orientation | R1 | Should | doing | play page start tap: https://github.com/mateidragomir74/adhdcheck/pull/13 |
| FR-15 | Child never sees the result | R1 | Must | doing | play page end screen: https://github.com/mateidragomir74/adhdcheck/pull/13 |
| FR-16 | No ads, purchases, external links | R1 | Must | todo | |
| FR-20 | Validate session, minimum trials | R2 with R3 | Must | doing | server side (validation): https://github.com/mateidragomir74/adhdcheck/pull/5 |
| FR-21 | Server-side indicators | R2 | Must | todo | |
| FR-22 | thresholds.v0.json with validated false | R2 | Must | todo | |
| FR-23 | Band assignment and data quality | R2 | Must | todo | |
| FR-24 | Reasons, method, disclaimer | R2 | Must | todo | |
| FR-25 | Deterministic, versioned scoring | R2 | Must | todo | |
| FR-26 | No score-selected mission IDs | R2 | Must | todo | |
| FR-30 | Parent auth | R3 | Must | doing | https://github.com/mateidragomir74/adhdcheck/pull/6 |
| FR-31 | Child profile, nickname and birth year only | R4 | Must | doing | minimal screen: https://github.com/mateidragomir74/adhdcheck/pull/14 |
| FR-32 | Start session, QR and link | R4 | Must | doing | minimal screen: https://github.com/mateidragomir74/adhdcheck/pull/14 |
| FR-33 | Result card | R4 | Must | doing | minimal screen: https://github.com/mateidragomir74/adhdcheck/pull/14 |
| FR-34 | Fixed result wording | R4 with R5 | Must | doing | headlines copied: https://github.com/mateidragomir74/adhdcheck/pull/14 (supporting lines: R5) |
| FR-35 | Next step and clinician summary | R4 with R5 | Must / Should | todo | |
| FR-36 | Recommendations, no treatment claims | R4 with R5 | Should | todo | |
| FR-37 | Parent-chosen missions | R4 | Should | doing | data side (table, RLS, helpers): https://github.com/mateidragomir74/adhdcheck/pull/8; minimal screen: https://github.com/mateidragomir74/adhdcheck/pull/14 |
| FR-38 | Progress chart | R4 | Should | doing | data side (helpers, seeded data): https://github.com/mateidragomir74/adhdcheck/pull/8; minimal chart: https://github.com/mateidragomir74/adhdcheck/pull/14 |
| FR-39 | Result without manual refresh | R3 with R4 | Could | doing | Realtime on scores: https://github.com/mateidragomir74/adhdcheck/pull/8; QR screen: https://github.com/mateidragomir74/adhdcheck/pull/14 |
| FR-40 | Shareable result image | R4 | Could | todo | |
| FR-41 | Delete child and all data | R3 | Must | doing | https://github.com/mateidragomir74/adhdcheck/pull/4, https://github.com/mateidragomir74/adhdcheck/pull/7 |
| FR-42 | Landing page with QR | R4 | Should | doing | landing page: https://github.com/mateidragomir74/adhdcheck/pull/1 (merged); waitlist storage: https://github.com/mateidragomir74/adhdcheck/pull/9 |
| FR-43 | Parent questionnaire (NICHQ Vanderbilt), permission TODO | R4 with R5 | Should | todo | |
| FR-45 | Stripe Checkout, one-off report purchase 9.99 EUR (D-05b) | R4 | Should | doing | API: https://github.com/mateidragomir74/adhdcheck/pull/10; one-off: branch `feat/D-05b-one-off-report-email` |
| FR-46 | Customer Portal (retired with D-05b) | R4 | n/a | retired | |
| FR-47 | Stripe webhook: mark paid once, email the report (D-05b) | R4 | Should | doing | https://github.com/mateidragomir74/adhdcheck/pull/10; one-off: branch `feat/D-05b-one-off-report-email` |
| FR-48 | Result and next step never paywalled | R4 | Must | doing | https://github.com/mateidragomir74/adhdcheck/pull/14 |
| FR-50 | Emails without result data | R4 | Should | todo | |
| FR-55 | Demo seed, 4 weeks | R3 with R2 | Must | doing | https://github.com/mateidragomir74/adhdcheck/pull/7, https://github.com/mateidragomir74/adhdcheck/pull/8 (synthetic scores until the scoring rules exist; packages/scoring is a stub) |
| FR-56 | Reset demo button | R3 | Should | doing | API: https://github.com/mateidragomir74/adhdcheck/pull/7; button: https://github.com/mateidragomir74/adhdcheck/pull/14; rehearsal script: https://github.com/mateidragomir74/adhdcheck/pull/12 |
| FR-60 | Storm Watch mini-game | R1 | Should | doing | 3D Go/No-Go distraction task (MOXO d-CPT) with visual & auditory cues |
| FR-61 | Star Path mini-game | R1 | Could | doing | https://github.com/mateidragomir74/adhdcheck/pull/11 |
| FR-62 | Bridge Wait mini-game | R1 | Could | doing | https://github.com/mateidragomir74/adhdcheck/pull/3 |
| FR-63 | Treasure Choice mini-game | R1 | Could | todo | |
| FR-64 | Route Planner mini-game (optional) | R1 | Could | doing | https://github.com/mateidragomir74/adhdcheck/pull/16 |
| FR-70 | Camera and microphone consent, both off by default | R4 with R3 | Must | doing | https://github.com/mateidragomir74/adhdcheck/pull/17 (texts: R5) |

NFRs are checked at M3 and M4 against the verification column of 02 section 5; their owners are in section 1.

## 4. Definition of done

A requirement is `done` only when all of these are true:

1. Its acceptance criterion in 02 passes, and the PR says how it was checked (test name, or manual steps and device).
2. The code is merged to `main` through a reviewed PR (one reviewer other than the author).
3. Tests added or updated where the FR names one (scoring, contracts, RLS).
4. No secret in the diff; `.env.example` updated with names only if a new variable was added (NFR-10).
5. User-facing strings reviewed by R5 against FR-34, NFR-50 and NFR-53 (no diagnosis, probability, severity or treatment wording).
6. It works on the production alias (not only locally), and child-app FRs work on the demo tablet.
7. This tracker row is set to `done` with the PR link.

## 5. Demo script checklist

From 03 section 9; timing TODO (03 suggests about 3 minutes for the live flow).

- [ ] Production alias open on the big screen; demo tablet charged, full screen, named browser (NFR-25, NFR-42).
- [ ] Landing page shows the QR (FR-42).
- [ ] Parent logs in to the seeded account (FR-30, FR-55).
- [ ] Parent starts a session for the demo child; tablet scans the QR (FR-32, FR-01).
- [ ] Child plays the 60 to 90 s demo round with practice and calibration (FR-02, FR-03, FR-13).
- [ ] Session uploads; result card appears on the big screen (FR-11, FR-33, FR-39 or manual refresh).
- [ ] Show the headline wording and the disclaimer; point out that no probability or severity is shown (FR-34, NFR-53).
- [ ] Open the next-step page and the clinician summary (FR-35).
- [ ] Show the 4-week progress chart and parent-chosen missions (FR-37, FR-38).
- [ ] Buy one report with Stripe test checkout and show the email with the link to the report behind login (FR-45, FR-47, FR-51; the PDF is not attached, R3-D1).
- [ ] Show the email that arrived, with no result data in it (FR-50).
- [ ] Timing slide: "we measure variability, not absolute speed" (03 section 9 item 5).
- [ ] Regulatory slide: intended purpose (DRAFT), expected class IIa, design constraints, validation plan (02 section 2).
- [ ] Reset demo after rehearsal (FR-56).
- [ ] Fallback: screen recording and seeded account ready if the venue wifi fails (03 section 9).

## 6. Risks and mitigations

| Risk | Effect | Mitigation | Owner |
|---|---|---|---|
| Venue wifi fails | Live demo breaks | Screen recording and seeded account (03 section 9); offline retry (FR-12) | R5, R1 |
| Touch timing differs on the demo tablet | Indicators look wrong | Timing probe early in phase 1; within-child indices only (NFR-20, NFR-23) | R1, R2 |
| Phaser 4 blocker | Game delayed | Fall back to Phaser 3.x or plain canvas (03 section 1) | R1 |
| Contract change after M1 | Integration breaks late | Contracts change only by team agreement (section 7) | R2, R3 |
| Wording drifts to diagnosis or severity | Regulatory and ethical failure, jury challenge | R5 reviews every user-facing string (definition of done item 5) | R5 |
| Missions wired to the score | Rule 22 class III exposure (02 Part 2.4 item 4) | FR-26 and FR-37 tests; NFR-52 | R2, R4 |
| Secret pushed to the public repo | Key leak | `.env.example` only, review every diff, rotate any leaked key at once (NFR-10) | R3 |
| RLS gap | One parent sees another's child | pgTAP two-parent test (NFR-11) | R3 |
| Demo from a preview URL | QR blocked by Vercel Authentication | Production alias only (NFR-42) | R4 |
| Supabase project in the wrong region | EU residency claim false | Create in Frankfurt from the start (NFR-03) | R3 |
| Jury asks about validity | Credibility | Evidence slide with CPT ceiling (01 [9]) and validation plan; no performance claim | R5 |
| Team of 4 instead of 5 | Pitch work squeezed | R5 shared per section 1 | All |

## 7. Working rules

- **Branch per feature**: `feat/FR-xx-short-name` (PROPOSAL naming). One FR or a small group per branch.
- **PR to main**: every change goes through a PR with one reviewer; no direct push to `main`. The PR title starts with the FR or NFR IDs.
- **Contracts**: `SessionMetrics`, `ScoreResult` and the table names freeze at M1 (H+6, 03 section 12). The changes proposed by research 04 (PC-01 to PC-03 in 02 section 10.3) are decided by the interface owner (TODO: name) before M1 or not at all. After that they change only by team agreement, recorded in the PR, with R2 and R3 approving, and with 02 section 7 updated in the same PR.
- **Docs follow the code**: a change to a requirement updates 02 in the same PR; a new decision moves from 02 section 10.2 to 10.1 with the date and who decided.
- **No secrets, no personal data** in the repo, the issues or the PR descriptions. Demo data are synthetic.
- **Update cadence of this file**: every owner updates their rows when a PR merges; R5 (or the person holding the tracker, TODO) reviews the whole file at each milestone M1 to M5, and between milestones at a fixed interval (PROPOSAL: every 6 hours; team to confirm).
