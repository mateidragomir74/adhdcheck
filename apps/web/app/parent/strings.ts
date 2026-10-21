// Parent screen wording. Only the three band headlines are DECIDED (docs/02 FR-34, D-03a) and the two
// supporting lines are the FR-34 PROPOSAL, copied unchanged. Everything else is a placeholder:
// TODO (Person 4 / texts owner) replace with the approved texts (shared-texts-claims-pitch.md).
export const BAND_TEXT = {
  follow_up_suggested: {
    headline: "A professional assessment is recommended",
    support: "",
  },
  no_flag: {
    headline: "No specific follow-up indicated by this activity",
    support: "This does not rule out attention difficulties. If you are still worried, talk to a healthcare professional.",
  },
  insufficient_data: {
    headline: "Not enough data from this session. You can play again.",
    support: "",
  },
} as const;

export const S = {
  appName: "ADHDCheck",
  login: {
    title: "Parent space",
    email: "Email",
    passLabel: "Password", // check-secrets: allow
    submitLogin: "Log in",
    submitSignup: "Create account",
    toSignup: "No account yet? Create one",
    toLogin: "Already have an account? Log in",
    checkEmail: "Check your email to confirm your account, then log in.",
    failed: "That did not work. Check your email and password.", // check-secrets: allow
    weak: "Choose a longer password.", // check-secrets: allow
  },
  nav: { children: "Children", logout: "Log out" },
  home: {
    title: "Your children",
    empty: "Add a child to start their first game.",
    nickname: "Nickname",
    birthYear: "Birth year",
    add: "Add child",
    addHint: "Nickname and birth year only. No real name needed.",
    open: "Open",
    lastResult: "Last result",
    noResult: "No game played yet",
  },
  // FR-50 weekly summary email, placeholder wording (TODO texts owner).
  email: {
    title: "Email summary",
    hint: "Get a short email with a link back to this page. It never contains results.",
    send: "Email me this week's summary",
    sent: "Sent. Check your inbox.",
    skipped: "Email is not set up yet.",
    failed: "The email could not be sent.",
  },
  demo: { label: "Demo account", reset: "Reset demo", resetting: "Resetting…", done: "Demo data restored." },
  billing: {
    unavailable: "Payment is not available right now. Please try again later.",
  },
  // D-05 and D-05b (DECIDED, Hatem, 2026-10-20): only the detailed report is paid, 9.99 EUR, one-off per
  // report; the parent who paid gets an emailed link to it (R3-D1). offerTitle and sentAndHere are the owner's words;
  // TODO (texts owner): sentAndHere says "Sent to your email" and now what is sent is a link, so confirm or reword; the rest is
  // placeholder wording for the texts owner (shared-texts-claims-pitch.md). offerText lists only what
  // lib/report.ts buildReport puts in the PDF.
  report: {
    offerTitle: "Get the detailed report, 9.99 EUR, one-off",
    offerText:
      "A PDF of this session to bring to an appointment: the date, the result with the note that it is not a diagnosis, the game measures and the next step. You pay once for this report. Nothing renews.",
    offerFree: "The result and the next step above stay free, whether you buy the report or not.",
    buy: "Get the report",
    buying: "Opening the payment page…",
    // R3-P1: placeholder wording for the texts owner (TODO), shown while a Checkout was opened and not paid.
    inProgress: "A payment for this report was started and is not confirmed yet.",
    resume: "Continue the payment",
    confirming: "Thank you. We are confirming the payment. This can take a moment; you can reload this page.",
    sentAndHere: "Sent to your email, and available here",
    availableHere: "Your report is available here.",
    checking: "Checking the report…",
    download: "Download the report (PDF)",
    preparing: "Preparing the report…",
  },
  session: {
    title: "Play a game",
    start: "Start a game on the tablet",
    scan: "Scan this code with the tablet, or open the link on it.",
    waiting: "Waiting for the game to finish…",
    expires: "The link works once and expires at",
    newResult: "New result",
    failed: "Could not create a game link. Try again.",
    cancel: "Cancel",
  },
  // NFR-04 consent to processing, asked once before the first game. Placeholder wording: TODO texts owner
  // (docs/02 NFR-04 "Consent text: TODO"). When the final text lands, change PROCESSING_CONSENT_VERSION.
  processing: {
    title: "Before the first game",
    explain:
      "To show you a result, we keep what the game records while your child plays: taps and their timing, linked to the nickname and birth year you entered. Deleting the child deletes all of it.",
    agree: "I am this child's parent or legal guardian, and I agree to this.",
    button: "Continue",
  },
  // FR-70 consent, placeholder wording for the texts owner (shared-texts-claims-pitch.md, step 1).
  consent: {
    title: "Camera and microphone (optional)",
    explain:
      "The game works the same with both off. If you switch one on, the tablet only counts simple things, like whether your child is looking at the screen or how noisy the room is. No photo, video or sound is kept or sent.",
    camera: "Camera",
    microphone: "Microphone",
    on: "On",
    off: "Off",
  },
  result: {
    title: "Result",
    of: "Game of",
    why: "Why",
    indicators: "What the game measured",
    quality: "Data quality",
    trials: "trials",
    anticipations: "early taps",
    nextStep: "Next step",
    // Roles from docs/02 FR-35; sentence is a placeholder.
    nextStepText: "Talk to your family doctor, a paediatrician or a child psychiatrist, and bring this result with you.",
    notValidated: "These measures are not yet compared with norms for children.",
  },
  indicator: {
    omission_rate: "Missed targets",
    commission_rate: "Taps when asked to wait",
    off_target_tap_rate: "Taps outside targets",
    rt_cv: "Response speed variation",
  },
  progress: {
    title: "Progress",
    empty: "Progress appears after a few games.",
    devices: "Games on different devices are not directly comparable.",
    missionsDone: "missions done",
  },
  missions: {
    title: "Missions",
    hint: "Wellbeing activities you choose together.",
    add: "Add",
    done: "Done",
    remove: "Remove",
    empty: "No mission chosen yet.",
  },
  child: {
    back: "All children",
    // R6-9: a link from the report email opened while logged in as another parent. TODO (texts owner): approve.
    notFound: "This page is not available for the account you are logged in with. Use Log out, then log in with the account that bought the report.",
    history: "Earlier games",
    delete: "Delete child and all data",
    confirmDelete: "Delete this child and every game and mission? This cannot be undone.",
  },
  error: "Something went wrong. Reload the page to try again.",
  loading: "Loading…",
} as const;
