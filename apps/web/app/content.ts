// Landing copy, RO + EN, for the clinic strategy (pitch/clinic-strategy-2026-10-21.md, decided by Hatem, 21 Oct 2026):
// the app is sold to clinics; the parent books an appointment, the clinic sends a link, the parent registers, the child
// plays at home, the doctor receives the result before the visit, with the parent's consent.
// Wording rules (docs/02 section 2.3, research/05 block 9.3, MDR Art. 7): orientation, never diagnosis;
// no likelihood, severity, accuracy, treatment or validation claim; nothing says the reader's child has a
// condition. landing-copy.test.ts and landing-strategy.test.ts enforce this on every string below and on the rendered page.
// What exists today: the 10–⁠15 minute 3D game with Luma, the result card (FR-33, FR-34) and the report (FR-48), used by
// parents. What does NOT exist yet and is therefore written as how the pilot will work, never as live: the clinic sending the
// link, the doctor receiving the result, any doctor portal or clinic account (docs/01 section 4, docs/02 FR-35 summary and the
// clinician view PROPOSAL). A parent questionnaire is only a PROPOSAL (docs/02 FR-43, D-13), so the page says "game measures",
// never "survey". No figure other than the age range 6–12 and the game length is used: "wasting hours" is the owner's
// motivation, not a measured claim. No price (clinic pricing is not decided). No partnership, CE marking, ISO 13485,
// certification or clinical validation is claimed, and the device class is not stated.
// TODO (texts owner): proofread the RO text below and approve the new sentences (hero, steps, doctor section, parents
// section, consent line in privacy, the four new FAQ answers, the pilot form).
// Retention period is still open (docs/02 D-09), so the FAQ says so instead of giving a number.
// "10–⁠15": a word joiner keeps the range on one line.

export type Lang = "ro" | "en";

