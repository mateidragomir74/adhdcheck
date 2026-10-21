// TODO: texts owner review. Placeholder wording, English, calm and kind (docs/team/shared-texts-claims-pitch.md).
// No score or judgement words (adhdcheck-dev skill, section 5). A solved board ends with the collected line, a
// board that ends after the idle timeout ends with a calm next-board line (review ledger G7): neither says how
// well the child did.
export const STRINGS = {
  start: "Tap to start",
  practiceIntro: "Help Luma pick up the glowing seeds. Tap a lily pad next to Luma to hop there.",
  boardIntro: "Find a short way to every seed.",
  between: "All seeds collected!",
  tryNext: "Let's try the next one.",
  done: "All done. Thank you, the river is glowing.",
} as const;

/** The line shown after a board: solved, or ended by the idle timeout. */
export const betweenLine = (solved: boolean): string => (solved ? STRINGS.between : STRINGS.tryNext);
