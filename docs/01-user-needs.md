# 01 - User needs (ADHD Check)

Status: DRAFT for team review. Version 0.1, written 2026-10-19.

This document lists what each user group needs from ADHD Check, before any design decision. It follows the medical-device way of working: user needs first, then design inputs (the functional and non-functional requirements in `docs/02-specification-cahier-des-charges.md`), in the spirit of IEC 62366-1 usability engineering. Every requirement in 02 should trace back to a need here, and every Must need here should trace forward to at least one requirement.

Sources of truth:

- `research/01-literature-unmet-need.md` (cited as "01 [n]", where [n] is the reference number in that file, with its PMID).
- `research/03-tech-stack.md` (cited as "03 section n").
- `TODO.md` (open team decisions).
- `research/02-competitors-and-regulatory.md` (cited as "02 Part n.n [ref]", where [ref] is the reference number in that file).
- `research/04-game-design-symptom-mapping.md` (cited as "04 section n"). It arrived while this was being written; the child needs below were checked against its sections 4.3 and 5, and its detailed mechanics remain to be aligned by R1 and R5.

Team decision applied (Hatem, 2026-10-19): ADHD Check is an orientation tool that helps parents decide whether to seek a professional assessment and orients them to the right professional. It never states or suggests a diagnosis, shows no ADHD probability or severity, and never auto-prescribes missions. Target class IIa maximum. Details in 02 section 2.

How to read a need:

- **ID**: UN-xx, stable. Never reuse a retired ID.
- **Priority** for the hackathon MVP: **Must** (the demo is not acceptable without it), **Should** (planned, cut only under time pressure), **Could** (only if time remains).
- **Rationale**: the evidence with its source and PMID, or "team assumption, to validate" when no source supports it.
- **Traces to**: the FR and NFR IDs in 02.
- A line marked **PROPOSAL** is a product decision for the team to confirm, not an agreed fact.

## 1. User groups

| Group | Who | Interacts with | Account |
|---|---|---|---|
| Child | Child aged 6 to 12 who plays the game | Child app (browser game on a tablet or phone) | None. The child never has an account (03 section 5) |
| Parent or caregiver | Adult responsible for the child | Parent web app (account, child profile, result card, missions, one-off paid report, emails) | Yes, Supabase Auth (03 section 5) |
| Clinician | GP, paediatrician or child psychiatrist who receives a referral or a parent bringing the result | A summary the parent shares (no clinician account in the MVP, PROPOSAL) | None in the MVP |
| Payer or buyer | Whoever pays: the family, one-off per detailed report (D-05b), and later possibly an insurer, a health system or a school (team assumption, to validate; to be aligned with the business model canvas `research/05` when available). The consumer subscriptions found in 02 Part 3 are therapy-only, and the ADHD assessment tools found are sold to clinicians | Pitch, evidence, regulatory and privacy material | None in the MVP |

## 2. Child (6 to 12)

### 2.1 Context of use

- Plays alone or next to a parent, on a tablet or phone, in a browser, possibly installed as a PWA (03 section 1).
- Session launched by the parent through a short-lived link or a QR code; the child does not log in (03 section 5, 03 section 9).
- Many children in the 6 to 8 range cannot yet read instructions fluently (team assumption, to validate).
- The task is a go/no-go style game with a calibration block (03 sections 2.3 and 11.1). 04 section 5 proposes one story (a firefly keeper) and five mini-games, mini-game 1 being the v1 go/no-go task (PROPOSAL).
- Environment at home is uncontrolled (noise, siblings, interruptions). For the hackathon demo, one named tablet and one browser are used (03 section 2.3).

### 2.2 Needs

