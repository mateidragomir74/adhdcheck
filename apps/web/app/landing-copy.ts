// Wording rules for every text a parent reads on the landing page (docs/02 section 2.3, FR-34, NFR-50;
// research/05 block 9.3). Used by landing-copy.test.ts; kept apart so the rules can be read in one place.

// Never allowed, in any sentence. RO and EN.
const BANNED: { rule: string; re: RegExp }[] = [
  { rule: "em-dash", re: /\u2014/ },
  { rule: "likelihood or probability", re: /\blikel(y|ihood)\b|probabil|percent chance|risk score|scor de risc/i },
  { rule: "severity", re: /\b(mild|moderate|severe|severity)\b|\bsever[ăi]?\b|\bmoderat/i },
  { rule: "treatment or improvement", re: /\btreat|\bcure\b|tratament|trateaz|vindec|\bimprov|amelior|îmbunătăț/i },
  { rule: "proof or validation claim", re: /\bproven\b|dovedit|clinically (proven|validated|tested)|validat clinic/i },
  { rule: "detection or screening", re: /\bdetect|\bscreening\b|\bscreens? for\b|depist|\bidentif(y|ies) (adhd|attention)/i },
  { rule: "accuracy claim", re: /\baccura|precizi|acurate|sensitivity|specificity|sensibilitat|specificitat/i },
  {
    rule: "asserts the reader's child has a condition",
    re: /does your child have|is your child adhd|your child (has|may have|might have) adhd|copilul (tău|dvs\.?) (are|ar putea avea) adhd|are copilul (tău )?adhd/i,
  },
  { rule: "not a medical device (docs/02 section 2.4, contradiction 1)", re: /not a medical device|nu (este|e) un dispozitiv medical/i },
];

// Allowed only in a sentence that also carries a negation ("not a diagnosis", "nu este un diagnostic").
const NEGATION_ONLY: { rule: string; re: RegExp }[] = [
  { rule: "diagnosis", re: /diagnos/i },
  { rule: "validated", re: /\bvalidat|\bvalidated\b|\bvalidation\b|\bvalidare\b/i },
];
const NEGATION = /\b(not|no|never|nor|isn't|doesn't|does not|nu|nici|niciodată|fără)\b/i;

export function findBannedWording(texts: string[]): string[] {
  const hits: string[] = [];
  for (const text of texts) {
    for (const { rule, re } of BANNED) if (re.test(text)) hits.push(`${rule}: ${text}`);
  }
  return hits;
}

export function findUnnegated(texts: string[]): string[] {
  const hits: string[] = [];
  for (const text of texts) {
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      for (const { rule, re } of NEGATION_ONLY) {
        // A question (an FAQ heading such as "Is this a diagnosis?") asserts nothing; its answer is checked.
        if (re.test(sentence) && !NEGATION.test(sentence) && !sentence.trim().endsWith("?")) hits.push(`${rule} outside a negation: ${sentence}`);
      }
    }
  }
  return hits;
}
