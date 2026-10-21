# Specification (cahier des charges)

Product: ADHD Check (working name, see decision D-08). Status: DRAFT for team review. Version 0.1, written 2026-10-19.

This is the build reference for the hackathon. It turns the user needs in `docs/01-user-needs.md` into testable requirements. Where this document and a research file disagree, the research file wins and this document is corrected.

Conventions:

- **PROPOSAL** marks a product decision the team has not confirmed yet.
- **TODO** marks a value nobody has sourced or decided yet. Do not replace a TODO with a guess; replace it with a sourced value or a team decision, and record which.
- Requirement IDs (FR-xx, NFR-xx) are stable. Retire an ID, never reuse it.
- Priority uses the same scale as 01: Must, Should, Could (for the hackathon MVP).
- "Traces to" lists the user needs (UN-xx) in 01. "Enabler" means a technical requirement with no direct user need.

Sources: `research/01-literature-unmet-need.md` (cited "01 [n]"), `research/02-competitors-and-regulatory.md` (cited "02 Part n [ref]"), `research/03-tech-stack.md` (cited "03 section n"), `TODO.md`. `research/04-game-design-symptom-mapping.md` (cited "04 section n") arrived while this was being written; the points it changes are listed in section 13 and decisions D-12 to D-16 and the proposed contract changes in section 10.3. Detailed game mechanics are to be aligned with 04 by R1.

## 1. Context and problem

Details and sources in `docs/01-user-needs.md` and `research/01-literature-unmet-need.md`.

- ADHD is common in children: pooled community prevalence 5.29% (102 studies, age 18 or under, 01 [1], PMID 17541055) and 3.4% (95% CI 2.6-4.5) in a stricter pooled analysis (01 [3], PMID 25649325).
- Access is slow: in England, NHS waiting times are "up to 4+ years for children", and fewer than one-third of strictly diagnosed children have contact with any mental health service (01 [web-A], NHS England ADHD Taskforce Part 1, 2025).
- Parent report alone is weak: parent-teacher agreement kappa 0.25 (01 [24], PMID 42865956).
- Objective computer tasks help but are not diagnostic: pooled CPT sensitivity 0.75 and specificity 0.71, to be used "only within a more comprehensive diagnostic process" (01 [9], PMID 37004919); QbTest "should not be used as stand-alone screening or diagnostic tool, or as a triage system" (01 [10], PMID 37800347).
- No study was found of a game-based screen in an undifferentiated child population against a full clinical reference (01, Gaps, item 8). No cleared or CE-marked ADHD assessment reporting to parents was found (02 Part 3, item 2).

Problem statement: parents who worry about their child's attention wait a long time and have little structured information to bring to a professional. ADHD Check gives them a short game for the child, an orientation on whether a professional assessment is recommended, and a clear route to the right professional, without stating or suggesting a diagnosis (positioning decided 2026-10-19, section 2).

## 2. Intended purpose (DRAFT wording, positioning DECIDED)

**Team decision (2026-10-19, recorded as D-01):** ADHD Check is an **orientation** tool, not a diagnostic tool. It helps parents decide whether to seek a professional assessment and orients them to the right professional. It never states or suggests a diagnosis. Target class: **IIa maximum**, class I only if achievable under the condition below.

### 2.1 Draft intended purpose (wording still DRAFT, owner R5)

> "ADHD Check is software intended to help parents or caregivers of children aged 6 to 12 decide whether to seek a professional assessment of their child's attention and activity, based on measures collected while the child plays a game, and to orient them to an appropriate healthcare professional. It does not diagnose, does not grade severity, and does not replace a professional assessment."

Parent-facing output (DECIDED): either **"A professional assessment is recommended"** or **"No specific follow-up indicated by this activity"** (plus "Not enough data" when the session is unusable). No ADHD probability, likelihood or severity appears on the parent screen. Exact texts per band are in FR-34.

### 2.2 Regulatory reading (stated honestly next to the decision)

What the sources say (02 Part 2.1 to 2.5, quoting MDCG 2019-11 rev.1 [51]):

- Rule 11a: software that provides information used to take decisions with diagnosis or therapeutic purposes is class IIa as the floor. MDCG says this sub-rule "is generally applicable to all MDSW (excluding those MDSW that have no medical purpose)" (02 Part 2.3). Orientation and referral towards an assessment for a condition is information used for a decision with a diagnostic purpose, so **IIa is the expected class** for the decided positioning (team reading of 02 Part 2.4; to confirm with a regulatory advisor).
- Class I (Rule 11c) is defensible **only if the output carries no diagnostic or referral purpose**, for example a pure attention-training or wellbeing game (02 Part 2.4 item 5: the class I precedent found, Poppins, has no diagnostic output). Class I stays an option under that condition; it is not compatible with the referral output above.
- Calling the output "orientation" or "screening" does not remove the medical purpose if it refers to a condition (02 Part 2.7).
- Risk of going above IIa: the closest MDCG example (symptom-based depression scoring with "diagnosis" significance) is class IIb (02 Part 2.4 item 3); and therapy software whose diagnostic function feeds back to determine follow-up therapy is class III per Rule 22, while it is IIa when a specialist decides the follow-up (02 Part 2.4 item 4). The design constraints in 2.3 keep the product away from both.
- Class IIa needs a notified body and clinical evidence for the claimed performance (02 Part 2.4, consequence). The hackathon prototype has no such evidence.
- EU AI Act: an AI-based class IIa+ device would be a high-risk AI system; the application date for Annex I systems is reported as 2 August 2028 after the Digital Omnibus amendment, from a secondary source: **to confirm against the Official Journal text** (02 Part 2.5 [54][55]). Whether the rule-based scorer is an "AI system" under Article 3(1) is a residual question (02 Part 2.5).
- Lay users: parents are lay users, so MDR Annex I 22 and 23.4(w) apply (02 Part 2.3).

### 2.3 Design constraints to stay at IIa maximum (DECIDED)

1. **No auto-prescribed missions.** Missions are never selected automatically from the score. The parent (or, later, a professional) chooses them, and they are general wellbeing activities, not therapy (NFR-52, FR-26, FR-37).
2. **No severity grading.** The output is a referral recommendation or not, never a degree, level or percentage of ADHD (NFR-53, FR-34).
3. **No treatment claims.** Nothing claims to treat ADHD or improve its symptoms (NFR-50, FR-36).
4. **No diagnosis wording.** No user-facing text says or suggests "ADHD likely", "probability" or a diagnosis (FR-34, NFR-50).

### 2.4 Options considered (for the record, from 02 Part 2.8)

| Option | Status after the decision |
|---|---|
| A. Wellness game, no condition named (class I or not MDSW) | Kept as the class I fallback, only with no diagnostic or referral output |
| B. Information for a clinician (IIa, possibly IIb) | Not chosen for the MVP; a clinician summary (FR-35) supports the referral |
| C. Parent-facing likelihood indication (at least IIa, arguably IIb; class III if it drives missions) | Rejected: no likelihood is shown to parents |
| D. Modular split (non-medical game and missions vs medical assessment module) | Open, residual question R-04 in section 10 |

Demo position (PROPOSAL, from 03 section 8): present the build as a prototype, "not a diagnosis, not validated, validation planned", show the intended purpose and the validation plan on a slide. Do not say "not a medical device": with a referral output, 02 Part 2.7 does not support that statement (section 13, contradiction 1).

## 3. Scope

### 3.1 MVP for the hackathon demo

- Child app: one go/no-go style game with practice and calibration, a 60 to 90 s demo round (03 section 9), metric capture, upload, offline retry.
- Scoring: transparent rules in `packages/scoring`, illustrative thresholds with `validated: false` (03 section 4).
- Parent web app: sign up and log in, child profile, session launch by QR or link, result card, next-step guidance, recommendations, missions list and simple progress chart, Stripe test-mode one-off report purchase (D-05b), an email with a link to the paid report behind login (R3-D1).
- Demo: seeded parent with 4 weeks of sessions, reset button (03 section 9).