| ID | Need | Priority | Rationale and source | Traces to |
|---|---|---|---|---|
| UN-01 | The child needs to understand how to play without reading long text, so that the result reflects attention and not reading ability. | Must | Team assumption, to validate (reading level of 6 to 8 year olds). Serious-game performance differences were age-dependent: present in children 6-11, absent in adolescents (01 [19], PMID 40359436), which supports a child-specific design. | FR-02, NFR-31 |
| UN-02 | The child needs a practice step before the measured part, so that misunderstanding the rules is not counted as inattention or impulsivity. | Must | Team assumption, to validate. The calibration block also gives a per-device floor for reaction times (03 section 2.3). | FR-02, FR-03 |
| UN-03 | The child needs a game that is short and engaging enough to finish, so that the session produces enough data to be scored. | Must | AKL-T01 children completed 83% of expected sessions (01 [26], PMID 33334505). Demo round 60 to 90 s, full task longer (03 section 9). 04 section 5 proposes five mini-games plus a 30 s calibration, about 14 minutes in total (design choice, PROPOSAL). | FR-04, FR-05, FR-13, FR-23, FR-60 to FR-64, NFR-35 |
| UN-04 | The child needs a calm, non-punishing experience (no failure screens, no "wrong" sounds that shame, no visible score ranking), so that stress does not distort performance and the child is not hurt by playing. | Must | Anxiety disorders co-occur in 18.4% of children with ADHD (01 [5], PMID 40245462); the effect of anxiety on task performance is an inference in 01, not a finding. Otherwise team assumption, to validate. | FR-05, FR-15, FR-60 to FR-63, NFR-60 |
| UN-05 | The child needs never to be shown or told the screening result, so that the child is not labelled by a game. | Must | Team assumption, to validate. **PROPOSAL**: the child sees only an end-of-game celebration screen. | FR-15 |
| UN-06 | The child needs a game free of ads, in-app purchases, external links, loot boxes and manipulative reward loops (streak pressure, countdown offers), so that the child is not exploited. | Must | Team assumption, to validate (ethical design for children). Monetisation is aimed only at the parent through the parent web app (03 section 6). | FR-16, NFR-60 |
| UN-07 | The child needs their taps to register reliably on a touchscreen, so that a real response is not recorded as an omission. | Must | Touch input adds a constant lag of about 58 to 70 ms in browsers (Pronk 2020, via 03 section 2.1); use `pointerdown` and `event.timeStamp`, not `click` (03 section 2.3). | FR-06, NFR-20, NFR-21 |
| UN-08 | The child needs their identity to stay private (no name, photo or exact birth date collected), so that a game session cannot identify them. | Must | 03 section 5 and section 13 (nickname and birth year only). GDPR Art. 8 context in 03 section 5. | FR-31, NFR-01, NFR-02 |
| UN-09 | The child needs the game to cope with a lost connection without making them replay, so that a network failure does not cost them a session. | Should | Team assumption, to validate. Venue wifi risk is named in 03 section 9. | FR-12 |
| UN-10 | The child needs the game to fit the screen and orientation of the device, so that stimuli are fully visible. | Should | 03 section 12 (full-screen and orientation handling). | FR-14, NFR-40 |

## 3. Parent or caregiver

### 3.1 Context of use

- Has a concern about the child's attention, or was advised by a teacher, and may be on a long waiting list. In England, NHS waiting times are "up to 4+ years for children" (01 [web-A], NHS England ADHD Taskforce Part 1, 2025).
- Not a clinician. Reads the result on a phone or laptop, possibly alone, possibly anxious (team assumption, to validate).
- Creates an account, a child profile, launches a session on the child's device, reads the result card, follows missions, may buy the detailed report once per report (03 sections 5, 6, 9; D-05b).

### 3.2 Needs

