// Landing copy, RO + EN. Every statistic carries its source on the page (research/01).
// Wording rules (docs/02 section 2.3, research/05 block 9.3, MDR Art. 7): orientation, never diagnosis;
// no likelihood, severity, accuracy, treatment or validation claim; nothing says the reader's child has a
// condition. landing-copy.test.ts enforces this on every string below and on the rendered page.
// Product facts used here, decided by the owner (2026-10-20): 10–\u206015 minute 3D game with Luma, the headline
// and next step always free (decision A), only the PDF report is paid (D-05): 9.99 EUR, one-off per report,
// reached through a link emailed to the parent who paid, behind login (docs/02 D-05b and R3-D1, DECIDED, Hatem,
// 2026-10-20). Pilot, not CE marked. TODO (texts owner): approve the two FAQ answers on the report that say a link is emailed.
// "10–\u206015": a word joiner keeps the range on one line.
// "audience" and "plan" (added 2026-10-21) come only from pitch/icp-and-go-to-market.md (team decision, 20 Oct 2026) and
// pitch/README.md. Everything not done yet is written as a plan ("we plan", "we want", "we are seeking") or as expected,
// never as a fact: no partnership, no ISO 13485 compliance, no CE marking, no clinical validation is claimed, and the
// device class is "expected". The md step "Their validation drives adoption" is not reproduced: the wording gate
// (landing-copy.ts) allows the word "validation" only inside a negation. TODO (texts owner): proofread the RO text below.
// Retention period is still open (docs/02 D-09), so the FAQ says so instead of giving a number.

export type Lang = "ro" | "en";

