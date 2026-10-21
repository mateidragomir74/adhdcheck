"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { content, type Dict, type Lang } from "../content";
import { Fireflies } from "./Fireflies";
import { Arrow, Check, Compass, Play, Plus, Shield } from "./icons";

const LANG_KEY = "adhdcheck.lang";

// Language lives in localStorage (with an in-memory fallback when storage is blocked).
// The server always renders Romanian; the client switches after hydration if needed.
const langListeners = new Set<() => void>();
let memLang: Lang | null = null;

function readLang(): Lang {
  if (memLang) return memLang;
  try {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "ro";
  } catch {
    return "ro";
  }
}

function writeLang(l: Lang) {
  memLang = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {}
  langListeners.forEach((f) => f());
}

function subscribeLang(cb: () => void) {
  langListeners.add(cb);
  return () => {
    langListeners.delete(cb);
  };
}

export function Landing() {
  const lang = useSyncExternalStore(subscribeLang, readLang, () => "ro" as Lang);
  const t = content[lang];

  useEffect(() => {
    document.documentElement.classList.add("js");
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useReveal(lang);

  return (
    <div className="bg-dusk-deep text-moon">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-lantern focus:px-4 focus:py-2 focus:text-on-lantern"
      >
        {t.meta.skip}
      </a>
      <Header t={t} lang={lang} setLang={writeLang} />
      <main id="main">
        <Hero t={t} />
        <Problem t={t} />
        <How t={t} />
        <Game t={t} />
        <Result t={t} />
        <Audience t={t} />
        <Plan t={t} />
        <Offer t={t} />
        <Privacy t={t} />
        <Faq t={t} />
        <Final t={t} lang={lang} />
      </main>
      <Footer t={t} />
      <StickyCta t={t} />
    </div>
  );
}

/* ---------- hooks ---------- */

// Re-runs on language change so any element React re-created is observed again.
function useReveal(lang: Lang) {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -10% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lang]);
}

/* ---------- shared bits ---------- */

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="mb-3 font-display text-base font-semibold text-river-soft">{children}</p>;
}

