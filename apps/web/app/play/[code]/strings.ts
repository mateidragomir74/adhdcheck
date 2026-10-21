// TODO (Person 4): placeholder wording for the play page, to be replaced by the approved texts.
// Short, one idea per screen, nothing about results (FR-15).
export const PLAY_STRINGS = {
  checking: "One moment...",
  invalid: "This game link does not work any more. Ask your parent for a new one.",
  unavailable: "The game is not ready yet. Ask your parent.",
  ready: "Hi! Tap the button to start.",
  start: "Start",
  // FR-70 child-friendly explanation, shown only when the parent switched a sensor on.
  sensorsCamera: "Today the tablet camera helps Luma see if you are looking at the game. No photos are kept.",
  sensorsMicrophone: "Today the tablet microphone helps Luma hear if it is noisy around you. No sounds are kept.",
  sensorsBoth: "Today the tablet camera and microphone help Luma. No photos or sounds are kept.",
  playing: "",
  saving: "Well done! Saving...",
  offline: "Waiting for the internet. Keep the tablet open.",
  done: "All done, thank you! You can give the tablet back.",
} as const;

// TODO (Person 4, texts owner): placeholder wording for the card between two mini-games. No source text exists.
// {n} is the number of the game about to start, {total} how many games the session has. One idea, nothing about
// results or how the child did (FR-15). Only "en" is shown today; "ro" is ready for when the play page is translated.
export const TRANSITION_STRINGS = {
  en: { title: "Game {n} of {total}", hint: "Get ready!" },
  ro: { title: "Jocul {n} din {total}", hint: "Pregătește-te!" },
} as const;

export function transitionText(lang: keyof typeof TRANSITION_STRINGS, n: number, total: number) {
  const t = TRANSITION_STRINGS[lang];
  return { title: t.title.replace("{n}", String(n)).replace("{total}", String(total)), hint: t.hint };
}