const ro = {
  meta: { skip: "Sari la conținut" },
  nav: {
    how: "Cum funcționează",
    who: "Pentru cine",
    offer: "Ce primești",
    privacy: "Confidențialitate",
    faq: "Întrebări",
    cta: "Vreau acces",
    login: "Intră în cont",
    langLabel: "Limba",
  },
  hero: {
    eyebrow: "Pentru părinții copiilor de 6–12 ani",
    title: "Dă-i telefonul. Primești un pas următor clar.",
    sub: "Copilul tău joacă o aventură liniștită de 10–\u206015 minute cu Luma. La final afli dacă merită să vorbești cu un specialist despre atenția și concentrarea lui, și la cine să mergi.",
    cta: "Vreau acces gratuit",
    secondary: "Vezi cum funcționează",
    trust: ["Rezultatul și pasul următor, gratuit", "Nimic de instalat", "Date găzduite în UE"],
    pilot: "Pilot în dezvoltare. Nu are încă marcaj CE.",
    imgAlt: "Jocul Podul: Luma, un licurici turcoaz, lângă un pod de lemn peste un râu, noaptea, sub lună.",
  },
  problem: {
    kicker: "Sună cunoscut?",
    title: "Ai o întrebare simplă. Nimeni nu îți dă un răspuns clar.",
    items: [
      "Învățătoarea pomenește din nou de concentrare, iar tu nu știi ce să faci cu asta.",
      "Testele de pe internet îți cer să-ți notezi singur copilul de la 1 la 5, și fiecare spune altceva.",
      "Familia îți spune să mai aștepți, că trece. Tu nu ești sigur că așteptarea e alegerea bună.",
      "Ai vrea să întrebi un specialist, dar nu știi pe cine și ce să-i duci.",
    ],
    statsIntro: "Două lucruri pe care cercetarea le spune deja:",
    stats: [
      {
        value: "4+ ani",
        label: "poate dura așteptarea pentru serviciile publice de ADHD pentru copii în Anglia.",
        source: "Independent ADHD Taskforce, Partea 1, NHS England, aprilie 2025 (PRN02031)",
      },
      {
        value: "0,25",
        label: "este acordul dintre părinți și profesori când evaluează același copil (kappa, unde 1 înseamnă acord deplin).",
        source: "Fu et al., 2026, meta-analiză: 11 studii, 8.796 de copii și adolescenți (PMID 42865956)",
      },
    ],
    punch: "ADHDCheck nu răspunde la întrebarea mare. Răspunde la prima: merită să vorbești cu cineva, și cu cine?",
  },
  how: {
    kicker: "Cum funcționează",
    title: "Trei pași. O singură seară.",
    steps: [
      {
        title: "Atingi Start",
        time: "1 minut",
        body: "Pe telefon sau tabletă, direct în browser. Nimic de instalat. Camera și microfonul rămân oprite dacă nu le pornești tu.",
      },
      {
        title: "Copilul se joacă",
        time: "10–\u206015 minute",
        body: "Dă-i dispozitivul și uită-te cum se joacă: o aventură 3D cu Luma, de-a lungul unui râu, noaptea. Fără cronometru, fără sunete de „ai greșit”, iar copilul nu vede niciun scor.",
      },
      {
        title: "Primești pasul următor",
        time: "imediat",
        body: "La final, Luma îi cere copilului să-ți dea telefonul înapoi. Tu vezi rezultatul și la cine să mergi, gratuit.",
      },
    ],
    handback: "Gata! Acum dă-i telefonul înapoi mamei sau tatei.",
    handbackLabel: "Ce vede copilul la final",
  },
  game: {
    kicker: "Jocul",
    title: "Pentru copil e o aventură, nu un test.",
    sub: "Mini-jocuri scurte, în aceeași lume: râul de noapte, licuricii și Luma.",
    games: [
      { name: "Podul", what: "Aștepți semnalul, apoi treci râul.", img: "/landing/bridge-wait-portrait.jpg" },
      { name: "Comoara", what: "O piatră prețioasă acum sau două puțin mai târziu?", img: "/landing/treasure-choice-play.jpg" },
      { name: "Cărarea stelelor", what: "Stelele se aprind pe rând. Copilul reface același drum.", img: "/landing/star-path-play.jpg" },
      { name: "Planificatorul de drum", what: "Ajută-l pe Luma să adune semințele care strălucesc, pătrat cu pătrat.", img: "/landing/route-planner-play.jpg" },
    ],
    core: "Jocul principal de atenție, cu licuricii, este încă în dezvoltare.",
    coreLabel: "În dezvoltare",
    calm: ["Fără ecrane de eșec", "Fără clasament", "Fără cronometru care grăbește", "Copilul nu vede niciun rezultat"],
  },
  result: {
    kicker: "Ce vezi tu la final",
    title: "Una din două propoziții simple. Apoi pasul următor.",
    sub: "Propoziții simple, fără etichete. Ambele variante arată la fel, fără alarme roșii.",
    a: "Se recomandă o evaluare de specialitate.",
    b: "Activitatea nu indică o urmărire specifică.",
    next: "Pasul următor: cu cine să vorbești (medicul de familie, pediatrul sau medicul psihiatru pentru copii) și ce să duci.",
    disclaimer: "Acesta nu este un diagnostic: doar un specialist poate pune unul.",
  },
  audience: {
    kicker: "Pentru cine",
    title: "Pentru cine construim ADHDCheck",
    intro: "Astăzi aplicația se adresează părinților. Ne propunem să ajungem și la cei care îi însoțesc.",
    items: [
      { who: "Părinții copiilor de 6–12 ani", why: "Ei decid dacă cer o evaluare." },
      { who: "Asociațiile pentru ADHD", why: "În fiecare țară în care facem aplicația cunoscută. Ele ajung la familii și le sfătuiesc." },
      { who: "Profesorii", why: "Ei observă la clasă probleme de atenție." },
      { who: "Asistenții medicali", why: "Ne propunem ca, înainte de consult, copiii să se joace în sala de așteptare, ca medicul să primească o primă orientare și să câștige timp." },
      { who: "Medicii de familie", why: "Ne propunem o primă orientare înainte de trimiterea la specialist." },
    ],
    note: "Părinții sunt primii. Folosirea de către profesori, asistenți medicali și medici de familie vine mai târziu, cu propriul consimțământ.",
  },
  plan: {
    kicker: "Planul nostru",
    title: "Cum ne propunem să ajungem la familii",
    intro: "Ne propunem să ajungem la familii prin asociațiile pentru ADHD și prin medicii în care ele au încredere.",
    steps: [
      "Ne propunem să contactăm asociațiile românești pentru ADHD și medicii de frunte în ADHD din România.",
      "Vrem să dezvoltăm aplicația împreună cu ei și să continuăm să o dezvoltăm.",
      "Ne propunem să lucrăm într-un sistem de management al calității conform ISO 13485.",
      "Ne propunem marcajul CE conform Regulamentului UE privind dispozitivele medicale (MDR), pentru piața europeană, începând cu România. Ne așteptăm ca aplicația să fie un dispozitiv medical de clasa IIa.",
    ],
    note: "Nimic din toate acestea nu este încă făcut. ADHDCheck este un pilot, nu are marcaj CE, iar pragurile lui nu au fost încă verificate într-un studiu clinic; căutăm un partener clinic pentru un pilot de validare.",
  },
  offer: {
    kicker: "Ce primești",
    title: "Răspunsul e gratuit. Raportul e al tău, dacă îl vrei.",
    free: {
      label: "Mereu gratuit",
      price: "0 EUR",
      items: [
        "Rezultatul: una din cele două propoziții",
        "Pasul următor: la cine să mergi",
        "Nu stă niciodată în spatele unei plăți",
      ],
    },
    paid: {
      label: "Raportul detaliat",
      price: "9,99 EUR",
      priceNote: "plătești o singură dată, fără abonament",
      items: [
        "Un PDF pe care îl duci la programare",
        "Data sesiunii, rezultatul și mențiunea că nu este un diagnostic",
        "Măsurătorile din joc",
        "Pasul următor: la cine să mergi",
      ],
    },
    note: "Decizi după ce vezi rezultatul gratuit. Nu îți cerem cardul ca să joci.",
    cta: "Vreau acces gratuit",
  },
  privacy: {
    kicker: "Confidențialitate",
    title: "Gândit de la început pentru datele unui copil",
    items: [
      { title: "Găzduit în UE", body: "Datele stau pe servere din Frankfurt, Germania." },
      { title: "Camera și microfonul, oprite", body: "Pornesc oprite. Dacă le activezi, sunt procesate pe dispozitiv. Nicio imagine și niciun sunet nu pleacă de pe telefon." },
      { title: "Niciun scor pentru copil", body: "Copilul nu vede niciun scor și niciun rezultat. Doar tu." },
      { title: "Cât mai puține date", body: "Un nume de joc și anul nașterii. Fără nume de familie, fără fotografie." },
      { title: "Ștergi oricând", body: "Poți șterge profilul copilului și toate sesiunile lui oricând vrei." },
    ],
  },
  faq: {
    kicker: "Întrebări",
    title: "Ce întreabă părinții înainte să înceapă",
    items: [
      {
        q: "Este un diagnostic?",
        a: "Nu. ADHDCheck nu pune diagnostice și nu înlocuiește un medic sau un psiholog. Te ajută să decizi dacă merită să vorbești cu un specialist despre atenția și concentrarea copilului, și cu cine.",
      },
      {
        q: "E gata de folosit?",
        a: "Este un pilot în dezvoltare. Nu are încă marcaj CE, iar pragurile nu au fost încă verificate într-un studiu clinic. De aceea rezultatul este o recomandare, nu un verdict.",
      },
      {
        q: "Pentru cine este ADHDCheck?",
        a: "Acum, pentru părinții copiilor de 6–12 ani. Folosirea de către profesori, asistenți medicali și medici de familie vine mai târziu, cu propriul consimțământ.",
      },
      {
        q: "Pentru ce vârstă este?",
        a: "Pentru copii de 6–12 ani.",
      },
      {
        q: "Cât durează?",
        a: "Între 10 și 15 minute de joc. Te poți opri oricând.",
      },
      {
        q: "Sunt în siguranță datele copilului meu?",
        a: "Păstrăm doar un nume de joc, anul nașterii și cum s-a jucat copilul (atingeri și timpi). Datele stau pe servere din Frankfurt. Camera și microfonul sunt oprite implicit; dacă le pornești, sunt procesate pe dispozitiv și pleacă doar numărători și durate, niciodată imagini sau sunet. Jocul merge la fel și fără ele.",
      },
      {
        q: "Cât timp păstrați datele?",
        a: "Durata exactă de păstrare se stabilește în timpul pilotului și va fi scrisă în nota de confidențialitate înainte de lansare. Până atunci, poți șterge oricând profilul și toate sesiunile lui.",
      },
      {
        q: "Ce primesc pentru 9,99 EUR?",
        a: "Un raport PDF detaliat pentru acea sesiune, plătit o singură dată; după plată primești pe e-mail un link către raport, în spațiul tău de părinte. Fără abonament, nimic nu se reînnoiește. Rezultatul și pasul următor rămân gratuite, fie că îl cumperi, fie că nu.",
      },
      {
        q: "Copilul ia deja medicamente. Mai are sens?",
        a: "Poți folosi jocul, dar îți vom cere să ne spui asta, pentru că medicamentele schimbă modul în care copilul răspunde în joc.",
      },
    ],
  },
  final: {
    title: "10–\u206015 minute de joc. Un pas următor clar.",
    sub: "ADHDCheck este acum în pilot. Lasă-ne adresa ta și îți trimitem linkul imediat ce poți juca.",
    formLabel: "Adresa ta de email",
    formPlaceholder: "nume@exemplu.ro",
    formCta: "Vreau acces gratuit",
    formNote: "Un singur email când poți începe. Fără spam.",
    consent: "Când te înscrii, ești de acord să păstrăm adresa ta de email și limba aleasă ca să te anunțăm când poți juca. Nu le folosim pentru altceva și poți cere oricând să le ștergem.",
    formSuccess: "Gata! Ești pe listă. Îți scriem imediat ce poți începe.",
    formError: "Adresa nu pare corectă. Verifică și încearcă din nou.",
    formFail: "Ceva n-a mers. Încearcă din nou peste câteva secunde.",
    sending: "Se trimite…",
  },
  footer: {
    pilot: "Pilot în dezvoltare. Nu are încă marcaj CE.",
    disclaimer: "ADHDCheck este un instrument de orientare. Nu pune diagnostice și nu înlocuiește evaluarea unui medic sau psiholog. Pragurile folosite sunt ilustrative și nu au fost încă verificate într-un studiu clinic.",
    event: "Proiect realizat la hackathonul BeaHealth 2026.",
  },
  sticky: "Vreau acces gratuit",
};