const ro = {
  meta: { skip: "Sari la conținut" },
  nav: {
    how: "Cum funcționează",
    doctor: "Pentru medici",
    parents: "Pentru părinți",
    privacy: "Confidențialitate",
    faq: "Întrebări",
    cta: "Clinică pilot",
    login: "Intră în cont",
    langLabel: "Limba",
  },
  hero: {
    eyebrow: "Pentru clinici și medici care văd copii de 6–12 ani",
    title: "Primește informația înainte de consult.",
    sub: "În pilot, clinica trimite părinților un link când fac programarea. Copilul joacă acasă o aventură liniștită de 10–⁠15 minute, iar medicul primește rezultatul înainte de consult, cu acordul părintelui.",
    cta: "Devino clinică pilot",
    secondary: "Vezi cum funcționează",
    trust: ["Nimic de instalat", "Rezultatul ajunge la medic doar cu acordul părintelui", "Date găzduite în UE"],
    pilot: "Pilot în dezvoltare. Nu are încă marcaj CE.",
    imgAlt: "Jocul Podul: Luma, un licurici turcoaz, lângă un pod de lemn peste un râu, noaptea, sub lună.",
  },
  problem: {
    kicker: "Consultul de azi",
    title: "Adunarea informațiilor nu ar trebui să ia timpul consultului.",
    items: [
      "Răspunsul la întrebări ia timp în timpul consultului.",
      "Strângerea informațiilor ia timp și înainte de consult.",
    ],
    punch: "ADHDCheck nu înlocuiește evaluarea medicului. Își propune să aducă informația înainte de consult.",
  },
  how: {
    kicker: "Cum funcționează",
    title: "Patru pași, de la programare la consult.",
    steps: [
      {
        title: "Părintele programează consultul",
        time: "Programare",
        body: "Părintele face programarea la medic, ca de obicei.",
      },
      {
        title: "Un link pentru înregistrare",
        time: "Pilot",
        body: "În pilot, clinica va trimite părintelui un link pentru a se înregistra și a adăuga copilul (un nume de joc și anul nașterii).",
      },
      {
        title: "Copilul joacă acasă",
        time: "10–⁠15 minute",
        body: "Copilul joacă aventura cu Luma pe telefon sau tabletă, în browser, împreună cu părintele. Nimic de instalat. Fără cronometru, fără sunete de „ai greșit”, iar copilul nu vede niciun scor.",
      },
      {
        title: "Rezultatul, înainte de consult",
        time: "Înainte de consult",
        body: "Cu acordul părintelui, medicul va primi rezultatul înainte de consult, ca vizita să poată porni de la el.",
      },
    ],
    note: "Așa este planificat să funcționeze serviciul în pilot. Astăzi aplicația este folosită de părinți: trimiterea linkului de către clinică și primirea rezultatului de către medic nu sunt încă active.",
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
    kicker: "Partea medicului",
    title: "Rezultatul, nu un diagnostic.",
    sub: "Astăzi aplicația produce un card de rezultat și un raport pentru părinte. În pilot, medicul ar primi același conținut, doar cu acordul părintelui.",
    a: "Se recomandă o evaluare de specialitate.",
    b: "Activitatea nu indică o urmărire specifică.",
    items: ["Data sesiunii", "Una din cele două propoziții de mai sus", "Măsurătorile din joc", "Mențiunea că nu este un diagnostic"],
    next: "Este o informație în plus pentru evaluarea medicului, nu o înlocuiește.",
    note: "Astăzi nu există portal pentru medici, cont de clinică sau acces pentru medic. Modul în care rezultatul ajunge la medic se stabilește împreună cu clinicile pilot.",
    disclaimer: "Acesta nu este un diagnostic: doar un specialist poate pune unul.",
  },
  parents: {
    kicker: "Pentru părinți",
    title: "Pentru părinți: ce primiți și ce faceți",
    intro: "Clinica vă invită, copilul joacă acasă, iar dumneavoastră hotărâți dacă medicul vede rezultatul.",
    items: [
      { title: "Un link de la clinică", body: "După programare, în pilot, clinica vă va trimite un link pentru a vă înregistra." },
      { title: "Vă înregistrați și adăugați copilul", body: "Un nume de joc și anul nașterii. Fără nume de familie, fără fotografie." },
      { title: "Copilul joacă acasă", body: "O aventură liniștită de 10–⁠15 minute cu Luma, pe telefon sau tabletă, în browser. Nimic de instalat. Copilul nu vede niciun scor." },
      { title: "Hotărâți dumneavoastră", body: "Rezultatul ajunge la medic doar cu acordul dumneavoastră. Vedeți rezultatul și pasul următor și în contul de părinte." },
    ],
    note: "Camera și microfonul pornesc oprite. Acesta nu este un diagnostic: doar un specialist poate pune unul.",
  },
  privacy: {
    kicker: "Confidențialitate",
    title: "Gândit de la început pentru datele unui copil",
    items: [
      { title: "Găzduit în UE", body: "Datele stau pe servere din Frankfurt, Germania." },
      { title: "Camera și microfonul, oprite", body: "Pornesc oprite. Dacă le activezi, sunt procesate pe dispozitiv. Nicio imagine și niciun sunet nu pleacă de pe telefon." },
      { title: "Medicul vede doar cu acordul tău", body: "În pilot, rezultatul ajunge la clinică doar dacă ești de acord." },
      { title: "Niciun scor pentru copil", body: "Copilul nu vede niciun scor și niciun rezultat." },
      { title: "Cât mai puține date", body: "Un nume de joc și anul nașterii. Fără nume de familie, fără fotografie." },
      { title: "Ștergi oricând", body: "Poți șterge profilul copilului și toate sesiunile lui oricând vrei." },
    ],
  },
  faq: {
    kicker: "Întrebări",
    title: "Ce întreabă clinicile și părinții",
    items: [
      {
        q: "Este un diagnostic?",
        a: "Nu. ADHDCheck nu pune diagnostice și nu înlocuiește evaluarea unui medic sau psiholog. Produce măsurători din joc și un rezultat simplu, pe care medicul le poate lua în considerare.",
      },
      {
        q: "E gata de folosit?",
        a: "Este un pilot în dezvoltare. Nu are încă marcaj CE, iar pragurile nu au fost încă verificate într-un studiu clinic. De aceea rezultatul este o recomandare, nu un verdict.",
      },
      {
        q: "Pentru cine este ADHDCheck?",
        a: "Îl construim pentru clinicile și medicii care văd copii de 6–12 ani. Părinții îl folosesc acasă, invitați de clinică. Astăzi aplicația este folosită de părinți; partea pentru clinici este planificată pentru pilot.",
      },
      {
        q: "Cum primește medicul rezultatul?",
        a: "Este planificat pentru pilot și nu este încă activ. Astăzi nu există portal pentru medici sau cont de clinică. Rezultatul ajunge la medic doar cu acordul părintelui.",
      },
      {
        q: "Trebuie părintele să trimită rezultatul?",
        a: "Nu. Rezultatul ajunge la medic doar dacă părintele este de acord.",
      },
      {
        q: "Înlocuiește chestionarele?",
        a: "Nu. Aplicația oferă măsurători din joc și un rezultat simplu. Un chestionar pentru părinți nu face parte din aplicație astăzi, iar aplicația nu înlocuiește niciun chestionar și nici evaluarea medicului.",
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
        q: "Cât costă pentru o clinică?",
        a: "Prețul pentru clinici nu este încă stabilit. Îl vom conveni cu clinicile pilot.",
      },
      {
        q: "Copilul ia deja medicamente. Mai are sens?",
        a: "Poți folosi jocul, dar îți vom cere să ne spui asta, pentru că medicamentele schimbă modul în care copilul răspunde în joc.",
      },
    ],
  },
  final: {
    title: "Vrei să îl încerci în clinica ta?",
    sub: "ADHDCheck este acum în pilot. Lasă adresa de email a clinicii și îți scriem despre participarea ca clinică pilot.",
    formLabel: "Adresa de email a clinicii",
    formPlaceholder: "clinica@exemplu.ro",
    formCta: "Devino clinică pilot",
    formNote: "Un singur email despre pilot. Fără spam.",
    consent: "Când te înscrii, ești de acord să păstrăm adresa ta de email și limba aleasă ca să îți scriem despre pilot. Nu le folosim pentru altceva și poți cere oricând să le ștergem.",
    formSuccess: "Gata! Ești pe listă. Îți scriem despre pilot.",
    formError: "Adresa nu pare corectă. Verifică și încearcă din nou.",
    formFail: "Ceva n-a mers. Încearcă din nou peste câteva secunde.",
    sending: "Se trimite…",
  },
  footer: {
    pilot: "Pilot în dezvoltare. Nu are încă marcaj CE.",
    disclaimer: "ADHDCheck este un instrument de orientare. Nu pune diagnostice și nu înlocuiește evaluarea unui medic sau psiholog. Pragurile folosite sunt ilustrative și nu au fost încă verificate într-un studiu clinic.",
    event: "Proiect realizat la hackathonul BeaHealth 2026.",
  },
  sticky: "Devino clinică pilot",
};

