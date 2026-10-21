// Wording gate for the landing page (docs/02 section 2.3, FR-34, NFR-50; research/05 block 9.3, MDR Art. 7).
// Scans every string in content.ts (RO and EN) and the server-rendered page for wording the product may
// not use. A word that is only allowed inside a negation ("not a diagnosis") is checked per sentence.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { content } from "./content";
import { Landing } from "./_components/Landing";
import { findBannedWording, findUnnegated } from "./landing-copy";

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out));
  return out;
}

function renderedText(): string {
  const html = renderToStaticMarkup(createElement(Landing));
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}

describe("landing wording gate", () => {
  it("catches a planted banned word (the gate can fail)", () => {
    expect(findBannedWording(["This game is clinically proven."])).not.toEqual([]);
    expect(findBannedWording(["Does your child have ADHD?"])).not.toEqual([]);
    expect(findBannedWording(["Un rezultat cu 80% precizie."])).not.toEqual([]);
    expect(findBannedWording(["A line with an em\u2014dash."])).not.toEqual([]);
    expect(findUnnegated(["Get a diagnosis in 15 minutes."])).not.toEqual([]);
    expect(findUnnegated(["It is not a diagnosis."])).toEqual([]);
    expect(findUnnegated(["Nu este un diagnostic."])).toEqual([]);
  });

  for (const lang of ["ro", "en"] as const) {
    it(`content.ts (${lang}) has no banned wording`, () => {
      const all = strings(content[lang]);
      expect(findBannedWording(all)).toEqual([]);
      expect(findUnnegated(all)).toEqual([]);
    });
  }

  it("the rendered page has no banned wording, including text written in the components", () => {
    const text = renderedText();
    expect(text.length).toBeGreaterThan(2000);
    expect(findBannedWording([text])).toEqual([]);
    expect(findUnnegated(text.split(/(?<=[.!?])\s+/))).toEqual([]);
  });

  it("the page metadata passes the same gate and claims nothing the page does not say", () => {
    const layout = readFileSync(fileURLToPath(new URL("./layout.tsx", import.meta.url)), "utf8");
    const meta = layout.slice(layout.indexOf("export const metadata"), layout.indexOf("export const viewport"));
    const quoted = [...meta.matchAll(/"([^"]{12,})"/g)].map((m) => m[1]);
    expect(quoted.length).toBeGreaterThan(2);
    expect(findBannedWording(quoted)).toEqual([]);
    expect(findUnnegated(quoted)).toEqual([]);
    const page = strings(content.ro).join(" ").replace(/\u2060/g, "");
    for (const figure of meta.match(/\d+(?:–\d+)?/g) ?? []) expect(page).toContain(figure);
  });

  for (const lang of ["ro", "en"] as const) {
    // Clinic strategy (pitch/clinic-strategy-2026-10-21.md, open point 3): pricing for clinics is not decided, so the
    // page states no price, no subscription and no plan.
    it(`states no price and no payment term (${lang})`, () => {
      const all = strings(content[lang]).join(" ").toLowerCase();
      expect(all).not.toMatch(/\d+[.,]?\d*\s*(?:eur|€|euro|lei|ron)\b/);
      expect(all).not.toMatch(/subscription|abonament|per month|pe lună|monthly|lunar/);
    });

    it(`states the pilot status and the GDPR consent (${lang})`, () => {
      const t = content[lang];
      expect(t.footer.pilot).toMatch(/\bCE\b/);
      expect(t.hero.pilot).toMatch(/\bCE\b/);
      expect(t.final.consent.length).toBeGreaterThan(40);
    });
  }
});
