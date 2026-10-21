# Person 4: Parent web app

You build every page the parent sees: the landing page, sign-up, the child profile, the consent screen, the QR that starts a game, the result card, missions, the progress chart, the one-off paid report and the email.

## Read first (30 minutes)

1. `docs/04-work-split.md`: the team, the decisions, the milestones.
2. `.claude/skills/adhdcheck-dev/SKILL.md`: how we code, the UI rules and the wording rules.
3. `docs/02-specification-cahier-des-charges.md`, sections 4.3 to 4.5 (parent web app, Stripe, email), section 4.1c (consent for camera and microphone), section 5.4 (accessibility).
4. `research/03-tech-stack.md`, sections 6, 7 and 9 (payments, notifications, demo polish).
5. `docs/team/shared-texts-claims-pitch.md`: where every visible text comes from.

## You own

- Folder: `apps/web/app/` pages and components (not the API routes, which are Person 3's).
- Requirements: FR-31 to FR-38, FR-40, FR-42, FR-43, FR-45 to FR-48, FR-50, FR-70 (consent screen).

## Build order

| Step | Task | Done when |
|---|---|---|
| 1 | Scaffold the Next.js app with Person 3; layout, design tokens (colour, type, spacing) | One page renders at phone, tablet and desktop width |
| 2 | Child profile (nickname and birth year only) and "start a session" with a QR code (`qrcode` package, MIT) | Scanning the QR on the tablet opens the game |
| 3 | Consent screen before play: camera and microphone toggles, both off by default | No camera or microphone request happens before a toggle is switched on |
| 4 | Result card: exactly one of the two fixed headlines, then the next step to a professional, same visual weight for both outcomes | Walking skeleton: QR, play, result card (milestone M2, H+12) |
| 5 | Missions chosen by the parent, progress chart over the seeded 4 weeks | The chart shows the demo data |
| 6 | Stripe test mode: Checkout one-off payment of 9.99 EUR per report (D-05b), webhook handled with Person 3, the report emailed to the parent who paid. The result and next step are never behind the paywall. | A test card buys the report and it arrives by email |
| 7 | Email via Resend with no result data in it; landing page with the QR for the jury | The email arrives; the landing page passes the screenshot check |

## Rules for you

- Every visible text comes from the shared texts file. Do not write your own wording.
- Never show a probability, a severity or the word "diagnosis".
- Look at screenshots of every page you change, at phone, tablet and desktop width.

## You depend on

- Person 3: auth and the API.
- Person 2: the `ScoreResult` shape for the result card.
- The texts owner: every sentence a parent reads.
