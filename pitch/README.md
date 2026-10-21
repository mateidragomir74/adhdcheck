# Pitch deck: ADHD Check, Safe MedTech Challenge Hackathon

File: `pitch/ADHD_Check_Pitch.pptx`. Built on the organisers' template (8 essential slides + appendix). The 3-minute spoken script is in the speaker notes of each slide.

Pitch rules (trainer briefing, `docs/pitch-briefing-2026-10-20.md`): deck due **21 Oct, 14:45**, then **3 min pitch + 2 min Q and A**, no tech review, a demo only inside the 3 minutes. Rehearse at least 5 times.

## Slides

| # | Slide | Notes |
|---|---|---|
| 1 | Project identity | One-line value proposition |
| 2 | Problem | Romania and EU figures, each sourced |
| 3 | Solution | User, beneficiary, decision-maker |
| 4 | How it works | Real game screens from `apps/web/public/landing/`; working / simulated / planned |
| 5 | Difference | QbTest and QbCheck as the current alternative |
| 6 | Impact and validation | Separates what works from what is unproven |
| 7 | Delivery and risks | Privacy, claims, expected class IIa |
| 8 | Team and ask | Ask: a clinical partner for a validation pilot |
| A1 to A4 | Appendix | Stakeholders, target customers and go-to-market, costs, Sources (use for questions) |

## Target customers (ICP) and go-to-market

Team decision, 20 Oct 2026 (slide 7 and appendix A2).

Target customers:

1. Parents of children aged 6 to 12.
2. ADHD associations in each country we advertise in.
3. Teachers, who notice attention problems in class.
4. Nurses: children play the game in the waiting room before the visit, so the doctor gets a first orientation and saves time.
5. GPs (general practitioners): a first orientation before referral.

Go-to-market:

1. Contact the Romanian ADHD associations and the leading doctors on ADHD in Romania (key opinion leaders).
2. Co-develop and keep improving the app with them.
3. Their validation drives adoption.
4. Develop under a quality management system per ISO 13485.
5. CE marking under EU MDR as a class IIa medical device (expected, Rule 11), for the European market.

## The team must fill before 14:45

- Team name (footer of every slide, slide 1).
- Names on slide 8 (one per role) and photos if wanted (individual pictures, not a group photo, per the trainer).
- Contact line on slide 8, owner of the next milestone on slide 7.
- Product name is still open (D-08); the deck uses "ADHD Check".
- Search for `TODO` in the deck: every remaining one is a field for the team.

## If the code changes before the pitch

The deck describes `origin/main` at `cc9368b` (20 Oct, 16:19): the child game is **not yet connected** to the scored session, the scorer is a stub, camera and microphone are **not built**, results shown are **synthetic**. If Lantern Watch and the scorer merge, update slide 4 (journey step 2 and the footer), slide 6 (Result and Limit) and the notes of slides 4 and 6. Never say the app detects or diagnoses ADHD, and never show a live QR scan unless the game is connected.

## Sources and checks

Every figure is on the A3 Sources slide. Each was checked against its primary source (PubMed abstract, Eurostat API, OECD/EC Romania profile, NHS England report, FDA 510(k), notified body price list), and every product statement against the code on `origin/main`, by an independent review before this commit. Not used on purpose: a Romanian ADHD prevalence (no primary source found), a Romanian child-psychiatrist count (press only, inconsistent), Romanian waiting times (none found).

The "about 77,000 children in Romania" figure is an estimate (1,452,261 children aged 6 to 12 x 5.29 % worldwide pooled prevalence) and is labelled as one.