function H2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl ${className}`}>{children}</h2>;
}

function CtaButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <a
      href="#start"
      className={`btn-lantern inline-flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-2xl px-7 py-3 font-display text-lg font-semibold ${className}`}
    >
      {children}
      <Arrow className="size-5" />
    </a>
  );
}

function PilotNote({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-xl border border-lavender/20 px-3 py-1.5 text-sm font-semibold text-lavender">
      <span className="size-2 rounded-full bg-river-soft" aria-hidden="true" />
      {children}
    </p>
  );
}

/* ---------- header ---------- */

function Logo() {
  return (
    <a href="#main" className="flex items-center gap-2" aria-label="ADHDCheck">
      <span className="relative grid size-8 place-items-center">
        <span className="absolute inset-0 rounded-full bg-lantern/30 blur-md" />
        <span className="relative size-3 rounded-full bg-lantern shadow-[0_0_14px_4px_rgb(255_196_87/0.7)]" />
      </span>
      <span className="font-display text-xl font-bold tracking-tight text-moon">
        ADHD<span className="text-lantern">Check</span>
      </span>
    </a>
  );
}

function LangToggle({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-xl border border-white/15 bg-white/5 p-1">
      {(["ro", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`min-h-9 min-w-10 cursor-pointer rounded-lg px-3 text-sm font-bold uppercase transition-colors ${
            lang === l ? "bg-moon text-dusk" : "text-lavender hover:text-moon"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Header({ t, lang, setLang }: { t: Dict; lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-dusk-deep/90 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-semibold text-lavender lg:flex">
          <a className="hover:text-moon" href="#how">{t.nav.how}</a>
          <a className="hover:text-moon" href="#who">{t.nav.who}</a>
          <a className="hover:text-moon" href="#offer">{t.nav.offer}</a>
          <a className="hover:text-moon" href="#privacy">{t.nav.privacy}</a>
          <a className="hover:text-moon" href="#faq">{t.nav.faq}</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LangToggle lang={lang} setLang={setLang} label={t.nav.langLabel} />
          <a
            href="/login"
            className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-lavender hover:text-moon sm:px-3"
          >
            {t.nav.login}
          </a>
          <a
            href="#start"
            className="btn-lantern hidden min-h-10 items-center rounded-xl px-5 font-display text-sm font-semibold sm:inline-flex"
          >
            {t.nav.cta}
          </a>
        </div>
      </Container>
    </header>
  );
}

/* ---------- hero ---------- */

function Hero({ t }: { t: Dict }) {
  return (
    <section id="hero" className="relative overflow-hidden bg-dusk">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,#3a2d7a_0%,transparent_65%)]" aria-hidden="true" />
      <Fireflies />
      <Container className="relative pb-16 pt-8 text-center sm:pt-14 md:pb-24">
        <p className="text-sm font-semibold text-lavender sm:text-base">{t.hero.eyebrow}</p>
        <h1 className="mx-auto mt-3 max-w-4xl font-display text-[2.35rem] font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
          {t.hero.title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-lavender md:text-xl">{t.hero.sub}</p>
        <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <CtaButton>{t.hero.cta}</CtaButton>
          <a
            href="#how"
            className="inline-flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-white/20 px-6 font-display font-semibold text-moon transition-colors hover:border-white/50"
          >
            <Play className="size-4" />
            {t.hero.secondary}
          </a>
        </div>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-lavender">
          {t.hero.trust.map((x) => (
            <li key={x} className="flex items-center gap-2">
              <Check className="size-4 text-river-soft" />
              {x}
            </li>
          ))}
        </ul>
        <div className="mt-5">
          <PilotNote>{t.hero.pilot}</PilotNote>
        </div>

        <div className="relative mx-auto mt-12 max-w-5xl md:mt-16">
          <div className="absolute -inset-x-10 -inset-y-6 rounded-full bg-river/20 blur-3xl" aria-hidden="true" />
          <div className="relative hidden overflow-hidden rounded-[2rem] border-[10px] border-[#0d0a24] shadow-2xl md:block md:w-[78%]">
            <Image
              src="/landing/treasure-choice-play.jpg"
              alt=""
              width={2400}
              height={1600}
              sizes="(min-width: 768px) 60vw, 0px"
              className="block h-auto w-full"
              loading="eager"
            />
          </div>
          <div className="relative mx-auto w-[62%] max-w-[260px] overflow-hidden rounded-[2.4rem] border-[8px] border-[#0d0a24] shadow-2xl md:absolute md:-bottom-8 md:right-0 md:mx-0 md:w-[30%] md:max-w-none">
            <Image
              src="/landing/bridge-wait-portrait.jpg"
              alt={t.hero.imgAlt}
              width={860}
              height={1640}
              sizes="(min-width: 768px) 30vw, 62vw"
              className="block h-auto w-full"
              preload
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- problem ---------- */

function Problem({ t }: { t: Dict }) {
  return (
    <section className="relative bg-dusk-deep py-20 md:py-28">
      <Container>
        <div className="reveal max-w-3xl">
          <Kicker>{t.problem.kicker}</Kicker>
          <H2>{t.problem.title}</H2>
        </div>
        <ul className="mt-10 grid gap-x-10 gap-y-6 md:grid-cols-2">
          {t.problem.items.map((item, i) => (
            <li key={i} className="reveal border-t border-lavender/15 pt-5 text-lg leading-relaxed text-moon">
              “{item}”
            </li>
          ))}
        </ul>

        <p className="reveal mt-16 text-base font-semibold text-lavender">{t.problem.statsIntro}</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {t.problem.stats.map((s, i) => (
            <figure key={i} className="reveal dusk-surface flex flex-col p-6">
              <p className="font-display text-4xl font-bold tabular-nums text-lantern md:text-5xl">{s.value}</p>
              <p className="mt-3 flex-1 leading-relaxed text-moon">{s.label}</p>
              <figcaption className="mt-5 border-t border-white/10 pt-3 text-sm text-lavender-muted">{s.source}</figcaption>
            </figure>
          ))}
        </div>
        <p className="reveal mt-14 max-w-3xl font-display text-2xl font-semibold leading-snug md:text-3xl">{t.problem.punch}</p>
      </Container>
    </section>
  );
}

/* ---------- how it works ---------- */

function How({ t }: { t: Dict }) {
  return (
    <section id="how" className="relative overflow-hidden bg-dusk py-20 md:py-28">
      <Fireflies count={6} />
      <Container className="relative">
        <div className="reveal max-w-3xl">
          <Kicker>{t.how.kicker}</Kicker>
          <H2>{t.how.title}</H2>
        </div>
        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1.25fr_0.75fr]">
          <ol className="space-y-8">
            {t.how.steps.map((s, i) => (
              <li key={i} className="reveal flex gap-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-river font-display text-xl font-bold text-dusk-deep">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-2xl font-semibold">
                    {s.title}
                    <span className="ml-3 align-middle text-sm font-bold text-river-soft">{s.time}</span>
                  </h3>
                  <p className="mt-2 max-w-xl text-lg leading-relaxed text-lavender">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <figure className="reveal mx-auto w-full max-w-sm">
            <figcaption className="mb-3 text-center text-sm font-semibold text-lavender">{t.how.handbackLabel}</figcaption>
            <div className="relative overflow-hidden rounded-[2rem] border-[8px] border-[#0d0a24]">
              <Image
                src="/landing/treasure-choice-wide.jpg"
                alt=""
                width={2400}
                height={1600}
                sizes="(min-width: 1024px) 24rem, 90vw"
                className="block aspect-[4/3] h-auto w-full object-cover object-[50%_40%]"
              />
              <div className="absolute inset-0 grid place-items-center bg-dusk-deep/70 p-6">
                <p className="rounded-2xl bg-[#fffdf7] px-5 py-4 text-center font-display text-xl font-semibold leading-snug text-[#2a1f5c] shadow-xl">
                  {t.how.handback}
                </p>
              </div>
            </div>
          </figure>
        </div>
      </Container>
    </section>
  );
}

/* ---------- game ---------- */

function Game({ t }: { t: Dict }) {
  return (
    <section className="bg-dusk-deep py-20 md:py-28">
      <Container>
        <div className="reveal max-w-3xl">
          <Kicker>{t.game.kicker}</Kicker>
          <H2>{t.game.title}</H2>
          <p className="mt-4 text-lg text-lavender">{t.game.sub}</p>
        </div>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {t.game.games.map((g) => (
            <li key={g.name} className="reveal overflow-hidden rounded-3xl bg-dusk-2/60">
              {g.img ? (
                <Image
                  src={g.img}
                  alt=""
                  width={1200}
                  height={900}
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="block aspect-[4/3] h-auto w-full object-cover"
                />
              ) : (
                <div className="grid aspect-[4/3] place-items-center bg-[radial-gradient(circle_at_50%_40%,#2fbfae55,#1d1640_70%)]" aria-hidden="true">
                  <Compass className="size-14 text-river-soft" />
                </div>
              )}
              <div className="p-5">
                <h3 className="font-display text-xl font-semibold">{g.name}</h3>
                <p className="mt-1 leading-relaxed text-lavender">{g.what}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="reveal mt-6 flex flex-wrap items-center gap-3 text-lavender">
          <span className="rounded-lg bg-lantern/15 px-2.5 py-1 text-sm font-bold text-lantern">{t.game.coreLabel}</span>
          {t.game.core}
        </p>
        <ul className="reveal mt-10 flex flex-wrap gap-x-6 gap-y-3 font-semibold text-moon">
          {t.game.calm.map((c) => (
            <li key={c} className="flex items-center gap-2">
              <Check className="size-5 text-river-soft" />
              {c}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ---------- result preview ---------- */

function Result({ t }: { t: Dict }) {
  return (
    <section className="bg-dusk py-20 md:py-28">
      <Container className="grid items-center gap-10 md:grid-cols-2">
        <div className="reveal">
          <Kicker>{t.result.kicker}</Kicker>
          <H2>{t.result.title}</H2>
          <p className="mt-5 text-lg text-lavender">{t.result.sub}</p>
        </div>
        <div className="reveal space-y-3">
          {[t.result.a, t.result.b].map((h) => (
            <p key={h} className="dusk-surface flex items-start gap-3 p-5 font-display text-xl font-semibold leading-snug">
              <Compass className="mt-1 size-5 shrink-0 text-river-soft" />
              {h}
            </p>
          ))}
          <p className="flex items-start gap-3 rounded-2xl border border-lantern/40 bg-lantern/10 p-5 text-lg leading-relaxed text-moon">
            <Arrow className="mt-1 size-5 shrink-0 text-lantern" />
            {t.result.next}
          </p>
          <p className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-moon">{t.result.disclaimer}</p>
        </div>
      </Container>
    </section>
  );
}

/* ---------- audience (pitch/icp-and-go-to-market.md, ICP table) ---------- */

function Audience({ t }: { t: Dict }) {
  const a = t.audience;
  return (
    <section id="who" className="bg-dusk-deep py-20 md:py-28">
      <Container>
        <div className="reveal max-w-3xl">
          <Kicker>{a.kicker}</Kicker>
          <H2>{a.title}</H2>
          <p className="mt-4 text-lg text-lavender">{a.intro}</p>
        </div>
        <dl className="mt-12">
          {a.items.map((it, i) => (
            <div
              key={it.who}
              className={`reveal grid gap-1 border-t py-5 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-10 ${i === 0 ? "border-lantern/60" : "border-lavender/15"}`}
            >
              <dt className="font-display text-xl font-semibold text-moon">{it.who}</dt>
              <dd className="max-w-2xl text-lg leading-relaxed text-lavender">{it.why}</dd>
            </div>
          ))}
        </dl>
        <p className="reveal mt-6 border-t border-lavender/15 pt-6 text-lavender">{a.note}</p>
      </Container>
    </section>
  );
}

/* ---------- plan (pitch/icp-and-go-to-market.md, go-to-market) ---------- */

function Plan({ t }: { t: Dict }) {
  const p = t.plan;
  return (
    <section id="plan" className="bg-dusk py-20 md:py-28">
      <Container>
        <div className="reveal max-w-3xl">
          <Kicker>{p.kicker}</Kicker>
          <H2>{p.title}</H2>
          <p className="mt-4 text-lg text-lavender">{p.intro}</p>
        </div>
        <ol className="mt-12 max-w-3xl space-y-7">
          {p.steps.map((step, i) => (
            <li key={i} className="reveal flex gap-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-river font-display text-xl font-bold text-dusk-deep">
                {i + 1}
              </span>
              <p className="pt-2 text-lg leading-relaxed text-moon">{step}</p>
            </li>
          ))}
        </ol>
        <p className="reveal mt-10 max-w-3xl rounded-2xl border border-lantern/40 bg-lantern/10 p-5 text-lg leading-relaxed text-moon">
          {p.note}
        </p>
      </Container>
    </section>
  );
}

/* ---------- offer: free vs paid ---------- */

function Offer({ t }: { t: Dict }) {
  const { free, paid } = t.offer;
  return (
    <section id="offer" className="bg-dusk-deep py-20 md:py-28">
      <Container>
        <div className="reveal max-w-3xl">
          <Kicker>{t.offer.kicker}</Kicker>
          <H2>{t.offer.title}</H2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <article className="reveal dusk-surface flex flex-col p-7">
            <h3 className="font-display text-xl font-semibold text-river-soft">{free.label}</h3>
            <p className="mt-2 font-display text-5xl font-bold">{free.price}</p>
            <ul className="mt-6 space-y-3">
              {free.items.map((it) => (
                <li key={it} className="flex gap-3 text-lg text-moon">
                  <Check className="mt-1 size-5 shrink-0 text-river-soft" />
                  {it}
                </li>
              ))}
            </ul>
          </article>
          <article className="reveal flex flex-col rounded-3xl border-2 border-lantern/60 bg-dusk-2 p-7">
            <h3 className="font-display text-xl font-semibold text-lantern">{paid.label}</h3>
            <p className="mt-2 font-display text-5xl font-bold">{paid.price}</p>
            <p className="mt-1 font-semibold text-lavender">{paid.priceNote}</p>
            <ul className="mt-6 space-y-3">
              {paid.items.map((it) => (
                <li key={it} className="flex gap-3 text-lg text-moon">
                  <Check className="mt-1 size-5 shrink-0 text-lantern" />
                  {it}
                </li>
              ))}
            </ul>
          </article>
        </div>
        <div className="reveal mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-lavender">
            <Shield className="mt-0.5 size-6 shrink-0 text-river-soft" />
            {t.offer.note}
          </p>
          <CtaButton className="w-full sm:w-auto">{t.offer.cta}</CtaButton>
        </div>
      </Container>
    </section>
  );
}

/* ---------- privacy ---------- */

function Privacy({ t }: { t: Dict }) {
  return (
    <section id="privacy" className="bg-dusk py-20 md:py-28">
      <Container>
        <div className="reveal max-w-3xl">
          <Kicker>{t.privacy.kicker}</Kicker>
          <H2>{t.privacy.title}</H2>
        </div>
        <dl className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {t.privacy.items.map((p) => (
            <div key={p.title} className="reveal border-t border-lavender/15 pt-5">
              <dt className="flex items-center gap-2 font-display text-xl font-semibold">
                <Shield className="size-5 shrink-0 text-river-soft" />
                {p.title}
              </dt>
              <dd className="mt-2 leading-relaxed text-lavender">{p.body}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

/* ---------- FAQ ---------- */

function Faq({ t }: { t: Dict }) {
  return (
    <section id="faq" className="bg-dusk-deep py-20 md:py-28">
      <Container className="max-w-3xl">
        <div className="reveal">
          <Kicker>{t.faq.kicker}</Kicker>
          <H2>{t.faq.title}</H2>
        </div>
        <div className="mt-10 divide-y divide-lavender/15 border-y border-lavender/15">
          {t.faq.items.map((f, i) => (
            <details key={i} className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-lg font-semibold">
                {f.q}
                <Plus className="size-5 shrink-0 text-river-soft transition-transform group-open:rotate-45" />
              </summary>
              <p className="pb-6 leading-relaxed text-lavender">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ---------- final CTA + waitlist ---------- */

function Final({ t, lang }: { t: Dict; lang: Lang }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "invalid" | "fail">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState("invalid");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang }),
      });
      setState(res.ok ? "ok" : res.status === 400 ? "invalid" : "fail");
    } catch {
      setState("fail");
    }
  }

  const msg =
    state === "ok" ? t.final.formSuccess : state === "invalid" ? t.final.formError : state === "fail" ? t.final.formFail : null;

  return (
    <section id="start" className="relative overflow-hidden bg-dusk py-20 md:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,#3a2d7a_0%,transparent_65%)]" aria-hidden="true" />
      <Fireflies />
      <Container className="relative max-w-3xl text-center">
        <H2 className="md:text-6xl">{t.final.title}</H2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-lavender">{t.final.sub}</p>

        {state === "ok" ? (
          <p role="status" className="mx-auto mt-10 max-w-xl rounded-2xl border border-river/50 bg-river/10 p-5 font-semibold">
            {msg}
          </p>
        ) : (
          <form onSubmit={submit} noValidate className="mx-auto mt-10 max-w-xl text-left">
            <label htmlFor="email" className="mb-2 block text-sm font-bold">
              {t.final.formLabel}
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state !== "idle" && state !== "sending") setState("idle");
                }}
                placeholder={t.final.formPlaceholder}
                aria-invalid={state === "invalid"}
                aria-describedby="email-help email-consent"
                className="min-h-13 flex-1 rounded-2xl border-2 border-white/25 bg-white/10 px-5 text-base text-moon placeholder:text-lavender-muted focus:border-lantern focus:outline-none"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="btn-lantern min-h-13 cursor-pointer rounded-2xl px-7 font-display text-lg font-semibold disabled:cursor-wait disabled:opacity-60"
              >
                {state === "sending" ? t.final.sending : t.final.formCta}
              </button>
            </div>
            <p id="email-help" aria-live="polite" className={`mt-3 text-sm ${msg ? "font-semibold text-[#fda4af]" : "text-lavender"}`}>
              {msg ?? t.final.formNote}
            </p>
            <p id="email-consent" className="mt-3 text-sm leading-relaxed text-lavender-muted">
              {t.final.consent}
            </p>
          </form>
        )}
      </Container>
    </section>
  );
}

/* ---------- footer + sticky mobile CTA ---------- */

function Footer({ t }: { t: Dict }) {
  return (
    <footer className="bg-[#0b0820] pb-28 pt-12 text-sm text-lavender md:pb-12">
      <Container className="space-y-4">
        <Logo />
        <p className="font-semibold text-moon">{t.footer.pilot}</p>
        <p className="max-w-3xl leading-relaxed">{t.footer.disclaimer}</p>
        <p>{t.footer.event}</p>
      </Container>
    </footer>
  );
}

function StickyCta({ t }: { t: Dict }) {
  const [show, setShow] = useState(false);
  const seen = useRef({ hero: true, final: false });

  useEffect(() => {
    const hero = document.getElementById("hero");
    const final = document.getElementById("start");
    if (!hero || !final || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.target === hero) seen.current.hero = e.isIntersecting;
        if (e.target === final) seen.current.final = e.isIntersecting;
      });
      setShow(!seen.current.hero && !seen.current.final);
    });
    io.observe(hero);
    io.observe(final);
    return () => io.disconnect();
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-dusk-deep/95 p-3 backdrop-blur-md transition-transform duration-300 md:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!show}
    >
      <a
        href="#start"
        tabIndex={show ? 0 : -1}
        className="btn-lantern flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl font-display text-lg font-semibold"
      >
        {t.sticky}
        <Arrow className="size-5" />
      </a>
    </div>
  );
}