### 3.2 After the hackathon (not built now)

- Clinician-facing view or export (PROPOSAL).
- Full-length task and more levels, aligned with 04 when available.
- Validation study with a clinical partner and ethics approval (01, Gaps, item 8).
- Regulatory pathway for the expected class IIa (notified body, clinical evidence), per D-01.
- DPIA and DPO review (02 Part 2.6).
- Gadget (open decision D-06 in `TODO.md`).
- Sex-specific and age-specific norms (01 [8], 01 Gaps item 4).

### 3.3 Out of scope

- Any diagnosis, "ADHD likely", probability, likelihood or severity output.
- Training a model on HYPERAKTIV or any adult dataset (03 section 0 and section 13).
- Native apps, push notifications, custom analytics (03 section 13).
- Unity WebGL or Godot web builds (03 section 13).
- Automatic prescription of missions from the score (NFR-52, decided).
- Any claim of treating ADHD.
- Use of the result as a waiting-list triage gate (01 [10]).

## 4. Functional requirements

Each FR has an acceptance criterion (AC) that a teammate can test.

### 4.1 Child app (`packages/game`, mounted at `apps/web/app/play/[token]/`)

| ID | Requirement | Priority | Acceptance criterion | Traces to |
|---|---|---|---|---|
| FR-01 | The child app opens from a short-lived session link or QR code created by the parent; no login on the child's device. | Must | Scanning the QR from FR-32 on the demo tablet opens the game with the right `child_id`; an expired or unknown token shows a neutral "ask your parent" screen and records nothing. Token lifetime: TODO. | UN-12 |
| FR-02 | Onboarding: the child gets instructions through pictures, animation and audio (minimal text), then a practice round that is not scored. | Must | A tester who does not read the text can complete practice; practice trials are not included in `trials` or are typed so the scorer ignores them (implementation choice, document it in `packages/game/README`). | UN-01, UN-02 |
| FR-03 | Calibration block, mini-game 0 "Wake the fireflies" (04 section 5): a simple-tap block at the start (no no-go) gives a per-device reaction-time floor. | Must | `SessionMetrics.calibration` has `n` equal to `task.calibration_trials` and a `median_rt_ms`; calibration trials carry `type: "calibration"`. | UN-02, enabler |
| FR-04 | Mini-game 1 "Lantern Watch": go/no-go (tap fireflies, never tap moths) with the parameters declared in `SessionMetrics.task` (blocks, go probability, stimulus duration, ISI range). Parameter values are design choices (03 section 11.1); 04 section 5 proposes 3 blocks of 48 trials with fixed go/no-go counts shuffled by a seeded PRNG (PROPOSAL). | Must | Every parameter in `task` matches what the engine actually ran (unit test on the engine config); stimulus on screen for 500 ms or more (NFR-22). | UN-03 |
| FR-05 | One story and one character across all mini-games (04 section 5: Luma the firefly keeper), child-friendly art and sound, the same short chime for every correct action, no penalty sound, no visible timer, no failure screen, no ranking (04 section 5 design choices, PROPOSAL). The mini-game set is FR-03, FR-04 and FR-60 to FR-64. | Must | Every implemented mini-game is playable end to end; no screen shows "wrong", "fail", a timer or a ranking (checklist review by R5). | UN-03, UN-04 |
| FR-06 | Response capture: stimulus onset = `requestAnimationFrame` timestamp of the frame that drew it; response = `pointerdown` `event.timeStamp`; no `click` handlers for responses (03 section 2.3). | Must | Code review finds no `click` listener on stimuli; a 10-line timing probe on the demo tablet confirms both clocks share the time origin (03 section 2.3 item 4). | UN-07, enabler |
| FR-07 | Off-target taps during ISI and stimulus are recorded in `off_target_taps`. | Must | Tapping outside the target in a test session produces entries with the correct `during` value. | Enabler |
| FR-08 | Device facts are recorded in `SessionMetrics.device`. | Must | All `device` fields present and non-empty in an uploaded session. | UN-29, enabler |
| FR-09 | Each trial gets one `outcome` among the contract values. The anticipation rule uses the device baseline, never an absolute RT cut-off (03 section 2.3 item 2); its parameter is TODO in `thresholds.v0.json`. | Must | Unit tests on synthetic trials cover all five outcomes. | Enabler |
| FR-10 | The game emits a `SessionMetrics` v1 object that passes the zod schema in `packages/contracts`. | Must | `schema.parse()` succeeds on every session from the demo tablet; a malformed object fails. | Enabler |
| FR-11 | Upload: the session is posted to `POST /api/sessions`. | Must | A finished session appears in `sessions` and `trials` tables within one request; HTTP error codes are shown to no one but logged. | UN-12 |
| FR-12 | Offline tolerance: if upload fails, the session is kept on the device and retried until accepted; the child never has to replay. | Should | With network off at the end of a session, then on, the session reaches the server without user action; a duplicate post with the same `session_id` is stored once. Local storage holds only pseudonymous data (NFR-02). | UN-09 |
| FR-13 | Demo mode: a 60 to 90 s round (03 section 9). Full-task length: TODO, to be aligned with 04. | Must | Demo round duration measured on the demo tablet falls within 60 to 90 s. | UN-03 |
| FR-14 | Full-screen and orientation handling. | Should | On the demo tablet, the game requests full screen and shows a "turn the device" prompt in the wrong orientation. | UN-10 |
| FR-15 | The child never sees the result: the session ends on a celebration screen (PROPOSAL). | Must | No band, flag, indicator or score appears anywhere in the child app (code search plus manual run). | UN-04, UN-05 |
| FR-16 | No ads, in-app purchases, external links, loot boxes, timers pushing purchases or streak pressure in the child app. | Must | Checklist review by R5 before the demo; code search finds no payment or external link in `packages/game`. | UN-06 |

### 4.1b Further mini-games (from 04 section 5, PROPOSAL)

04 section 5 designs a core of mini-games 0 to 5 in about 13.4 minutes of play, with Route Planner optional outside that core. Durations, trial counts and timings are design choices of 04, not sourced values. Their data need the proposed `minigames` field (PC-02 in section 10.3); PC-02 was accepted on 2026-10-20 (section 10.3): one `/play/<code>` session now plays Lantern Watch (with its calibration), Star Path, Bridge Wait, Treasure Choice and Route Planner in a row and uploads once at the end, with the four results in `minigames`. Storm Watch (FR-60) is not built and is not in the chain. A mini-game that fails to start is skipped and recorded as `results: { status: "skipped", reason }` (version "none"): an implementation choice, not in the PC-02 text.

| ID | Requirement | Priority | Acceptance criterion | Traces to |
|---|---|---|---|---|
| FR-60 | Mini-game 2 "Storm Watch": same go/no-go as Lantern Watch, one block without and one block with crossing birds and thunder; part of the go trials cued by an owl hoot instead of a light (04 section 5). Distractor-embedded CPTs showed pooled SMD 1.14 (01 [22], PMID 42613011). | Should | Both blocks run; block order follows the seed; distractor and audio-cue trials are typed in the session data. | UN-03, UN-04 |
| FR-61 | Mini-game 3 "Star Path": Corsi-style sequence repetition (04 section 5). Device-motion capture during encoding is part of the 04 design and may need a permission prompt on iOS Safari (unverified in 04, test on the demo tablet). | Could | Span and errors are recorded; the game still runs with motion permission refused. | UN-03, UN-04 |
| FR-62 | Mini-game 4 "Bridge Wait": wait for a chime before crossing; premature and intrusion taps recorded; optional stop-signal trials (parameters TODO in 04). | Could | Premature and intrusion taps appear in the session data on a test run. | UN-03, UN-04 |
| FR-63 | Mini-game 5 "Treasure Choice": 1 gem now or 2 gems after a wait; total mission time stays constant whichever is chosen (04 section 5); delay values TODO. | Could | Ten choices recorded; total time equal for an all-immediate and an all-wait run. | UN-03, UN-04 |
| FR-64 | Mini-game 6 "Route Planner" (optional, outside the core): plan a path in fewest moves (04 section 5). | Could | Extra moves and planning time recorded. | UN-03 |