export type Dict = typeof ro;

const en: Dict = {
  meta: { skip: "Skip to content" },
  nav: {
    how: "How it works",
    who: "Who it is for",
    offer: "What you get",
    privacy: "Privacy",
    faq: "FAQ",
    cta: "Get access",
    login: "Log in",
    langLabel: "Language",
  },
  hero: {
    eyebrow: "For parents of children aged 6–12",
    title: "Hand them the phone. Get a clear next step.",
    sub: "Your child plays a calm 10–\u206015 minute adventure with Luma. When it ends, you learn whether it is worth talking to a professional about their attention and focus, and who to see.",
    cta: "Get free early access",
    secondary: "See how it works",
    trust: ["Result and next step free", "Nothing to install", "Data hosted in the EU"],
    pilot: "Pilot in development. Not CE marked yet.",
    imgAlt: "The Bridge Wait game: Luma, a teal firefly, next to a wooden bridge over a river at night, under the moon.",
  },
  problem: {
    kicker: "Sound familiar?",
    title: "You have a simple question. Nobody gives you a straight answer.",
    items: [
      "The teacher mentions focus again, and you are not sure what to do with it.",
      "Online quizzes ask you to rate your own child from 1 to 5, and every one says something different.",
      "Family says wait, it will pass. You are not sure waiting is the right call.",
      "You would like to ask a professional, but you do not know who, or what to bring.",
    ],
    statsIntro: "Two things the research already tells us:",
    stats: [
      {
        value: "4+ years",
        label: "can be the wait for children's ADHD services in England's public health service.",
        source: "Independent ADHD Taskforce, Part 1, NHS England, April 2025 (PRN02031)",
      },
      {
        value: "0.25",
        label: "is the agreement between parents and teachers rating the same child (kappa, where 1 is full agreement).",
        source: "Fu et al., 2026, meta-analysis: 11 studies, 8,796 children and adolescents (PMID 42865956)",
      },
    ],
    punch: "ADHDCheck does not answer the big question. It answers the first one: is it worth talking to someone, and to whom?",
  },
  how: {
    kicker: "How it works",
    title: "Three steps. One evening.",
    steps: [
      {
        title: "You tap Start",
        time: "1 minute",
        body: "On a phone or tablet, in the browser. Nothing to install. Camera and microphone stay off unless you switch them on.",
      },
      {
        title: "Your child plays",
        time: "10–\u206015 minutes",
        body: "Hand over the device and watch them play: a 3D adventure with Luma along a river at night. No timer, no “wrong!” sounds, and your child never sees a score.",
      },
      {
        title: "You get the next step",
        time: "right away",
        body: "At the end, Luma asks your child to give the phone back. You see the result and who to talk to, free.",
      },
    ],
    handback: "All done! Now give the phone back to mum or dad.",
    handbackLabel: "What your child sees at the end",
  },
  game: {
    kicker: "The game",
    title: "For your child it is an adventure, not a test.",
    sub: "Short mini-games in one world: the night river, the fireflies and Luma.",
    games: [
      { name: "Bridge Wait", what: "Wait for the signal, then cross the river.", img: "/landing/bridge-wait-portrait.jpg" },
      { name: "Treasure Choice", what: "One gem now, or two a little later?", img: "/landing/treasure-choice-play.jpg" },
      { name: "Star Path", what: "Stars light up one by one. Your child traces the same path.", img: "/landing/star-path-play.jpg" },
      { name: "Route Planner", what: "Help Luma pick up the glowing seeds, one square at a time.", img: "/landing/route-planner-play.jpg" },
    ],
    core: "The main attention game, with the fireflies, is still in development.",
    coreLabel: "In development",
    calm: ["No failure screens", "No ranking", "No timer pressure", "Your child never sees a result"],
  },
  result: {
    kicker: "What you see at the end",
    title: "One of two plain sentences. Then the next step.",
    sub: "Plain sentences, no labels. Both look the same, with no red alarm for either.",
    a: "A professional assessment is recommended.",
    b: "No specific follow-up indicated by this activity.",
    next: "Next step: who to talk to (your GP, a paediatrician or a child psychiatrist) and what to bring.",
    disclaimer: "This is not a diagnosis. Only a professional can make one.",
  },
  audience: {
    kicker: "Who it is for",
    title: "Who we are building ADHDCheck for",
    intro: "Today the app is for parents. We plan to reach the people who support them too.",
    items: [
      { who: "Parents of children aged 6–12", why: "They decide whether to seek an assessment." },
      { who: "ADHD associations", why: "In each country where we advertise the app. They reach and advise families." },
      { who: "Teachers", why: "They notice attention problems in class." },
      { who: "Nurses", why: "We plan for children to play in the waiting room before the visit, so the doctor gets a first orientation and saves time." },
      { who: "GPs (general practitioners)", why: "We plan a first orientation before a referral." },
    ],
    note: "Parents come first. Use by teachers, nurses and GPs comes later, with its own consent.",
  },
  plan: {
    kicker: "Our plan",
    title: "How we plan to reach families",
    intro: "We plan to reach families through ADHD associations and the doctors they trust.",
    steps: [
      "We plan to contact the Romanian ADHD associations and the leading doctors on ADHD in Romania.",
      "We want to develop the app together with them and keep developing it.",
      "We plan to work under a quality management system per ISO 13485.",
      "We plan CE marking under the EU Medical Device Regulation (MDR), for the European market, starting in Romania. We expect the app to be a class IIa medical device.",
    ],
    note: "None of this is done yet. ADHDCheck is a pilot, it is not CE marked and its thresholds have not yet been checked in a clinical study; we are seeking a clinical partner for a validation pilot.",
  },
  offer: {
    kicker: "What you get",
    title: "The answer is free. The report is yours if you want it.",
    free: {
      label: "Always free",
      price: "0 EUR",
      items: [
        "The result: one of the two sentences",
        "The next step: who to see",
        "Never behind a paywall",
      ],
    },
    paid: {
      label: "Detailed report",
      price: "9.99 EUR",
      priceNote: "one-off, no subscription",
      items: [
        "A PDF to bring to the appointment",
        "The session date, the result and the note that this is not a diagnosis",
        "The game measures",
        "The next step: who to see",
      ],
    },
    note: "You decide after you see the free result. No card needed to play.",
    cta: "Get free early access",
  },
  privacy: {
    kicker: "Privacy",
    title: "Built from day one for a child's data",
    items: [
      { title: "Hosted in the EU", body: "Data is stored on servers in Frankfurt, Germany." },
      { title: "Camera and mic off", body: "Both start off. If you switch them on, they are processed on the device. No video or audio leaves the phone." },
      { title: "No score for the child", body: "Your child never sees a score or a result. Only you do." },
      { title: "As little data as possible", body: "A nickname and a birth year. No surname, no photo." },
      { title: "Delete any time", body: "You can delete your child's profile and all its sessions whenever you want." },
    ],
  },
  faq: {
    kicker: "FAQ",
    title: "What parents ask before they start",
    items: [
      {
        q: "Is this a diagnosis?",
        a: "No. ADHDCheck does not diagnose and does not replace a doctor or psychologist. It helps you decide whether to talk to a professional about your child's attention and focus, and who to see.",
      },
      {
        q: "Is it ready to use?",
        a: "It is a pilot in development. It is not CE marked yet, and its thresholds have not yet been checked in a clinical study. That is why the result is a recommendation, not a verdict.",
      },
      {
        q: "Who is ADHDCheck for?",
        a: "Today, for parents of children aged 6 to 12. Use by teachers, nurses and GPs comes later, with its own consent.",
      },
      {
        q: "What age is it for?",
        a: "Children aged 6 to 12.",
      },
      {
        q: "How long does it take?",
        a: "10 to 15 minutes of play. You can stop at any time.",
      },
      {
        q: "Is my child's data safe?",
        a: "We keep only a nickname, a birth year and how your child played (taps and timings). Data is stored on servers in Frankfurt. Camera and microphone are off by default; if you switch them on, they are processed on the device and only counts and durations leave it, never images or sound. The game works the same without them.",
      },
      {
        q: "How long do you keep the data?",
        a: "The exact retention period is being set during the pilot and will be written in the privacy notice before launch. Until then, you can delete the profile and all its sessions at any time.",
      },
      {
        q: "What do I get for 9.99 EUR?",
        a: "One detailed PDF report for that session, paid once; after payment we email you a link to it in your parent area. No subscription, nothing renews. The result and the next step stay free whether you buy it or not.",
      },
      {
        q: "My child already takes medication. Does it still make sense?",
        a: "You can use it, but we will ask you to tell us, because medication changes how children respond in the game.",
      },
    ],
  },
  final: {
    title: "10–\u206015 minutes of play. One clear next step.",
    sub: "ADHDCheck is in a pilot right now. Leave your email and we will send you the link as soon as you can play.",
    formLabel: "Your email address",
    formPlaceholder: "name@example.com",
    formCta: "Get free early access",
    formNote: "One email when you can start. No spam.",
    consent: "By joining, you agree that we store your email address and chosen language to tell you when you can play. We use them for nothing else, and you can ask us to delete them at any time.",
    formSuccess: "Done! You are on the list. We will email you as soon as you can start.",
    formError: "That address does not look right. Please check and try again.",
    formFail: "Something went wrong. Please try again in a few seconds.",
    sending: "Sending…",
  },
  footer: {
    pilot: "Pilot in development. Not CE marked yet.",
    disclaimer: "ADHDCheck is an orientation tool. It does not diagnose and does not replace an assessment by a doctor or psychologist. Thresholds are illustrative and have not yet been checked in a clinical study.",
    event: "Built at the BeaHealth 2026 hackathon.",
  },
  sticky: "Get free early access",
};

export const content: Record<Lang, Dict> = { ro, en };
