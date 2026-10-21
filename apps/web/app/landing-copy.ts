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

// A regulatory status or a partnership is a plan or a negation on this page, never a present fact: no CE marking,
// ISO 13485 compliance, class or certification may be stated unless the sentence also plans, expects, seeks or negates it.
// Case-sensitive on purpose: "CE" must not match the Romanian word "ce".
const REGULATORY = /13485|marcaj CE|CE mark|\bCE\b|clas[aă] IIa|class IIa|\bMDR\b|\bISO\b|[Cc]ertif/;
// A plan marker must come BEFORE the first regulatory term of the sentence, or a negation must sit just before it (within
// 35 characters, no comma or colon between): "not CE marked", "nu are încă marcaj CE", "fără marcaj CE". "It is CE
// marked, not a toy." negates something else, after the claim, so it is flagged.
const PLAN_MARKER = /(?<![\p{L}])(?:plan|planned|expect|expected|seek|seeking|want|intend|nimic|none)(?![\p{L}])|propunem|vrem|intenț|așteptăm|căutăm/iu;
const NEGATION_BEFORE = /(?<![\p{L}])(?:not|never|nu|nici|fără)(?![\p{L}])[^,;:]*$/iu;

export function findPresentTenseRegulatory(texts: string[]): string[] {
  const hits: string[] = [];
  for (const text of texts) {
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      const m = REGULATORY.exec(sentence);
      if (!m) continue;
      const plan = PLAN_MARKER.exec(sentence);
      const planFirst = plan !== null && plan.index < m.index;
      const negated = NEGATION_BEFORE.test(sentence.slice(Math.max(0, m.index - 35), m.index));
      if (!planFirst && !negated) hits.push(`regulatory status stated as a fact: ${sentence}`);
    }
  }
  return hits;
}

// Page title, description and social card are read by far more people than the body, and nobody reads them against it:
// every figure and every word of four letters or more in a metadata text must appear in the page body (diacritics
// and case folded; a word counts when its first five letters appear in some body word, so "liniștit" finds "liniștită").
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u2060/g, "").toLowerCase();
const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

// A word counts as found when a body word equals it, or is it plus or minus at most two letters at the end (an inflection:
// "liniștit" and "liniștită"). "validat" is not found by "validare": the stems differ, so a claim cannot ride on a neighbour.
const sameWord = (a: string, b: string) => a === b || (Math.abs(a.length - b.length) <= 2 && Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)));

export function metadataClaimsMissing(metaTexts: string[], body: string): string[] {
  const bodyWords = [...new Set(words(body))];
  const missing: string[] = [];
  for (const text of metaTexts) {
    for (const word of words(text)) {
      const found = /\d/.test(word) ? bodyWords.includes(word) : word.length < 4 || bodyWords.some((b) => sameWord(word, b));
      if (!found) missing.push(`"${word}" in "${text}"`);
    }
  }
  return missing;
}