export type Dict = typeof ro;

const en: Dict = {
  meta: { skip: "Skip to content" },
  nav: {
    how: "How it works",
    doctor: "For doctors",
    parents: "For parents",
    privacy: "Privacy",
    faq: "FAQ",
    cta: "Pilot clinic",
    login: "Log in",
    langLabel: "Language",
  },
  hero: {
    eyebrow: "For clinics and doctors who see children aged 6–12",
    title: "Get the information before the appointment.",
    sub: "In the pilot, the clinic sends parents a link when they book. The child plays a calm 10–⁠15 minute adventure at home, and the doctor gets the result before the visit, with the parent's consent.",
    cta: "Become a pilot clinic",
    secondary: "See how it works",
    trust: ["Nothing to install", "The result reaches the doctor only with the parent's consent", "Data hosted in the EU"],
    pilot: "Pilot in development. Not CE marked yet.",
    imgAlt: "The Bridge Wait game: Luma, a teal firefly, next to a wooden bridge over a river at night, under the moon.",
  },
  problem: {
    kicker: "The visit today",
    title: "Gathering information should not take the time of the visit.",
    items: [
      "Answering questions takes time during the visit.",
      "Getting the information together takes time before the visit.",
    ],
    punch: "ADHDCheck does not replace the doctor's assessment. It aims to bring the information before the visit.",
  },
  how: {
    kicker: "How it works",
    title: "Four steps, from booking to the visit.",
    steps: [
      {
        title: "The parent books an appointment",
        time: "Booking",
        body: "The parent books the appointment with the doctor, as usual.",
      },
      {
        title: "A link to register",
        time: "Pilot",
        body: "In the pilot, the clinic will send the parent a link to register and add the child (a nickname and a birth year).",
      },
      {
        title: "The child plays at home",
        time: "10–⁠15 minutes",
        body: "The child plays the adventure with Luma on a phone or tablet, in the browser, together with the parent. Nothing to install. No timer, no “wrong!” sounds, and the child never sees a score.",
      },
      {
        title: "Result before the visit",
        time: "Before the visit",
        body: "With the parent's consent, the doctor will receive the result before the visit, so the visit can start from it.",
      },
    ],
    note: "This is how the service is planned to work in the pilot. Today the app is used by parents: sending the link from the clinic and the doctor receiving the result are not live yet.",
    handback: "All done! Now give the phone back to mum or dad.",
    handbackLabel: "What the child sees at the end",
  },
  game: {
    kicker: "The game",
    title: "For the child it is an adventure, not a test.",
    sub: "Short mini-games in one world: the night river, the fireflies and Luma.",
    games: [
      { name: "Bridge Wait", what: "Wait for the signal, then cross the river.", img: "/landing/bridge-wait-portrait.jpg" },
      { name: "Treasure Choice", what: "One gem now, or two a little later?", img: "/landing/treasure-choice-play.jpg" },
      { name: "Star Path", what: "Stars light up one by one. The child traces the same path.", img: "/landing/star-path-play.jpg" },
      { name: "Route Planner", what: "Help Luma pick up the glowing seeds, one square at a time.", img: "/landing/route-planner-play.jpg" },
    ],
    core: "The main attention game, with the fireflies, is still in development.",
    coreLabel: "In development",
    calm: ["No failure screens", "No ranking", "No timer pressure", "The child never sees a result"],
  },
  result: {
    kicker: "The doctor's side",
    title: "The result, not a diagnosis.",
    sub: "Today the app produces a result card and a report for the parent. In the pilot, the doctor would receive the same content, only with the parent's consent.",
    a: "A professional assessment is recommended.",
    b: "No specific follow-up indicated by this activity.",
    items: ["The session date", "One of the two sentences above", "The game measures", "A note that this is not a diagnosis"],
    next: "It is one input to the doctor's own assessment, never a replacement for it.",
    note: "Today there is no doctor portal, no clinic account and no doctor access. How the result reaches the doctor is being defined with the pilot clinics.",
    disclaimer: "This is not a diagnosis. Only a professional can make one.",
  },
  parents: {
    kicker: "For parents",
    title: "For parents: what you receive and do",
    intro: "The clinic invites you, your child plays at home, and you decide whether the doctor sees the result.",
    items: [
      { title: "A link from the clinic", body: "After you book, in the pilot, the clinic will send you a link to register." },
      { title: "You register and add your child", body: "A nickname and a birth year. No surname, no photo." },
      { title: "Your child plays at home", body: "A calm 10–⁠15 minute adventure with Luma, on a phone or tablet, in the browser. Nothing to install. Your child never sees a score." },
      { title: "You decide", body: "The result goes to the doctor only with your consent. You also see the result and the next step in your parent area." },
    ],
    note: "Camera and microphone start off. This is not a diagnosis. Only a professional can make one.",
  },
  privacy: {
    kicker: "Privacy",
    title: "Built from day one for a child's data",
    items: [
      { title: "Hosted in the EU", body: "Data is stored on servers in Frankfurt, Germany." },
      { title: "Camera and mic off", body: "Both start off. If you switch them on, they are processed on the device. No video or audio leaves the phone." },
      { title: "The doctor sees it only with your consent", body: "In the pilot, the result goes to the clinic only if you agree." },
      { title: "No score for the child", body: "The child never sees a score or a result." },
      { title: "As little data as possible", body: "A nickname and a birth year. No surname, no photo." },
      { title: "Delete any time", body: "You can delete your child's profile and all its sessions whenever you want." },
    ],
  },
  faq: {
    kicker: "FAQ",
    title: "What clinics and parents ask",
    items: [
      {
        q: "Is this a diagnosis?",
        a: "No. ADHDCheck does not diagnose and does not replace the assessment of a doctor or psychologist. It produces game measures and a plain result that the doctor can take into account.",
      },
      {
        q: "Is it ready to use?",
        a: "It is a pilot in development. It is not CE marked yet, and its thresholds have not yet been checked in a clinical study. That is why the result is a recommendation, not a verdict.",
      },
      {
        q: "Who is ADHDCheck for?",
        a: "We are building it for clinics and doctors who see children aged 6 to 12. Parents use it at home, invited by the clinic. Today the app is used by parents; the clinic side is planned for the pilot.",
      },
      {
        q: "How does the doctor get the result?",
        a: "This is planned for the pilot and is not live yet. There is no doctor portal or clinic account today. The result goes to the doctor only with the parent's consent.",
      },
      {
        q: "Does the parent have to share the result?",
        a: "No. The result goes to the doctor only if the parent agrees.",
      },
      {
        q: "Does it replace the questionnaires?",
        a: "No. The app gives game measures and a plain result. A parent questionnaire is not part of the app today, and the app does not replace any questionnaire or the doctor's assessment.",
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
        a: "We keep only a nickname, a birth year and how the child played (taps and timings). Data is stored on servers in Frankfurt. Camera and microphone are off by default; if you switch them on, they are processed on the device and only counts and durations leave it, never images or sound. The game works the same without them.",
      },
      {
        q: "How long do you keep the data?",
        a: "The exact retention period is being set during the pilot and will be written in the privacy notice before launch. Until then, you can delete the profile and all its sessions at any time.",
      },
      {
        q: "What does it cost a clinic?",
        a: "Pricing for clinics has not been decided yet. We will agree it with the pilot clinics.",
      },
      {
        q: "My child already takes medication. Does it still make sense?",
        a: "You can use it, but we will ask you to tell us, because medication changes how children respond in the game.",
      },
    ],
  },
  final: {
    title: "Want to try it in your clinic?",
    sub: "ADHDCheck is in a pilot right now. Leave your clinic's email and we will write to you about taking part as a pilot clinic.",
    formLabel: "Your clinic's email address",
    formPlaceholder: "clinic@example.com",
    formCta: "Become a pilot clinic",
    formNote: "One email about the pilot. No spam.",
    consent: "By joining, you agree that we store your email address and chosen language to write to you about the pilot. We use them for nothing else, and you can ask us to delete them at any time.",
    formSuccess: "Done! You are on the list. We will write to you about the pilot.",
    formError: "That address does not look right. Please check and try again.",
    formFail: "Something went wrong. Please try again in a few seconds.",
    sending: "Sending…",
  },
  footer: {
    pilot: "Pilot in development. Not CE marked yet.",
    disclaimer: "ADHDCheck is an orientation tool. It does not diagnose and does not replace an assessment by a doctor or psychologist. Thresholds are illustrative and have not yet been checked in a clinical study.",
    event: "Built at the BeaHealth 2026 hackathon.",
  },
  sticky: "Become a pilot clinic",
};

export const content: Record<Lang, Dict> = { ro, en };