| ID | Need | Priority | Rationale and source | Traces to |
|---|---|---|---|---|
| UN-11 | The parent needs to set up an account and a child profile in a few steps, so that they can start without help. | Must | Team assumption, to validate. | FR-30, FR-31, NFR-30, NFR-41 |
| UN-12 | The parent needs to start a session on the child's tablet or phone from the parent app (link or QR), so that the child never handles login. | Must | 03 section 5 and section 9. | FR-01, FR-11, FR-32 |
| UN-13 | **Safety.** The parent needs to understand that the result is not a diagnosis, so that they do not act on it as if it were one. | Must | CPTs "should be used only within a more comprehensive diagnostic process" (01 [9], PMID 37004919); QbTest "should not be used as stand-alone screening or diagnostic tool" (01 [10], PMID 37800347); NICE NG87 summary: diagnosis "should not be made solely on the basis of rating scale or observational data" (01 [web-B], summary copy, official page not read). | FR-33, FR-34, NFR-50, NFR-53 |
| UN-14 | **Safety, no false reassurance.** The parent needs a "no flag" result to say clearly that it does not rule out ADHD or any other difficulty, and that a persisting concern still justifies seeing a professional, so that a negative result does not delay care. | Must | In 1,274 referred children, QbTest NPV was as low as 24% (01 [12], PMID 37199293). Pooled CPT sensitivity 0.75 means missed cases are expected (01 [9], PMID 37004919). | FR-33, FR-34 |
| UN-15 | **Safety, next step.** The parent needs a clear next step to a professional (who to see, what to bring) whenever a follow-up is recommended, and a route to a professional at every band, so that the result leads to care and not to worry alone. | Must | Access gap: fewer than one-third of strictly diagnosed children have contact with any mental health service (01 [web-A]). Diagnosis is a clinician process including comorbidity (01 [25], PMID 31570648). | FR-35, FR-34 |
| UN-16 | The parent needs the result in plain language with the reasons behind it, so that they can understand and explain it. | Must | `ScoreResult.reasons` is "plain-language line per flag" (03 section 11.2). | FR-24, FR-33 |
| UN-17 | The parent needs to be told when the session did not produce enough usable data, so that a poor session is neither over-read nor silently discarded. | Must | `insufficient_data` band and `data_quality` block in 03 section 11.2. | FR-20, FR-23, FR-33 |
| UN-18 | **Safety, honest claims.** The parent needs the missions and recommendations to be described only as what the evidence supports (practice and engagement, not symptom improvement or treatment), so that missions are not used in place of care. | Must | Blinded evidence for digital and cognitive training is weak: computerised cognitive training ADHD total SMD 0.12, nonsignificant (01 [30], PMID 36977764); neurofeedback probably blinded SMD 0.04 (01 [34], PMID 39661381); AKL-T01 primary outcome was a lab attention score, not parent-rated symptoms (01 [26], PMID 33334505). | FR-26, FR-36, FR-37, NFR-50, NFR-52 |
| UN-19 | **Safety, access.** The parent needs to receive the follow-up message and the next step without paying, so that cost never stands between a family and a professional. | Must | **PROPOSAL** (team decides). Rationale: the access gap in 01 [web-A]. Otherwise team assumption, to validate. | FR-48 |
| UN-20 | The parent needs to see the child's sessions over time and the missions done, so that they can follow change and bring a history to a clinician. | Should | Team assumption, to validate (subscription idea, `TODO.md`). Gameplay metric change tracked attention-test change in children, with a small effect (beta 0.06) (01 [36], PMID 39128918). | FR-37, FR-38 |
| UN-21 | The parent needs a short summary they can show or send to a clinician, so that the consultation starts from the facts. | Should | Team assumption, to validate. | FR-35, FR-39 |
| UN-22 | **Child data protection.** The parent needs to control the child's data (see what is stored, delete the child profile and all its sessions), so that they stay in charge of sensitive data about their child. | Must | GDPR context and data minimisation in 03 section 5. Health-like data are sensitive (03 section 5). | FR-41, NFR-01 to NFR-07 |
| UN-23 | The parent needs to see the price and what it includes before paying for the detailed report, and to pay once per report with nothing to cancel, so that they are never trapped in a recurring charge. | Should | Stripe Checkout, one-off payment of 9.99 EUR per report (D-05b, decided by Hatem, 2026-10-20). No dark patterns: team assumption, to validate. | FR-45, FR-46, FR-47, NFR-60 |
| UN-24 | The parent needs emails that remind and summarise without exposing the child's results in the inbox, so that a shared or work mailbox does not leak sensitive data. | Should | "Emails carry no raw scores; link to the dashboard" (03 section 7). | FR-50, NFR-05 |
| UN-25 | The parent needs the result to appear on their screen without manual refresh after the child finishes, so that the hand-off feels immediate. | Could | 03 section 9 (Realtime, fallback polling every 2 s; Realtime capability unverified). | FR-39, NFR-36 |
| UN-35 | The parent needs to report the behaviours a game cannot observe (at home and at school), so that the orientation does not rest on the game alone. | Should | 04 section 2 rates 7 of the 18 DSM symptoms as not observable in a game. The NICE NG87 summary requires symptoms in "two or more important settings" (01 [web-B], summary copy). Parent report alone is weak (kappa 0.25, 01 [24], PMID 42865956), so it complements the game and does not replace it. | FR-43 |
| UN-26 | The parent needs the app in a language they read well, so that safety messages are understood. | Must | Team assumption, to validate. Language(s): TODO, open decision D-07 in 02. | NFR-45 |