### 4.1c Camera and microphone (D-17, from `research/06-camera-microphone-acquisition.md`)

Evidence for these signals is weak and exploratory (06). They are recorded for research and the demo, and they do not feed `ScoreResult` (PROPOSAL from 06, team to confirm).

| ID | Requirement | Priority | Acceptance criterion | Traces to |
|---|---|---|---|---|
| FR-70 | Parent consent screen before play with separate camera and microphone toggles, both off by default, and a child-friendly explanation (text owner P4). | Must | Toggles default to off; no `getUserMedia` call happens before the parent switches one on. | UN-22 |
| FR-71 | Camera features on the device with `@mediapipe/tasks-vision` Face Landmarker (Apache-2.0), blendshapes off, model and WASM self-hosted: face present ratio, face absent episodes, head off-screen ratio, head motion (06). | Should | On the demo tablet, covering the camera raises face absent episodes; no third-party network request appears in the browser network log. | UN-22 |
| FR-72 | Microphone features on the device with `@ricky0123/vad-web` (ISC) and Silero VAD (MIT), plus a level meter: speech ratio, speech onsets during instructions, ambient noise level, loud bursts (06). No audio kept, no transcription, no speaker identification. | Could | Speaking during an instruction increments the onset count; the session payload holds numbers only. | UN-22 |
| FR-73 | Permission denied, unavailable or no response: the game runs unchanged and records the `permission` value. | Must | A full session completes with both permissions refused. | UN-03, UN-22 |
| FR-74 | Optional `camera` and `microphone` blocks in the session payload, strictly validated: aggregates only, never images, landmarks, audio or text (proposed contract change PC-04). | Must (if FR-71 or FR-72 ships) | The validator rejects a payload containing a landmark array or any string field outside the declared enums. | UN-22 |

Open points from 06, not verified: the licence of the `face_landmarker.task` model file, MediaPipe support on iOS Safari, Silero accuracy on children's voices, the AI Act Art. 5(1)(f) reading for a home product, and the need for a DPIA. No emotion is inferred.

### 4.2 Scoring service (`packages/scoring`, called from `apps/web/app/api/sessions/`)

| ID | Requirement | Priority | Acceptance criterion | Traces to |
|---|---|---|---|---|
| FR-20 | The server validates the incoming `SessionMetrics` and rejects sessions below the minimum trial count set in `thresholds.v0.json` (value TODO). | Must | A session below the minimum returns band `insufficient_data` or a 4xx with a reason (choose one and document it); a valid one is scored. | UN-17 |
| FR-21 | Indicators are computed server-side from raw trials: omission rate, commission rate, mean RT of correct Go, RT SD, RT CV, vigilance change (last third vs first third), off-target tap rate (03 section 4). Client-side scores are never trusted. | Must | Unit tests on synthetic sessions reproduce hand-computed indicator values. | Enabler |
| FR-22 | Thresholds live only in `packages/scoring/thresholds.v0.json` with a visible `validated: false` flag, labelled "illustrative, not clinically validated" (03 section 4). Values: TODO. | Must | No numeric threshold appears in scoring code outside the JSON (code search); the JSON has `validated: false`. | Enabler |
| FR-23 | Band assignment: `no_flag`, `follow_up_suggested` or `insufficient_data`, with data-quality rules (anticipation share, trial count). | Must | Fixtures "typical", "variable", "impulsive" and "too short" (03 section 12) each produce the expected band in tests. | UN-03, UN-17 |
| FR-24 | `ScoreResult` carries plain-language `reasons` (one per flag), `scoring_method`, `validated: false` and the disclaimer. | Must | Every flag in a test result has a reason line; disclaimer string matches the contract text. | UN-16, UN-27 |
| FR-25 | Scoring is deterministic and versioned by `scoring_method`. | Must | Same input gives the same output across two runs; changing thresholds requires a new `scoring_method` value. | Enabler |
| FR-26 | `ScoreResult.recommendations` must not contain mission IDs selected from the score (NFR-52, decided in D-02). It may contain the general next-step text. | Must | Test: for each fixture, `recommendations` contains no mission ID. | UN-18 |

### 4.3 Parent web app (`apps/web/app/dashboard/` and `(marketing)/`)

| ID | Requirement | Priority | Acceptance criterion | Traces to |
|---|---|---|---|---|
| FR-30 | Parent sign-up, log-in, log-out with Supabase Auth. | Must | A new email can sign up, log in and log out on the deployed app. | UN-11 |
| FR-31 | Child profile create, edit, delete: nickname and birth year only; no surname, photo or exact birth date (03 section 5). | Must | The form has no other personal fields; the `children` table has no column for them. | UN-08, UN-11 |
| FR-32 | Start a session: the parent picks a child and gets a QR code and link (`qrcode` package, 03 section 1). | Must | The QR scanned on the demo tablet opens FR-01 for that child. | UN-12 |
| FR-33 | Result card: band in plain words, indicator bars, `reasons`, data-quality note, disclaimer always visible, next step. | Must | For each band fixture, the card renders all six elements; the disclaimer is visible without scrolling on a phone screen (manual check). | UN-13, UN-14, UN-16, UN-17 |
| FR-34 | Fixed result wording. Headlines DECIDED (section 2.1): `follow_up_suggested` shows "A professional assessment is recommended"; `no_flag` shows "No specific follow-up indicated by this activity". Supporting lines PROPOSAL (R5 finalises, D-03): under `no_flag`, "This does not rule out attention difficulties. If you are still worried, talk to a healthcare professional."; `insufficient_data` shows "Not enough data from this session. You can play again." No parent screen shows an ADHD probability, likelihood, severity or the words "ADHD likely" or "diagnosis" except in a negation. | Must | Code search finds no "ADHD likely", "probability", "likelihood" or severity terms in user-facing strings; each band shows its headline exactly. | UN-13, UN-14, UN-15, UN-28, UN-31 |
| FR-35 | Next step and clinician summary: a page that says who to see (GP, paediatrician, child psychiatrist) and what to bring, plus a printable summary (dates, device, data quality, indicators, `validated: false`, method, limits: comorbidity, no norms). | Must (next step), Should (summary) | The next-step link is present on every band; the summary prints on one page with all listed fields. | UN-15, UN-21, UN-27, UN-28, UN-29, UN-30 |
| FR-36 | Recommendations: the next step to a professional, plus general wellbeing suggestions, described as practice and engagement, never as treatment of ADHD or symptom improvement (01 [30][34][26]; section 2.3). Content: TODO, reviewed by R5. | Should | Code search finds no "treat", "cure", "improve symptoms" in recommendation strings. | UN-18 |
| FR-37 | Missions: the parent chooses missions from a catalogue of general wellbeing activities (not therapy); the app tracks done and not done. Missions are never selected automatically from the score (NFR-52, decided). Catalogue content: TODO, to be aligned with 04. | Should | A parent can add a mission, mark it done, and see it in history; no code path assigns a mission from a `ScoreResult`. | UN-18, UN-20 |
| FR-38 | Progress: a chart of game measures and mission completion across sessions of the same child, with device shown, and a note that sessions on different devices are not directly comparable (03 section 2.2). Whether later sessions get a new band is open (D-12): 04 section 4.3 proposes scoring only the first full session as the orientation result, because no paediatric practice-effect estimate was found. | Should | With the seeded 4 weeks of data, the chart shows every session in date order. | UN-20 |
| FR-39 | The result appears on the parent screen after upload without manual refresh: Supabase Realtime, or polling every 2 s as fallback (03 section 9; Realtime unverified). | Could | After the child finishes, the parent screen shows the result card with no click. | UN-21, UN-25 |
| FR-40 | Shareable result image (nickname, indicator bars, band, disclaimer) (03 section 9). | Could | The image renders and always contains the disclaimer. | Enabler |
| FR-41 | Delete: the parent can delete a child profile, which deletes its sessions, trials, scores and missions. | Must | After deletion, queries as that parent and as service role return zero rows for that `child_id`. | UN-22 |
| FR-43 | Parent questionnaire (PROPOSAL, D-13): NICHQ Vanderbilt Assessment Scale, Parent, 1st edition (2002), all 18 symptom items and 8 performance items as printed, with the NICHQ credit line, completed by the parent after the session (04 section 3). Hackathon: free download with credit; any paid product: written permission from NICHQ/AAP, TODO (04 section 1.2). How questionnaire and game combine into the two outcomes is open (D-16). | Should | Items and anchors match the printed form exactly (side-by-side check by R5); the credit line is visible; no paid flow shows the questionnaire until permission is recorded. | UN-35 |
| FR-42 | Landing page with QR for the demo (03 section 9). | Should | The landing page loads on the production alias and its QR opens the app. | Enabler |

