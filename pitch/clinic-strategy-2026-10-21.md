# Clinic strategy (B2B)

Date: 21 Oct 2026. Decided by Hatem (product owner). This replaces the customer focus in `pitch/icp-and-go-to-market.md` (20 Oct 2026), where parents were the first customer.

## His words (verbatim, typos his)

> the app is sold to the clinics: the parent when they book a appointment with the doctor they receive the link to register and to give the children to play the game and then the doctor get the survey completed clear to be used instead of wasting hours in answering or trying to get the information

## Plain restatement

- Buyer: clinics (B2B).
- Flow: the parent books an appointment, the clinic sends the parent a link, the parent registers, the child plays the game at home, the doctor receives the completed result before the visit.
- Benefit: less time spent collecting information. The time saved is a motivation, not a measured figure: no number appears on the landing page.

## What changes versus `pitch/icp-and-go-to-market.md`

| Topic | 20 Oct (ICP note) | 21 Oct (this decision) |
|---|---|---|
| Buyer | Parents first, then associations, teachers, nurses, GPs | Clinics |
| Parent | The customer who decides and pays | The user who registers and has the child play, invited by the clinic |
| Doctor | Later user, via a summary the parent shares | Receives the result before the visit |
| Entry route | ADHD associations and key opinion leaders in Romania | Pilot clinics |
| Landing page | Parents first | Clinics and doctors first, a section for parents |

The regulatory plan of the ICP note (ISO 13485, CE marking, class IIa expected) is not repeated on the landing page. It is not withdrawn; the team has not yet restated it for this strategy (open point 4).

## Open points for the team

1. What "survey" means. The repo has no parent questionnaire feature: the Vanderbilt questionnaire is only a PROPOSAL (`docs/02`, FR-43, decisions D-13 and D-16, no code in `apps/` or `packages/`). Today the app gives game results only (result card FR-33, report FR-48). The landing page therefore says "the game measures and the result", not "a completed survey".
2. How the doctor receives the result. No doctor or clinic access exists: `docs/01` section 4 says the clinician has no account in the MVP, and `docs/02` lists a clinician-facing view or export as PROPOSAL. Also missing today: a clinic sending the link, a clinic dashboard. The landing page writes these as how the service will work in a pilot.
3. Pricing for clinics: none decided. The current 9.99 EUR parent report (D-05) belongs to the earlier model. The landing page states no price.
4. MDR intended purpose and intended user: the intended purpose names parents only (`docs/02` section 2.1). A doctor as user changes the intended purpose, the class reasoning and the clinical evidence needed.
5. GDPR: sharing a child's data with the clinic needs the parent's consent and a controller or processor arrangement between the clinic and us. The landing page says the result goes to the doctor only with the parent's consent.
6. The waitlist form (`/api/waitlist`) takes an email and a language only, and its confirmation email is the generic "early-access list" text. It is used as the pilot-clinic contact; a clinic-specific form or email text needs the texts owner.
7. All Romanian text on the landing page is TODO for the texts owner to proofread.