## 4. Clinician (GP, paediatrician, child psychiatrist)

### 4.1 Context of use

- Receives a parent who brings the result card or summary, possibly as part of a referral. Short consultation time (team assumption, to validate).
- Applies a full clinical assessment; guidelines place diagnosis with the clinician, including comorbidity (01 [25], PMID 31570648; 01 [web-B]).
- Has no account in the MVP. A clinician-facing view is after the hackathon (PROPOSAL).

### 4.2 Needs

| ID | Need | Priority | Rationale and source | Traces to |
|---|---|---|---|---|
| UN-27 | The clinician needs the summary to state what was measured, how, and that the method is not validated (`validated: false`), so that they give it the right weight. | Should | `scoring_method` and `validated` fields (03 section 11.2). Accuracy ceiling of CPT-like tasks: Se 0.75, Sp 0.71 (01 [9], PMID 37004919). | FR-35, FR-24 |
| UN-28 | The clinician needs the summary to present itself as one input to their assessment and never as a diagnosis or a triage gate, so that it does not pre-empt or replace clinical judgement or waiting-list decisions. | Must | QbTest should not be used "as a triage system for accepting individuals on the waiting-list" (01 [10], PMID 37800347). | FR-34, FR-35, NFR-50 |
| UN-29 | The clinician needs the data quality, device and date of each session, so that they can judge whether sessions are comparable. | Should | Absolute reaction times are not comparable across devices (constant lag 58 to 133 ms depending on device and browser, 03 section 2.2). | FR-08, FR-35, NFR-24 |
| UN-30 | The clinician needs the summary to state the known limits (comorbidity overlap, girls and inattentive profiles, no norms), so that they do not over-interpret a flag. | Should | Gameplay features also classified anxiety (F 71%) and depression (F 76%) (01 [17], PMID 26196929); boys more hyperactive than girls (01 [8], PMID 32495675); no verified paediatric norms (03 section 4). | FR-35 |

## 5. Payer or buyer

### 5.1 Context of use

- For the hackathon, the jury acts as a proxy buyer (team assumption, to validate).
- Families pay 9.99 EUR once per detailed report (D-05b, decided 2026-10-20), no subscription. Other payers (insurers, health systems, schools): to be aligned with `research/05` when available.
- No product combining game-based screening, ongoing monitoring and a parent-paid subscription for children in the EU was found, and no cleared or CE-marked ADHD assessment that reports to lay users was found (02 Part 3, items 1 and 2). This is both the differentiation and the regulatory burden.

### 5.2 Needs

| ID | Need | Priority | Rationale and source | Traces to |
|---|---|---|---|---|
| UN-31 | The payer needs the evidence status stated honestly (what is shown, what is not, the validation plan), so that they can judge the value. | Should | No study found of a game-based screen in an undifferentiated child population against a full clinical reference (01, Gaps section, item 8). Objective tests show a possible workflow value rather than an accuracy value (01 [11], PMID 41220181). | FR-34, NFR-50 |
| UN-32 | The payer needs the regulatory status and intended purpose to be clear, so that they know what they buy and its compliance risk. | Should | Qualification turns on the intended purpose; an output naming ADHD is information for diagnosis or prediction, and Rule 11a gives class IIa as the floor (MDCG 2019-11 rev.1, 02 Part 2.1 to 2.4 [51]). If the indication automatically drives follow-up missions, the MDCG Rule 22 example points to class III (02 Part 2.4 item 4 [51]). | NFR-50, NFR-51, NFR-52, NFR-53 |
| UN-33 | The payer needs proof that child data are protected (GDPR, EU hosting, no secrets exposed), so that they can trust the product with children's data. | Should | 03 sections 1, 5, 9 and 13. | NFR-01 to NFR-07, NFR-10 to NFR-14 |
| UN-34 | The payer needs outcome claims limited to the evidence, so that they are not sold a treatment effect that is not shown. | Should | Same evidence as UN-18 (01 [26][29][30][31][33][34]). | NFR-50 |