### 4.4 Report purchase (Stripe test mode, one-off payment per report)

| ID | Requirement | Priority | Acceptance criterion | Traces to |
|---|---|---|---|---|
| FR-45 | Buy one report with Stripe Checkout, `mode: "payment"`, test mode (D-05b, DECIDED, Hatem, 2026-10-20: 9.99 EUR, one-off per report, not a subscription). `POST /api/stripe/checkout` takes `{ sessionId }`, only for the logged-in parent's own scored session, puts `parent_id`, `session_id` and the email language in the Checkout Session metadata, takes the price from `STRIPE_PRICE_ID`, and refuses (409) a report that is already paid, one whose Checkout is complete or awaiting a delayed payment, and a session with too little data (`insufficient_data`: no result to report); an earlier open Checkout of the same report is returned instead of a second one. Return URLs are built from `SITE_URL`. Success returns to the child page (`/parent/<childId>?report=paid`). | Should | A test checkout completes and returns to the child page; another parent's session answers 404; a paid report answers 409 (`apps/web/app/api/stripe/handlers.test.ts`). | UN-23 |
| FR-46 | Retired with D-05b: a one-off payment has nothing to manage or cancel, so the Stripe Customer Portal route is removed. | n/a | n/a | UN-23 |
| FR-47 | Webhook `POST /api/stripe/webhook`: the signature is verified on the raw body (400 otherwise); `checkout.session.completed` (only when `payment_status` is `paid` and the one line item is the configured price; `checkout.session.async_payment_failed` and `checkout.session.expired` mark the purchase failed or expired so a new checkout is allowed) and `checkout.session.async_payment_succeeded` mark the purchase paid once in `report_purchases`, then an email with a link to the report behind login (FR-51) is sent with Resend to the address of the parent who paid (from Supabase auth, never from client input), and `emailed_at` is set. A replayed event sends no second email. A `checkout.session.completed` that is still `unpaid` (delayed payment method) records the pending purchase from the metadata, so a second payment cannot be started while the bank is working (R5-4). Without `RESEND_API_KEY` or a sender (`EMAIL_FROM`) the purchase is still recorded and a code is logged, never the address. | Should | A wrong or missing signature answers 400; a valid event marks paid and sends one email; a replay sends none (`apps/web/app/api/stripe/handlers.test.ts`, `supabase/tests/database/report_purchases.test.sql`). | UN-23 |
| FR-48 | Gating (DECIDED, Hatem, 2026-10-20, D-05): everything is free for parents (games, result card, next step FR-33 to FR-35, missions, progress, data deletion) except downloading the parent report (`GET /api/reports/<sessionId>`, PDF). The report holds only what the result card shows: nickname, session date, the fixed headline and its supporting line, the fixed disclaimer, the game measures as game measures, the next step; no probability, severity or diagnosis wording. The download needs a paid purchase of that report by that parent (`report_purchases`, D-05b), checked on the server; the offer appears only in the report block under the result card. | Must | With no paid purchase, a parent sees the full result card and next step, and the download answers 402; with a paid purchase of that report it answers a PDF; another parent's session answers 404 even when its report is paid (`apps/web/app/api/reports/handlers.test.ts`, `apps/web/lib/report.test.ts`, `apps/web/app/parent/gating.test.ts`, `supabase/tests/database/report_access.test.sql`). | UN-19 |

### 4.5 Email notification

| ID | Requirement | Priority | Acceptance criterion | Traces to |
|---|---|---|---|---|
| FR-50 | Emails through Resend ("weekly summary", "new mission" and, since R3-D1, the paid report email of FR-51), carrying no scores, bands, indicators or other child data, only a link to the app (03 section 7). | Should | A test email arrives; its body contains no band, indicator or flag text. | UN-24 |
| FR-51 | Paid report email (D-05b and R3-D1 / D-05c, DECIDED, Hatem, 2026-10-20: the email carries a link behind login, no attachment, no child data): sent once, only to the parent who paid, in the parent's language when known (RO or EN, from the browser at checkout); fixed text and one link to the child page (`SITE_URL/parent/<childId>?session=<sessionId>`), which asks for a login and returns to the same page after it; no nickname, headline, band, score, disclaimer or PDF in the subject or the body; no diagnosis, probability, severity or treatment wording. The PDF stays downloadable in the app for the parent who paid. Sender: `EMAIL_FROM` (the one sender setting of every email), on a domain verified in Resend (`onboarding@resend.dev` only delivers to the Resend account owner). Wording: placeholder until Person 4 approves. | Should | `apps/web/lib/email/messages.test.ts` (no child data in any email), `apps/web/lib/safe-next.test.ts` (login returns to the linked page); webhook tests above. | UN-19, UN-24 |

### 4.6 Admin and demo seeding

| ID | Requirement | Priority | Acceptance criterion | Traces to |
|---|---|---|---|---|
| FR-55 | `supabase/seed.sql` creates a demo parent with one child and 4 weeks of sessions (03 sections 9 and 10). Seeded data are synthetic. | Must | After seeding, the demo parent's chart is not empty. | Enabler |
| FR-56 | "Reset demo" admin button restores the seeded state. | Should | Pressing it twice in a row leaves the same data. Only the demo admin account can see it. | Enabler |

## 5. Non-functional requirements

### 5.1 Privacy (GDPR, children's data)

| ID | Requirement | Priority | Verification | Traces to |
|---|---|---|---|---|
| NFR-01 | Data minimisation: child data limited to nickname and birth year; no names, photos or exact birth dates (03 sections 5 and 13). | Must | Schema review of `children`. | UN-08, UN-22, UN-33 |
| NFR-02 | The child is identified only by a pseudonymous `child_id` (UUID) in sessions, trials and scores (03 section 11.1). | Must | No nickname in `sessions`, `trials`, `scores` or in `SessionMetrics`. | UN-08, UN-22, UN-33 |
| NFR-03 | Supabase project created in Frankfurt, not the general "Europe" region; region cannot be changed later (03 section 1). Vercel function region and Resend data location: TODO. | Must | Supabase dashboard shows Frankfurt. | UN-22, UN-33 |
| NFR-04 | Lawful basis and consent: gameplay turned into an indication is, on its face, child health data (GDPR Art. 9); the design relies on explicit parental consent (Art. 9(2)(a)) and verifiable parental consent for Art. 8 (02 Part 2.6, to confirm with a DPO). France threshold 15 (02 Part 2.6, secondary source). Consent text: TODO. | Must | A consent step exists before the first session; text reviewed by R5. | UN-22, UN-33 |
| NFR-05 | Emails and notifications contain no result data (03 section 7). | Must | Email template review. | UN-22, UN-24, UN-33 |
| NFR-06 | Retention period: TODO (decision D-09). Deletion per FR-41. | Should | Documented in the privacy notice. | UN-22, UN-33 |
| NFR-07 | No third-party trackers or analytics scripts in the child app (PROPOSAL; 03 section 13 already excludes custom analytics). | Must | Network log during a child session shows only our own origin and Supabase. | UN-22, UN-33 |

### 5.2 Security

