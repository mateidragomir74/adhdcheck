// The landing page follows the team's go-to-market decision (pitch/icp-and-go-to-market.md, 20 Oct 2026) and claims
// nothing the repo cannot back: every future item is a plan, no partnership, certification or validation is stated,
// no new figure appears, and the page metadata says nothing the body does not.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { content } from "./content";
import { Landing } from "./_components/Landing";
import { findBannedWording, findPresentTenseRegulatory, findUnnegated, metadataClaimsMissing } from "./landing-copy";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const md = readFileSync(here("../../../pitch/icp-and-go-to-market.md"), "utf8");

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

describe("landing page: the five target groups (pitch/icp-and-go-to-market.md, ICP table)", () => {
  const groups = {
    en: [/parents of children aged 6.12/i, /ADHD associations/i, /teachers/i, /nurses/i, /GPs/i],
    ro: [/părinții copiilor de 6.12 ani/i, /asociațiile pentru ADHD/i, /profesorii/i, /asistenții medicali/i, /medicii de familie/i],
  } as const;
  for (const lang of ["en", "ro"] as const) {
    it(`lists the five groups in the same order as the decision (${lang})`, () => {
      const items = content[lang].audience.items;
      expect(items).toHaveLength(5);
      groups[lang].forEach((re, i) => expect(items[i]?.who).toMatch(re));
    });
  }

  it("each group's reason comes from the decision file (key phrases found in the md)", () => {
    for (const phrase of ["Of children aged 6 to 12", "they decide whether to seek an assessment", "reach and advise families", "notice attention problems in class", "waiting room before the visit", "first orientation", "saves time", "A first orientation before referral"])
      expect(md).toContain(phrase);
    const en = content.en.audience.items.map((i) => i.why).join(" ");
    for (const phrase of ["decide whether to seek an assessment", "reach and advise families", "notice attention problems in class", "waiting room before the visit", "first orientation", "saves time", "first orientation before a referral"])
      expect(en).toContain(phrase);
  });

  it("the page says parents come first and that other uses come later, as the md answers the intended-purpose question", () => {
    expect(md).toContain("Parents first; professional and school use come later");
    expect(content.en.audience.note).toMatch(/Parents come first/);
    expect(content.en.audience.note).toMatch(/comes later/);
  });
});

describe("landing page: the go-to-market is written as a plan, never as a fact", () => {
  const FUTURE_EN = /^(We plan|We want|We expect)/;
  const FUTURE_RO = /^(Ne propunem|Vrem|Ne așteptăm)/;
  it("every plan step starts with a plan verb, in both languages", () => {
    content.en.plan.steps.forEach((st) => expect(st).toMatch(FUTURE_EN));
    content.ro.plan.steps.forEach((st) => expect(st).toMatch(FUTURE_RO));
    expect(content.en.plan.intro).toMatch(FUTURE_EN);
    expect(content.ro.plan.intro).toMatch(FUTURE_RO);
  });

  it("says what the md says: Romanian associations and leading doctors, ISO 13485, CE marking under the EU MDR for the European market starting in Romania, class IIa expected", () => {
    for (const phrase of ["Romanian ADHD associations", "ISO 13485", "CE marking under EU MDR", "class IIa", "expected", "European market, starting in Romania"]) expect(md).toContain(phrase);
    const en = content.en.plan.steps.join(" ");
    for (const phrase of ["Romanian ADHD associations", "leading doctors on ADHD in Romania", "ISO 13485", "CE marking", "MDR", "European market, starting in Romania", "We expect the app to be a class IIa"]) expect(en).toContain(phrase);
    const ro = content.ro.plan.steps.join(" ");
    for (const phrase of ["ISO 13485", "marcajul CE", "MDR", "piața europeană, începând cu România", "clasa IIa"]) expect(ro).toContain(phrase);
  });

  it("the closing note keeps the pilot disclaimers: not done yet, not CE marked, thresholds not checked in a clinical study", () => {
    expect(content.en.plan.note).toMatch(/None of this is done yet/);
    expect(content.en.plan.note).toMatch(/not CE marked/);
    expect(content.en.plan.note).toMatch(/not yet been checked in a clinical study/);
    expect(content.ro.plan.note).toMatch(/Nimic din toate acestea nu este încă făcut/);
    expect(content.ro.plan.note).toMatch(/nu are marcaj CE/);
  });

  it("the gate catches a regulatory or partnership claim written as a fact (it can fail), and passes the page", () => {
    expect(findPresentTenseRegulatory(["ADHDCheck is CE marked and ISO 13485 certified."])).not.toEqual([]);
    expect(findPresentTenseRegulatory(["The app is a class IIa medical device."])).not.toEqual([]);
    expect(findPresentTenseRegulatory(["Dezvoltat conform ISO 13485."])).not.toEqual([]);
    expect(findPresentTenseRegulatory(["We plan to work under a quality management system per ISO 13485."])).toEqual([]);
    expect(findPresentTenseRegulatory(["Pilot in development. Not CE marked yet."])).toEqual([]);
    for (const lang of ["ro", "en"] as const) expect(findPresentTenseRegulatory(strings(content[lang]))).toEqual([]);
    expect(findPresentTenseRegulatory([renderedText()])).toEqual([]);
  });

  it("claims no existing partnership, in any sentence of either language or of the rendered page", () => {
    const re = /\b(partnered|partnership with|partners? with|we work with|we are working with|in partnership|lucrăm cu|colaborăm cu|în parteneriat cu|parteneri(i)? noștri)\b/i;
    for (const text of [...strings(content.en), ...strings(content.ro), renderedText()]) expect(text).not.toMatch(re);
    // the one "partner" is a search ("we are seeking a clinical partner"), in the closing note only
    expect(content.en.plan.note).toMatch(/we are seeking a clinical partner/);
    expect(md).not.toMatch(/already (partner|work)/i);
  });
});