## 6. Traceability: user needs to requirements

FR and NFR IDs refer to `docs/02-specification-cahier-des-charges.md`.

| UN | Priority | Functional requirements | Non-functional requirements |
|---|---|---|---|
| UN-01 | Must | FR-02 | NFR-31 |
| UN-02 | Must | FR-02, FR-03 | |
| UN-03 | Must | FR-04, FR-05, FR-13, FR-23, FR-60, FR-61, FR-62, FR-63, FR-64 | NFR-35 |
| UN-04 | Must | FR-05, FR-15, FR-60, FR-61, FR-62, FR-63 | NFR-60 |
| UN-05 | Must | FR-15 | |
| UN-06 | Must | FR-16 | NFR-60 |
| UN-07 | Must | FR-06 | NFR-20, NFR-21 |
| UN-08 | Must | FR-31 | NFR-01, NFR-02 |
| UN-09 | Should | FR-12 | |
| UN-10 | Should | FR-14 | NFR-40 |
| UN-11 | Must | FR-30, FR-31 | NFR-30, NFR-41 |
| UN-12 | Must | FR-01, FR-11, FR-32 | |
| UN-13 | Must | FR-33, FR-34 | NFR-50, NFR-53 |
| UN-14 | Must | FR-33, FR-34 | |
| UN-15 | Must | FR-34, FR-35 | |
| UN-16 | Must | FR-24, FR-33 | |
| UN-17 | Must | FR-20, FR-23, FR-33 | |
| UN-18 | Must | FR-26, FR-36, FR-37 | NFR-50, NFR-52 |
| UN-19 | Must | FR-48 | |
| UN-20 | Should | FR-37, FR-38 | |
| UN-21 | Should | FR-35, FR-39 | |
| UN-22 | Must | FR-41, FR-70, FR-71, FR-72, FR-73, FR-74 | NFR-01, NFR-02, NFR-03, NFR-04, NFR-05, NFR-06, NFR-07 |
| UN-23 | Should | FR-45, FR-46, FR-47 | NFR-60 |
| UN-24 | Should | FR-50 | NFR-05 |
| UN-25 | Could | FR-39 | NFR-36 |
| UN-26 | Must | | NFR-45 |
| UN-35 | Should | FR-43 | |
| UN-27 | Should | FR-24, FR-35 | |
| UN-28 | Must | FR-34, FR-35 | NFR-50 |
| UN-29 | Should | FR-08, FR-35 | NFR-24 |
| UN-30 | Should | FR-35 | |
| UN-31 | Should | FR-34 | NFR-50 |
| UN-32 | Should | | NFR-50, NFR-51, NFR-52, NFR-53 |
| UN-33 | Should | | NFR-01, NFR-02, NFR-03, NFR-04, NFR-05, NFR-06, NFR-07, NFR-10, NFR-11, NFR-12, NFR-13, NFR-14 |
| UN-34 | Should | | NFR-50 |

Requirements in 02 with no user need above are technical enablers (timing method, scoring internals, demo seeding); 02 marks them "enabler".

## 7. Open points on user needs

- Validate the "team assumption" needs with at least one parent and one clinician before the pitch (owner: R5, TODO).
- Finish aligning child needs with `research/04-game-design-symptom-mapping.md` (mini-game list, parent questionnaire proposal in 04 section 3).
- Align payer needs with `research/05` when available.
- If the team picks a lay-user option (Option C in 02 Part 2.8), MDCG notes that MDR Annex I 22 and 23.4(w) apply to lay users (02 Part 2.3 [51]); the parent needs above then become formal usability inputs.
