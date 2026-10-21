# adhdcheck

ADHD Check is a hackathon project (team of 4 to 5, starting 2026-10-19) with two parts:

- **Child app**: a short serious game for children aged 6 to 12, played in the browser on a tablet or phone (possibly as a PWA). Gameplay measures (reaction-time variability, omissions, commissions, off-target taps) are scored on the server with transparent, illustrative rules.
- **Parent web app**: account, child profile, a result card that says whether a professional assessment is recommended, the next step to the right professional, parent-chosen missions tracked over time, and a detailed PDF report bought once per session (9.99 EUR, Stripe test mode) and an email with a link to it behind login (the PDF is not attached).

It is an orientation tool, not a diagnosis: it never shows an ADHD probability or severity, and it has not been clinically validated. See the intended purpose in `docs/02-specification-cahier-des-charges.md`, section 2.

## Start here

**First time? Follow [docs/SETUP.md](docs/SETUP.md) to install and run the app.**

**Building? Read [docs/04-work-split.md](docs/04-work-split.md) first: who does what, and your first 2 hours.**

1. [docs/01-user-needs.md](docs/01-user-needs.md): who the users are and what they need (UN-xx), with sources and traceability.
2. [docs/02-specification-cahier-des-charges.md](docs/02-specification-cahier-des-charges.md): the build reference: intended purpose, scope, FR and NFR with acceptance criteria, architecture, the JSON contracts, data model, open decisions.
3. [docs/03-progress-plan.md](docs/03-progress-plan.md): roles, milestones, progress tracker, definition of done, demo checklist, working rules.
4. [research/01-literature-unmet-need.md](research/01-literature-unmet-need.md): evidence base and unmet need (PubMed-cited).
5. [research/02-competitors-and-regulatory.md](research/02-competitors-and-regulatory.md): competitors, MDR classification, AI Act, GDPR.
6. [research/03-tech-stack.md](research/03-tech-stack.md): stack, timing constraints, contracts, 48 h plan.
7. [research/04-game-design-symptom-mapping.md](research/04-game-design-symptom-mapping.md): symptom-to-game mapping, mini-games, AI choice, scoring code.
8. [research/05-healthcare-business-model-canvas.md](research/05-healthcare-business-model-canvas.md): Healthcare Business Model Canvas, all blocks, market size, channels, revenue.
9. [TODO.md](TODO.md): open research and team decisions.

Rules for everyone: no secrets in this public repo (`.env.example` holds names only), no real personal data, and every figure in the pitch comes from the research files with its source.
