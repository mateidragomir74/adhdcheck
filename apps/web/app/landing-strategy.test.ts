// The landing page follows the clinic strategy (pitch/clinic-strategy-2026-10-21.md, decided by Hatem, 21 Oct 2026) and
// claims nothing the repo cannot back: the clinic sending the link and the doctor receiving the result are described as how
// the service will work in a pilot, never as a live feature; no doctor portal is implied; no figure, partnership, CE marking,
// ISO 13485 compliance or clinical validation is stated; the result goes to the doctor only with the parent's consent; and the
// page metadata says nothing the body does not.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { content } from "./content";
import { Landing } from "./_components/Landing";
import { findBannedWording, findPresentTenseRegulatory, findUnnegated, metadataClaimsMissing } from "./landing-copy";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const md = readFileSync(here("../../../pitch/clinic-strategy-2026-10-21.md"), "utf8");

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out));
  return out;
}
const clean = (s: string) => s.replace(/⁠/g, "").replace(/\s+/g, " ");
function renderedText(): string {
  const html = renderToStaticMarkup(createElement(Landing));
  return clean(
    html
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'"),
  );
}
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/);

describe("the decision is recorded as a source file", () => {
  it("quotes Hatem's words verbatim, with date and decider", () => {
    expect(md).toContain("21 Oct 2026");
    expect(md).toContain("Decided by Hatem");
    expect(md).toContain(
      "the app is sold to the clinics: the parent when they book a appointment with the doctor they receive the link to register and to give the children to play the game and then the doctor get the survey completed clear to be used instead of wasting hours in answering or trying to get the information",
    );
  });
  it("lists the open points the page depends on", () => {
    for (const p of ['What "survey" means', "How the doctor receives the result", "Pricing for clinics", "MDR intended purpose", "GDPR"]) expect(md).toContain(p);
  });
  it("what it says about the repo is true: the questionnaire is only a proposal and no clinician area exists", () => {
    const spec = readFileSync(here("../../../docs/02-specification-cahier-des-charges.md"), "utf8");
    expect(spec).toMatch(/FR-43 \| Parent questionnaire \(PROPOSAL/);
    expect(existsSync(here("./clinic"))).toBe(false);
    expect(existsSync(here("./doctor"))).toBe(false);
  });
});

describe("the four steps follow the decision: book, link, child plays, doctor receives the result before the visit", () => {
  const order = {
    en: [/book/i, /link/i, /plays?/i, /doctor/i],
    ro: [/programeaz|programare/i, /link/i, /joac/i, /medic/i],
  } as const;
  for (const lang of ["en", "ro"] as const) {
    it(`has 4 steps in that order (${lang})`, () => {
      const steps = content[lang].how.steps;
      expect(steps).toHaveLength(4);
      order[lang].forEach((re, i) => expect(`${steps[i]?.title} ${steps[i]?.body}`).toMatch(re));
    });
    it(`the last step says the result comes before the visit and only with the parent's consent (${lang})`, () => {
      const last = content[lang].how.steps[3];
      expect(`${last?.title} ${last?.body}`).toMatch(lang === "en" ? /before the (visit|appointment)/i : /înainte de (consult|vizit|programare)/i);
      expect(`${last?.title} ${last?.body}`).toMatch(lang === "en" ? /consent/i : /acord|consim[tț]ământ/i);
    });
  }
});

describe("features that do not exist yet are written as a plan, never as live", () => {
  // A sentence about the clinic or doctor sending or receiving must carry a plan or negation marker.
  const ACTOR = /\b(clinic|clinics|doctor|doctors|practice)\b|\b(clinica|clinicile|medicul|medicii|doctorul)\b/i;
  const ACT = /\b(sends?|receives?|gets?|sees|opens?|logs? in)\b|\b(trimite|primește|primesc|vede)\b/i;
  const MARKER = /\b(will|plan|planned|pilot|not live|not yet|no|does not|never|only if|only with|if the parent|consent|agrees?|whether|va|vor|nu|încă|doar|numai|dacă|ne propunem)\b|acord|dac[ăa]/i;
  // A question asserts nothing; its answer is checked.
  const GATE = (s: string) => !s.trim().endsWith("?") && ACTOR.test(s) && ACT.test(s) && !MARKER.test(s);

  it("the gate can fail", () => {
    expect(GATE("The doctor receives the result.")).toBe(true);
    expect(GATE("The clinic sends the parent a link.")).toBe(true);
    expect(GATE("In the pilot the doctor will receive the result.")).toBe(false);
  });

  it("no sentence of the page states a clinic or doctor action as a live fact", () => {
    for (const lang of ["en", "ro"] as const) {
      expect(strings(content[lang]).flatMap(sentences).filter(GATE)).toEqual([]);
    }
    expect(sentences(renderedText()).filter(GATE)).toEqual([]);
  });

  const IMPLIES = /\b(portal|dashboard|(?<!into )account|login|log in|logs in|platform|panou|cont|portalul|platforma)\b/i;
  const ABOUT = /(doctor|clinic|medic)/i;
  const NEG = /\b(no|not|does not|never|nu|nicio|nici|fără|will|plan|pilot|va|vor)\b/i;
  it("no doctor portal, clinic dashboard or clinic account is implied as existing", () => {
    for (const lang of ["en", "ro"] as const) {
      for (const s of strings(content[lang]).flatMap(sentences)) {
        if (ABOUT.test(s) && IMPLIES.test(s)) expect(s).toMatch(NEG);
      }
    }
    const planted = "The doctor logs in to a dashboard.";
    expect(ABOUT.test(planted) && IMPLIES.test(planted) && !NEG.test(planted)).toBe(true); // the check can fail
  });

  it("the page says plainly that the clinic link and the doctor view are not live yet, and that today the app is used by parents", () => {
    expect(content.en.how.note).toMatch(/not live yet/i);
    expect(content.en.how.note).toMatch(/today/i);
    expect(content.ro.how.note).toMatch(/nu sunt încă active/i);
    expect(content.en.result.note).toMatch(/no doctor (portal|account|access)/i);
    expect(content.ro.result.note).toMatch(/nu există/i);
  });

  it("the parent's consent is stated in the parents section, the doctor section and the privacy section", () => {
    for (const lang of ["en", "ro"] as const) {
      const re = lang === "en" ? /consent|agree/i : /acord|consim[tț]ământ/i;
      expect(strings(content[lang].parents).join(" ")).toMatch(re);
      expect(strings(content[lang].result).join(" ")).toMatch(re);
      expect(strings(content[lang].privacy).join(" ")).toMatch(re);
    }
  });
});

describe("what the doctor gets describes only what the app produces today (FR-33, FR-34, FR-48)", () => {
  it("lists the fixed sentences, the game measures, the session date and the disclaimer; no questionnaire, no diagnosis", () => {
    const en = strings(content.en.result).join(" ");
    expect(en).toContain("A professional assessment is recommended.");
    expect(en).toContain("No specific follow-up indicated by this activity.");
    expect(en).toContain("This is not a diagnosis. Only a professional can make one.");
    expect(en).toMatch(/game measures/i);
    expect(en).toMatch(/session date/i);
    expect(en).not.toMatch(/questionnaire|survey|vanderbilt|completed form/i);
    expect(strings(content.ro.result).join(" ")).not.toMatch(/chestionar|sondaj/i);
  });
  it("the FAQ says a parent questionnaire is not part of the app today", () => {
    const q = content.en.faq.items.find((f) => /questionnaire/i.test(f.q));
    expect(q?.a).toMatch(/not part of the app today/i);
  });
});

describe("nothing invented", () => {
  it("no figure on the page except the age range 6 to 12 and the 10 to 15 minute game; no percentage, price or time-saved claim", () => {
    for (const lang of ["en", "ro"] as const) {
      const text = clean(strings({ ...content[lang], footer: { ...content[lang].footer, event: "" } }).join(" ")); // the hackathon line carries the year 2026
      const figures = new Set([...text.matchAll(/\d+/g)].map((m) => m[0]));
      expect([...figures].filter((f) => !["6", "12", "10", "15"].includes(f))).toEqual([]);
      expect(text).not.toMatch(/\d\s*%/);
      expect(text).not.toMatch(/\bhours?\b|\bore\b|saves? time|minutes saved|economis|câștig(ă|i) timp|wast/i);
    }
    expect(renderedText()).not.toMatch(/\d\s*%|\d+[.,]\d{2}\s*(EUR|€)/);
  });

  it("states no regulatory status as a fact and no existing partnership", () => {
    for (const lang of ["ro", "en"] as const) expect(findPresentTenseRegulatory(strings(content[lang]))).toEqual([]);
    expect(findPresentTenseRegulatory([renderedText()])).toEqual([]);
    const re = /\b(partnered|partnership with|partners? with|we work with|we are working with|in partnership|lucrăm cu|colaborăm cu|în parteneriat cu|parteneri(i)? noștri)\b/i;
    for (const text of [...strings(content.en), ...strings(content.ro), renderedText()]) expect(text).not.toMatch(re);
    expect(renderedText()).not.toMatch(/clinically (validated|proven|tested)|validat clinic|certified|certificat/i);
  });

  it("the device class is not stated on the page", () => {
    expect(renderedText()).not.toMatch(/class II|clasa II/i);
  });

  for (const lang of ["ro", "en"] as const) {
    it(`every string passes the wording gate (${lang})`, () => {
      const all = strings(content[lang]);
      expect(findBannedWording(all)).toEqual([]);
      expect(findUnnegated(all)).toEqual([]);
    });
  }

  it("the disclaimers are still on the page (not a diagnosis, pilot, not CE marked, thresholds not checked clinically)", () => {
    const text = renderedText();
    expect(text).toContain("Acesta nu este un diagnostic: doar un specialist poate pune unul.");
    expect(text).toContain("Nu are încă marcaj CE.");
    expect(text).toContain("ADHDCheck este un instrument de orientare. Nu pune diagnostice");
    expect(content.en.result.disclaimer).toBe("This is not a diagnosis. Only a professional can make one.");
    expect(content.en.footer.pilot).toContain("Not CE marked yet");
  });
});

describe("the page is clinic-first with a section for parents and a pilot call to action", () => {
  it("the hero speaks to clinics and doctors", () => {
    expect(content.en.hero.eyebrow).toMatch(/clinics/i);
    expect(content.en.hero.title).toMatch(/before the appointment/i);
    expect(content.ro.hero.eyebrow).toMatch(/clinici/i);
  });
  it("there is a parents section and the call to action is to become a pilot clinic, through the existing waitlist form", () => {
    expect(content.en.parents.title).toMatch(/parents/i);
    expect(content.en.final.formCta).toMatch(/pilot clinic/i);
    expect(content.ro.final.formCta).toMatch(/clinic/i);
    expect(readFileSync(here("./_components/Landing.tsx"), "utf8")).toContain('"/api/waitlist"');
  });
});

describe("metadata claims nothing the body does not say", () => {
  const layout = readFileSync(here("./layout.tsx"), "utf8");
  const meta = layout.slice(layout.indexOf("export const metadata"), layout.indexOf("export const viewport"));
  const quoted = [...meta.matchAll(/(?:title|description):\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1] as string);

  it("title, description, og title and og description are found", () => {
    expect(quoted.length).toBeGreaterThanOrEqual(4);
  });
  it("the metadata is written for clinics", () => {
    expect(quoted.join(" ")).toMatch(/clinic/i);
  });
  it("every word and figure of the metadata appears in the Romanian page body", () => {
    expect(metadataClaimsMissing(quoted, renderedText())).toEqual([]);
  });
  it("the check can fail", () => {
    const body = renderedText();
    expect(metadataClaimsMissing(["Economisește 3 ore pe consult."], body)).not.toEqual([]);
    expect(metadataClaimsMissing(["Validat clinic, certificat ISO 13485."], body)).not.toEqual([]);
  });
  it("the metadata passes the wording gate and states no certification, partnership or validation", () => {
    expect(findBannedWording(quoted)).toEqual([]);
    expect(findUnnegated(quoted)).toEqual([]);
    expect(findPresentTenseRegulatory(quoted)).toEqual([]);
    for (const q of quoted) expect(q).not.toMatch(/ISO|13485|clasa IIa|partener|parteneri|ore\b|hours/i);
  });
});