| ID | Requirement | Priority | Verification | Traces to |
|---|---|---|---|---|
| NFR-10 | No secrets in the public repo: `.env.example` with names only; `NEXT_PUBLIC_` variables limited to the Supabase URL and publishable key; Stripe and Resend keys only in Vercel env vars and gitignored `.env.local` (03 sections 6, 9, 13). | Must | Secret scan before each merge to main; GitHub push protection status: TODO (03 section 9, unverified). | UN-33 |
| NFR-11 | RLS enabled on every table, one policy per operation using `(select auth.uid())`, `to authenticated`; policy columns indexed; never `user_metadata` for authorisation (03 section 5). | Must | pgTAP test: parent B reads zero rows of parent A (03 section 5). | UN-33 |
| NFR-12 | `service_role` key used server-side only (03 section 13). | Must | Code search finds it only in server code. | UN-33 |
| NFR-13 | Rate limit on `POST /api/sessions` (03 section 12). Limit value: TODO. | Should | Burst test receives a 429 above the limit. | UN-33 |
| NFR-14 | Stripe webhook signature verified on the raw body (03 section 6; https://docs.stripe.com/webhooks). | Must | See FR-47. | UN-33 |

### 5.3 Timing measurement (from 03 section 2)

| ID | Requirement | Priority | Verification | Traces to |
|---|---|---|---|---|
| NFR-20 | Onset from `requestAnimationFrame`, response from `pointerdown` `event.timeStamp` (03 section 2.3 item 4). | Must | Code review plus timing probe. | UN-07 |
| NFR-21 | No `click` events for responses (03 section 13). | Must | Code search. | UN-07 |
| NFR-22 | Go/No-Go stimulus on screen 500 ms or more; no stimulus under 100 ms (03 section 2.3 item 5, section 13). | Must | Engine config test. | Enabler |
| NFR-23 | Scoring uses within-child indices (SD, CV, early vs late change, rates); no absolute RT cut-off without a per-device baseline (03 section 2.3 items 1 and 2). Reason: browsers add a constant lag of roughly 58 to 133 ms depending on device and browser (03 section 2.2). | Must | Code review of `packages/scoring`. | Enabler |
| NFR-24 | Absolute RTs are never compared across devices (03 section 13). | Must | FR-38 chart shows the device per session. | UN-29 |
| NFR-25 | Demo on one named tablet, one browser, full screen, same refresh rate (03 section 2.3 item 3). Device name: TODO. | Must | Named in the demo script. | Enabler |

### 5.4 Accessibility

| ID | Requirement | Priority | Verification | Traces to |
|---|---|---|---|---|
| NFR-30 | Parent web app targets WCAG 2.2 level AA (PROPOSAL). | Should | Automated check (tool TODO) plus keyboard-only run. | UN-11 |
| NFR-31 | Child app instructions do not rely on reading; colour is never the only cue; touch targets large enough for children (size TODO, to be aligned with 04). | Must | Manual review with the checklist. | UN-01 |

### 5.5 Performance

| ID | Requirement | Priority | Verification | Traces to |
|---|---|---|---|---|
| NFR-35 | Game load time on the demo tablet: target TODO. Frame rate stable at the device refresh rate during stimuli (measured value TODO). | Should | Measured on the demo tablet and recorded in this file. | UN-03 |
| NFR-36 | Result visible on the parent screen without manual refresh (Realtime or 2 s polling, 03 section 9). | Could | See FR-39. | UN-25 |

### 5.6 Browser and device support

| ID | Requirement | Priority | Verification | Traces to |
|---|---|---|---|---|
| NFR-40 | Child app: the named demo tablet with Chrome on Android or Safari on iOS (03 section 2.3; the Schatz abstract is unverified). Other devices: best effort. | Must | Full run on the demo tablet. | UN-10 |
| NFR-41 | Parent app: current Chrome, Safari and Firefox on phone and laptop (PROPOSAL; versions TODO). | Should | Smoke test on each. | UN-11 |
| NFR-42 | Demo from the Vercel production alias, not a preview URL (preview is behind Vercel Authentication by default) (03 sections 1 and 13). | Must | QR points to the production alias. | Enabler |

### 5.7 Language

| ID | Requirement | Priority | Verification | Traces to |
|---|---|---|---|---|
| NFR-45 | UI language(s): TODO (decision D-07). All safety texts (FR-34, disclaimer, consent) exist in every shipped language. Docs and code are in English. | Must | Every user-facing string comes from one strings file per language. | UN-26 |

### 5.8 Regulatory and ethics constraints on the build

| ID | Requirement | Priority | Verification | Traces to |
|---|---|---|---|---|
| NFR-50 | Claims control: no user-facing text, slide or marketing claims a diagnosis, clinical validation, treatment or symptom improvement (03 section 13; 01 [9][10][30][34]; 02 Part 2.1, MDCG p. 7: claims need clinical evidence). | Must | R5 reviews all user-facing strings and the deck. | UN-13, UN-18, UN-28, UN-31, UN-32, UN-34 |
| NFR-51 | The intended-purpose statement used in the pitch is the orientation wording in section 2.1, marked DRAFT until R5 finalises it. | Must | Slide review. | UN-32 |
| NFR-52 | **Design constraint (Rule 22, DECIDED).** Missions are chosen by the parent (or, later, by a professional) as general wellbeing activities, never selected automatically from the score. Reason: MDCG places diagnostic output that feeds back to determine follow-up therapy in class III per Rule 22, and class IIa when a specialist decides (02 Part 2.4 item 4 [51]). | Must | FR-26 and FR-37 tests. | UN-18, UN-32 |
| NFR-53 | **No severity grading (DECIDED).** No output, chart, email or summary expresses a degree, level, percentage or probability of ADHD; indicators are shown as game measures, not as symptom severity. Reason: keep the product at IIa maximum (section 2.3; the IIb depression-scoring example in 02 Part 2.4 item 3). | Must | R5 string and screen review; code search for "severity", "mild", "moderate", "severe", "%" next to ADHD. | UN-13, UN-32 |
| NFR-60 | No dark patterns: no manipulative monetisation aimed at children, no confirm-shaming, cancel as easy as subscribe, price shown before payment. | Must | Checklist review by R5. | UN-04, UN-06, UN-23 |
| NFR-61 | No copying of GPL (PEBL) or non-commercial (PsyToolkit) code; no training on HYPERAKTIV (03 sections 3 and 13). | Must | Dependency and licence review. | Enabler |

## 6. Architecture overview

### 6.1 Stack (copied from 03 section 1)

| Layer | Pick | Alternative | Why | Source |
|---|---|---|---|---|
| Game engine | Phaser 4.x (MIT), written in TypeScript, mounted in a Next.js client component | PixiJS (MIT) or plain canvas; KAPLAY (MIT) for the fastest toy-style prototyping | Phaser runs one codebase on desktop and mobile browsers, MIT; GitHub lists v4.2.1. A go/no-go task is simple, so plain canvas is also acceptable; the engine buys sprites, tweens, audio and scaling for polish. Phaser 4 maturity vs 3.x for production: unverified, fall back to 3.x if a blocker appears | https://github.com/phaserjs/phaser , https://github.com/kaplayjs/kaplay , https://github.com/pixijs/pixijs |
| Why not Godot web | Not chosen | Godot 4 web export | Compatibility renderer only, Safari has WebGL 2 issues, large .wasm/.pck, web is slower than native; single-thread is default since 4.3 so no header setup needed, but the payload and Safari risk remain on a tablet demo | https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html |
| Why not Unity WebGL | Not chosen | Unity WebGL | Unity's own manual (2020.3 and older pages) says WebGL content is not currently supported on mobile devices and shows a warning; the Unity 6 wording could not be fetched (unverified) | https://docs.unity3d.com/2020.3/Documentation/Manual/webgl-browsercompatibility.html |
| Web app + dashboard | Next.js (App Router, TypeScript, Tailwind) on Node 20.9 or newer; docs reference Next.js 16 | Vite + React SPA | `create-next-app` gives routes, server actions and route handlers in one repo; Vercel deploys it natively | https://nextjs.org/docs/app/getting-started/installation |
| Backend, auth, DB | Supabase (Postgres + Auth + RLS), EU region | Firebase (Firestore, EU location) | Postgres RLS maps cleanly to "parent sees only own children". Free plan: 2 active projects, 500 MB, 50,000 MAU, pauses after 1 week of inactivity. Supabase MCP is available to us. Firebase has EU locations (eur3, europe-west1/4) but location is immutable; Firebase pricing and rules model not fetched (unverified) | https://supabase.com/pricing , https://supabase.com/docs/guides/database/postgres/row-level-security , https://firebase.google.com/docs/firestore/locations |
| EU hosting | Create the project in a specific EU region (Frankfurt), not the general "Europe" region | none | General Europe region can land in London or Zurich, which are not EU; region cannot be changed after creation; docs state region selection is "not proof of regulatory compliance" | https://supabase.com/docs/guides/platform/regions |
| Scoring runtime | Pure TypeScript package `packages/scoring`, called from a Next.js route handler (server recomputes from raw trials) | Python FastAPI service; Supabase Edge Function | One language, unit-testable, no extra deploy. Supabase Edge Functions are TypeScript on Deno and the page does not mention Python, so a Python scorer would need its own host | https://supabase.com/docs/guides/functions |
| Payments | Stripe test mode: Checkout, `mode: "payment"`, one-off per report (D-05b) | Payment Links | Listen to `checkout.session.completed` and `checkout.session.async_payment_succeeded`, fulfil only when `payment_status` is not `unpaid`, and make fulfilment safe to run several times for one Checkout Session | https://docs.stripe.com/checkout/fulfillment , https://docs.stripe.com/webhooks |
| Email to parents | Resend (free: 3,000 emails/month, 100/day, 3 domains) for weekly summaries and mission reminders; Supabase Auth emails for login only | Push notifications | Email needs no device permission and works in a demo. Resend Pro is 20 USD/month for 50,000 emails. Supabase built-in SMTP sending limits: unverified. Web push on iOS: unverified, skip | https://resend.com/pricing |
| Hosting | Vercel | Netlify (not researched, unverified) | Vercel MCP available. WARNING: Hobby plan is restricted to non-commercial, personal use; Pro developer seat is 20 USD/user/month. Hobby preview deployments are behind Vercel Authentication by default, which would block a phone scanning a QR code, so demo from the production alias | https://vercel.com/docs/plans/hobby |
| QR code | `qrcode` npm package (MIT), `toCanvas` in browser | any | Renders to canvas in the browser | https://github.com/soldair/node-qrcode |

### 6.2 Folder structure (copied from 03 section 10)

```
adhdcheck/
  README.md
  .env.example                 # names only, no values
  .gitignore                   # .env*, .vercel, node_modules, supabase/.temp
  package.json                 # pnpm workspaces
  research/                    # these notes
  apps/
    web/                       # Next.js (landing, play, parent dashboard, API routes)
      app/(marketing)/         # landing + QR
      app/play/[token]/        # mounts the Phaser game
      app/dashboard/           # parent: children, results, missions, billing
      app/api/sessions/        # POST session metrics -> validate -> score -> save
      app/api/stripe/          # checkout, webhook
  packages/
    game/                      # Phaser scenes, go/no-go engine, session recorder
    scoring/                   # pure TS: indicators, thresholds.v0.json, tests
    contracts/                 # TypeScript types + zod schemas: SessionMetrics, ScoreResult
  supabase/
    migrations/                # tables + RLS
    seed.sql                   # demo parent and 4 weeks of data
    tests/                     # pgTAP RLS tests
  docs/
    pitch/  clinical/  regulatory/
```

### 6.3 Data flow

```
 Parent phone/laptop                     Child tablet/phone
 +---------------------+   QR / link    +---------------------------+
 | apps/web dashboard  |--------------->| apps/web/play/[token]     |
 | (Next.js)           |                | packages/game (Phaser)    |
 +----------+----------+                +-------------+-------------+
            ^                                         |
            | result card (Realtime or polling)       | POST /api/sessions
            |                                         v  SessionMetrics v1
 +----------+-----------------------------------------------------------+
 | apps/web route handlers (Vercel)                                     |
 |   validate (packages/contracts) -> score (packages/scoring)          |
 |   -> ScoreResult v1 -> save                                          |
 |   /api/stripe/* (Checkout, webhook)            Resend emails         |
 +----------+-----------------------------------------------------------+
            |
            v
 +----------------------------------------------+     +----------------+
 | Supabase, Frankfurt: Postgres + Auth + RLS    |     | Stripe (test)  |
 | parents, children, sessions, trials, scores,  |     +----------------+
 | missions, report_purchases                    |
 +----------------------------------------------+
```

## 7. Interfaces

Copied from 03 section 11. These contracts freeze at M1 (H+6, 03 section 12) and change only by team agreement (see `docs/03-progress-plan.md`).

### 7.1 `SessionMetrics` v1 (game to backend)

```json
{
  "schema_version": "1.0",
  "session_id": "uuid",
  "child_id": "uuid (pseudonymous, no name)",
  "started_at": "2026-10-19T10:00:00Z",
  "duration_ms": 0,
  "task": {
    "type": "go_nogo",
    "version": "0.1.0",
    "blocks": 3,
    "go_probability": 0.8,
    "stimulus_ms": 500,
    "isi_ms_min": 900,
    "isi_ms_max": 1500,
    "calibration_trials": 10
  },
  "device": {
    "user_agent": "string",
    "pointer_type": "touch | mouse | pen",
    "screen_w": 0,
    "screen_h": 0,
    "device_pixel_ratio": 1,
    "est_refresh_hz": 60,
    "cross_origin_isolated": false,
    "timer_clock": "event.timeStamp"
  },
  "trials": [
    {
      "i": 0,
      "block": 0,
      "type": "go | nogo | calibration",
      "stimulus_onset_ms": 0,
      "responded": true,
      "rt_ms": 0,
      "outcome": "hit | omission | correct_reject | commission | anticipation",
      "x": 0,
      "y": 0
    }
  ],
  "off_target_taps": [{ "t_ms": 0, "during": "isi | stimulus" }],
  "calibration": { "median_rt_ms": 0, "n": 0 },
  "minigames": [{ "id": "star-path | bridge-wait | treasure-choice | route-planner", "version": "0.1.0", "params": {}, "trials": [], "results": {} }]
}
```

`minigames` is optional (PC-02, accepted 2026-10-20): the results of the mini-games played after Lantern Watch, at most one entry per game, each with `trials` or `results` or both. Lantern Watch and its calibration stay in `trials`, `calibration` and `task`.

### 7.2 `ScoreResult` v1 (scoring to dashboard)

```json
{
  "schema_version": "1.0",
  "session_id": "uuid",
  "scoring_method": "rules_v0",
  "validated": false,
  "indicators": {
    "omission_rate": 0.0,
    "commission_rate": 0.0,
    "rt_mean_ms": 0,
    "rt_sd_ms": 0,
    "rt_cv": 0.0,
    "vigilance_change": 0.0,
    "off_target_tap_rate": 0.0
  },
  "flags": ["high_rt_variability", "high_commission_rate"],
  "band": "no_flag | follow_up_suggested | insufficient_data",
  "data_quality": { "n_trials": 0, "pct_anticipations": 0.0, "notes": [] },
  "reasons": ["plain-language line per flag"],
  "recommendations": ["mission ids or text"],
  "disclaimer": "Attention profile from a game. Not a diagnosis. Talk to a healthcare professional."
}
```

Usage constraint on `recommendations` (NFR-52, FR-26): it holds the fixed next-step sentence only, never mission IDs chosen from the score. The contracts above are copied from 03; the changes proposed by 04 are listed in section 10.3. Applied: the optional `minigames` field of `SessionMetrics` (PC-02, accepted 2026-10-20). Not applied: the rename to `next_step_text` (PC-01).

### 7.3 HTTP endpoints

| Endpoint | Method | Purpose | Source |
|---|---|---|---|
| `/api/sessions` | POST | Receive `SessionMetrics`, validate, score, save, return `ScoreResult` | 03 sections 10 and 12 |
| `/api/stripe/checkout` | POST | Create a Checkout Session, `mode: "payment"`, for one report (D-05b, FR-45) | 03 section 6 |
| `/api/stripe/webhook` | POST | Receive Stripe events (`checkout.session.completed`, `checkout.session.async_payment_succeeded`), verify signature, mark paid, email the link to the report (FR-47) | 03 section 6 |
| `/api/reports/<sessionId>` | GET | The report PDF for the parent who paid for it (FR-48) | D-05, D-05b |

## 8. Data model

Table names from 03 section 5. Column lists are PROPOSAL, derived from the contracts; R3 owns the final migration in `supabase/migrations/`. RLS on every table (NFR-11).

| Table | Purpose | Key columns (PROPOSAL) | Access |
|---|---|---|---|
| `parents` | Parent account (via `auth.users`) | `id` (= `auth.uid()`), `created_at`, `stripe_customer_id` | Own row only |
| `children` | Child profile | `id` (uuid, the pseudonymous `child_id`), `parent_id`, `nickname`, `birth_year`, `created_at` | `parent_id = (select auth.uid())` |
| `sessions` | One played session | `id` (`session_id`), `child_id`, `parent_id` (copied, 03 section 5), `started_at`, `duration_ms`, `task` (jsonb), `device` (jsonb), `calibration` (jsonb), `schema_version` | Via `parent_id` |
| `trials` | Raw trials of a session | `session_id`, `parent_id`, `i`, `block`, `type`, `stimulus_onset_ms`, `responded`, `rt_ms`, `outcome`, `x`, `y`; off-target taps in `sessions` jsonb or a separate table (R3 decides) | Via `parent_id` |
| `scores` | `ScoreResult` per session | `session_id`, `parent_id`, `scoring_method`, `validated`, `indicators` (jsonb), `flags`, `band`, `data_quality` (jsonb), `reasons`, `recommendations`, `disclaimer`, `created_at` | Via `parent_id` |
| `missions` | Missions chosen by the parent | `id`, `child_id`, `parent_id`, `mission_key` (catalogue item), `chosen_by` (`parent`; `professional` later), `status` (`todo`, `done`), `created_at`, `done_at` | Via `parent_id` |
| `report_purchases` | One-off report purchases (D-05b), one row per Stripe Checkout Session | `parent_id`, `session_id`, `stripe_checkout_session_id` (unique), `status` (`pending`, `paid`), `lang`, `paid_at`, `emailed_at` | Own rows; written by checkout and webhook with service role (migration `20261021130000_report_purchases.sql`). The former `subscriptions` table is dropped (`20261021140000_drop_subscriptions.sql`) |

## 9. Regulatory and ethical constraints

- Intended purpose: orientation and referral support, target IIa maximum, IIa expected; class I only without any diagnostic or referral output (section 2, D-01 decided). Class I is not defensible for a diagnosis-supporting or referral output (02 Part 2.4).
- Rule 22: no automatic mission selection from the score (NFR-52, D-02 decided).
- No severity grading and no treatment claims (NFR-53, NFR-50).
- Claims must be supported by clinical evidence (02 Part 2.1, MDCG p. 7); the prototype has none, so no performance claim (NFR-50).
- Lay users: if Option C, MDR Annex I 22 and 23.4(w) apply (02 Part 2.3).
- AI Act: high-risk regime for an AI-based class IIa+ device, date reported as 2 August 2028 for Annex I systems, **to confirm** (02 Part 2.5, secondary source). Whether the rule-based scorer is an "AI system": team question.
- GDPR: child health data, explicit and verifiable parental consent, DPIA expected (to confirm with a DPO) (02 Part 2.6).
- Evidence limits to state in the pitch: CPT-type accuracy ceiling (01 [9][10]), real-world NPV as low as 24% (01 [12]), comorbidity overlap (01 [5][17]), no child dataset and no norms (01 section E, 03 section 4).
- Ethics: a validation study needs ethics approval and a clinical partner (01 Gaps item 8).
- Child-appropriate design: no dark patterns, no manipulative monetisation aimed at children (NFR-60, FR-16).

## 10. Open decisions

### 10.1 Decided

| ID | Decision | Status | Decided by, date | Residual questions |
|---|---|---|---|---|
| D-01 | Positioning and class: orientation and referral support, never diagnosis; target IIa maximum, IIa expected, class I only if the output carries no diagnostic or referral purpose | **DECIDED** | Hatem, 2026-10-19 | R-01 to R-05 below |
| D-02 | Missions are chosen by the parent (later a professional) as general wellbeing activities, never auto-prescribed from the score | **DECIDED** | Hatem, 2026-10-19 | R-03 |
| D-03a | Result headlines: "A professional assessment is recommended" / "No specific follow-up indicated by this activity"; no ADHD probability, likelihood or severity on the parent screen | **DECIDED** | Hatem, 2026-10-19 | D-03 (supporting lines) |
| D-05 | What is behind the paywall: everything is free for parents (games, result card, next step, missions, progress, deletion) except the detailed report. Decision A: the headline and the next step are always free on screen (FR-48). The payment model is set by D-05b (it replaced the subscription first planned here) | **DECIDED** | Hatem, 2026-10-20 | None |
| D-05b | The detailed PDF report costs 9.99 EUR, one-off payment per report, not a subscription (Stripe Checkout `mode: "payment"`, FR-45). After payment the parent who paid gets an email with a link to the report behind login; the PDF is not attached and the email holds no child data (R3-D1 / D-05c, below). The download from the parent page stays available to the payer (FR-47, FR-48, FR-51) | **DECIDED** | Hatem, 2026-10-20 | Product name (D-08); email wording approval (Person 4) |
| D-05c (R3-D1) | The paid report email carries a link to the report inside the app, behind login, and nothing else: no attachment, no nickname, headline, band, score or disclaimer. R3-D1 / D-05c DECIDED, Hatem, 2026-10-20: report email carries a link behind login, no attachment, no child data. Option A; the options of attaching the PDF with a recorded processor, region and consent (NFR-04) were not taken | **DECIDED** | Hatem, 2026-10-20 | Email wording approval (Person 4) |
| D-18 | Hackathon scope is one web app only: the game runs inside it at `/play` in the tablet or phone browser; native mobile and tablet apps after the hackathon | **DECIDED** | Hatem, 2026-10-19 | None |
| D-17 | Web first, with camera and microphone in the browser game (section 4.1c), processed on the device, aggregates only; native mobile app later | **DECIDED** | Hatem, 2026-10-19 | Whether camera and microphone features ever feed the score (06 proposes no); legal review of the open points in 4.1c |

Residual questions from D-01 and D-02:

| ID | Question | Owner |
|---|---|---|
| R-01 | Confirm the IIa reading for an orientation and referral output with a regulatory advisor, and whether ADHD counts as "serious" (IIb risk, 02 Part 2.4 item 3) | TODO (R5) |
| R-02 | Final intended-purpose wording (section 2.1 is DRAFT) | TODO (R5) |
| R-03 | Mission catalogue content that stays "general wellbeing, not therapy", reviewed against Rule 22 | TODO (R5 with R1) |
| R-04 | Whether a modular split (Option D, 02 Part 2.8) is worth pursuing | TODO (R5) |
| R-05 | Whether the rule-based scorer is an "AI system" under the AI Act Article 3(1), and confirm the 2 August 2028 date against the Official Journal (02 Part 2.5, secondary source) | TODO (R5) |

### 10.2 Open

| ID | Decision | Options or input | Owner | Needed by |
|---|---|---|---|---|
| D-03 | Supporting lines under each headline (FR-34) and disclaimer wording | `TODO.md`; 03 section 11.2 | TODO (R5) | M2, TODO |
| D-04 | Threshold values in `thresholds.v0.json`, minimum trial count, anticipation rule | 03 section 4 (no verified norms) | TODO (R2) | M2, TODO |
| D-06 | Gadget: which one, and is it a medical device | `TODO.md` | TODO | After the hackathon |
| D-07 | UI language(s) | none sourced | TODO | M1, TODO |
| D-08 | Product name: "ADHD Check" names the condition; with the orientation positioning it also reads as a diagnostic promise, and it rules out the class I fallback (02 Part 2.7, 2.8) | depends on R-01 | TODO | Before the pitch, TODO |
| D-09 | Data retention period | none sourced | TODO (R3 with R5) | After the hackathon |
| D-10 | Mini-game list and follow-up mission catalogue | 04 section 5 (five mini-games, PROPOSAL) | TODO (R1 with R5) | M2, TODO |
| D-11 | Demo tablet model and browser | 03 section 2.3 | TODO (R1) | M1, TODO |
| D-12 | Do repeat sessions produce a new band, or only the first full session (04 section 4.3)? | 04 section 4.3 | TODO (R2 with R5) | M2, TODO |
| D-13 | Add the parent questionnaire (NICHQ Vanderbilt, 1st ed.) proposed in 04 section 3; commercial use needs written permission (04 section 1.2) | 04 sections 1.2 and 3 | TODO (R5) | M1, TODO |
| D-14 | Use an LLM for mission story lines and a parent report wrapper (04 section 6); AI Act and claims review needed | 04 section 6 | TODO (R5 with R2) | M2, TODO |
| D-16 | How the parent questionnaire and the game combine into the two outcomes (questionnaire alone; either flags; both flag) | 04 section 3; validation data needed | TODO (R5 as clinical lead, with R2) | M2, TODO |

D-15 is retired: it is replaced by PC-01 to PC-03 below.

### 10.3 PROPOSED CONTRACT CHANGES (not applied)

Proposed by `research/04-game-design-symptom-mapping.md`. The contracts in section 7 stay exactly as in 03 until the interface owner and the team agree (03 section 12: interfaces freeze at hour 6, changes go through one owner).

| ID | Proposed change | Reason given in 04 | Impact | Owner | Status |
|---|---|---|---|---|---|
| PC-01 | Rename `ScoreResult.recommendations` to `next_step_text`, filled only with the fixed orientation sentence; no mission IDs from the score | Missions are chosen by the parent or a professional, never auto-prescribed (04 section 0; Rule 22, 02 Part 2.4 item 4) | `ScoreResult` to a new version; scorer, API and dashboard updates; FR-26 then tests the new field | Interface owner (TODO: name), with R2 and R3 | PROPOSED |
| PC-02 | Add an optional `minigames` array to `SessionMetrics` (one entry per mini-game with `id`, `version`, `params` and `trials` or `results`). The same 04 block also proposes optional `motion` (device-motion RMS per mini-game) and `context` (`on_adhd_medication`, `age_band`) objects | Mini-games 0 and 2 to 5 need somewhere to put their data (04 section 5) | Additive; zod schema update. `context.on_adhd_medication` is health data about the child and needs R5 privacy review (NFR-01, NFR-04) before acceptance | Interface owner (TODO: name), with R1, R2 and R3 | ACCEPTED by Hatem, 2026-10-20, for the `minigames` array; applied in `packages/contracts/src/session-metrics.ts` (`MiniGameEntrySchema`), `sessions.minigames` (migration `20261022110000_minigames_and_link_grace.sql`, not applied by the PR). `motion` and `context` are NOT accepted yet: `context` needs the R5 privacy review above, and no device motion is captured |
| PC-03 | Additive indicators in `ScoreResult.indicators` (d', anticipation rate, ex-Gaussian parameters) and `vigilance_change` split into named parts | 04 section 7.2 | Additive; scorer and dashboard | Interface owner (TODO: name), with R2 | PROPOSED |
| PC-04 | Optional `camera` and `microphone` blocks in `SessionMetrics` (fields and units in 06), v1 unchanged | D-17; 06 | Additive; strict schema; R5 privacy review | Interface owner (TODO: name), with R2 and R3 | PROPOSED |

## 11. Glossary

| Term | Meaning |
|---|---|
| ADHD | Attention-deficit/hyperactivity disorder |
| Band | The scoring output category: `no_flag`, `follow_up_suggested`, `insufficient_data` (03 section 11.2) |
| Calibration block | Simple-tap trials at the start that give a per-device reaction-time floor (03 section 2.3) |
| Commission | A tap on a No-Go stimulus |
| CPT | Continuous performance test |
| CV | Coefficient of variation (RT SD divided by mean RT) |
| DPIA | Data protection impact assessment (GDPR) |
| Go/No-Go | Task where the player taps for Go stimuli and holds back for No-Go stimuli |
| ISI | Inter-stimulus interval |
| MDCG 2019-11 | EU guidance on qualification and classification of medical device software (rev.1, June 2025) |
| MDR | EU Medical Device Regulation 2017/745 |
| MDSW | Medical device software |
| Mission | A follow-up activity the parent chooses and tracks over time |
| Omission | No tap on a Go stimulus |
| PWA | Progressive web app |
| RLS | Row level security (Postgres, Supabase) |
| RT | Reaction time, in ms |
| Rule 11, Rule 22 | MDR Annex VIII classification rules for software and for active therapeutic devices with a diagnostic function |
| Vigilance change | Change in performance between the first and last third of the task |

## 12. Change log

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-10-19 | First draft from research 01, 02, 03 and `TODO.md`, including the team decision of 2026-10-19 on positioning (orientation, IIa maximum). |
| 0.3 | 2026-10-20 | R3-D1 / D-05c decided (Hatem): the report email carries a link behind login, no attachment, no child data. FR-47, FR-50, FR-51 and D-05b adjusted. |
| 0.2 | 2026-10-20 | D-05b decided (Hatem): 9.99 EUR one-off per report, emailed to the parent who paid. FR-45, FR-47, FR-48 rewritten, FR-46 retired, FR-51 added, `subscriptions` replaced by `report_purchases`. |

## 13. Contradictions found between sources (for the team to resolve)
1. 03 section 8 suggests stating "not a medical device" in the demo; 02 Part 2.7 shows that statement holds only for a wellness game that names no disease. While the output or the product name refers to ADHD, do not say "not a medical device".
2. Wording: 03 uses the band value `follow_up_suggested` and the phrase "follow-up with a professional suggested"; `TODO.md` uses "follow-up recommended"; the team decision of 2026-10-19 sets "A professional assessment is recommended". The contract value stays as it is (frozen); only the display text follows the decision (FR-34). Also, the contract's `disclaimer` example ("Attention profile from a game...") and 03's "attention profile" wording should be reviewed by R5 against the orientation positioning (D-03).
3. `ScoreResult.recommendations` in 03 section 11.2 allows "mission ids", which would let the score select missions; 02 Part 2.4 item 4 flags that loop as class III per Rule 22. Resolved by NFR-52 and FR-26 (D-02 decided).
4. 03 section 8 gives Rule 11 class IIa from a secondary summary marked unverified; 02 Part 2.2 now quotes Rule 11 verbatim from MDCG 2019-11 rev.1. 02 supersedes 03 on this point.
5. `TODO.md` still lists the intended purpose and output wording as open team decisions; they are now decided (D-01, D-02, D-03a). `TODO.md` is outside this documentation change and should be updated by its owner.
6. The word "mission" means two things: in 04 section 5 a mission is one in-game mini-game (Lantern Watch, Storm Watch); in this spec, `TODO.md` and the brief it is a follow-up activity the parent tracks over time. Proposal: call the in-game parts "mini-games" and keep "missions" for follow-up activities (team to confirm, D-10).
7. AI Act date: 02 Part 2.5 reports 2 August 2028 for Annex I systems (secondary source); 04 section 6 says secondary sources conflict. Both say the Official Journal text controls: to confirm (R-05).
8. Session length: 03 section 9 plans a 60 to 90 s demo round; 04 section 5 designs about 14 minutes for the full task. Not a conflict (demo mode vs full task), but FR-13 is the demo round only.