describe("landing page: nothing invented", () => {
  it("the new sections carry no figure other than 6 to 12 (age range) and 13485 (the standard's number), both from the md", () => {
    for (const lang of ["en", "ro"] as const) {
      const t = content[lang];
      const text = clean(strings([t.audience, t.plan]).join(" "));
      const figures = new Set([...text.matchAll(/\d+/g)].map((m) => m[0]));
      expect(figures).toEqual(new Set(["6", "12", "13485"]));
    }
    expect(md).toContain("aged 6 to 12");
    expect(md).toContain("ISO 13485");
  });

  it("the whole page still states the price only once, as 9.99 EUR, and no other price or percentage was added", () => {
    const text = renderedText();
    const prices = [...text.matchAll(/\d+[.,]\d{2}\s*(?:EUR|€)/g)].map((m) => m[0].replace(",", "."));
    expect(new Set(prices)).toEqual(new Set(["9.99 EUR"]));
    expect(text).not.toMatch(/\d\s*%/);
  });

  for (const lang of ["ro", "en"] as const) {
    it(`the new strings pass the wording gate: no diagnosis, likelihood, severity, treatment, validation or accuracy claim (${lang})`, () => {
      const t = content[lang];
      const mine = strings([t.audience, t.plan, t.nav.who, t.faq.items.find((f) => /ADHDCheck/.test(f.q) && /pentru cine|who/i.test(f.q))]);
      expect(mine.length).toBeGreaterThan(15);
      expect(findBannedWording(mine)).toEqual([]);
      expect(findUnnegated(mine)).toEqual([]);
    });
  }

  it("the existing disclaimers are all still on the page (not a diagnosis, pilot, not CE marked)", () => {
    const text = renderedText();
    expect(text).toContain("Acesta nu este un diagnostic: doar un specialist poate pune unul.");
    expect(text).toContain("Nu are încă marcaj CE.");
    expect(text).toContain("ADHDCheck este un instrument de orientare. Nu pune diagnostice");
    expect(content.en.result.disclaimer).toBe("This is not a diagnosis. Only a professional can make one.");
    expect(content.en.footer.pilot).toContain("Not CE marked yet");
  });
});

describe("landing page: metadata claims nothing the body does not say", () => {
  const layout = readFileSync(here("./layout.tsx"), "utf8");
  const meta = layout.slice(layout.indexOf("export const metadata"), layout.indexOf("export const viewport"));
  // the value of every `title:` and `description:` in the metadata object (page, description, social card title and description)
  const quoted = [...meta.matchAll(/(?:title|description):\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1] as string);

  it("title, description and social card text are found (title, description, og title, og description)", () => {
    expect(quoted.length).toBeGreaterThanOrEqual(4);
  });

  it("every word of the metadata, and every figure and named entity, appears in the Romanian page body", () => {
    const body = renderedText();
    expect(metadataClaimsMissing(quoted, body)).toEqual([]);
  });

  it("the check can fail: a planted claim the body never makes is reported", () => {
    const body = renderedText();
    expect(metadataClaimsMissing(["De la 15K EUR pentru clasa I."], body)).not.toEqual([]);
    expect(metadataClaimsMissing(["Certificat ISO 13485, validat clinic de 40 de medici."], body).length).toBeGreaterThan(0);
    expect(metadataClaimsMissing(["Un joc de 10–15 minute pentru copii de 6–12 ani."], body)).toEqual([]);
  });

  it("the metadata passes the wording gate and states no certification, partnership or validation", () => {
    expect(findBannedWording(quoted)).toEqual([]);
    expect(findUnnegated(quoted)).toEqual([]);
    expect(findPresentTenseRegulatory(quoted)).toEqual([]);
    for (const q of quoted) expect(q).not.toMatch(/ISO|13485|clasa IIa|partener|parteneri/i);
  });
});
