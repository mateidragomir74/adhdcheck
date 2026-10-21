// Which creature is on screen, apart from three.js so it is unit-tested. task.stimulus_ms is the time the firefly
// or moth is shown (research/03), so it is removed in the frame that hides it: no leaving animation, which would
// keep it visible for longer than declared and let a tap fall in the "isi" gap while it still shows. Only a
// firefly that was caught keeps flying to Luma, because the child caused that and the trial is over.
export type CreatureType = "go" | "nogo" | "calibration";

export class CreatureView {
  private mothShown = false;
  private fireflyShown = false;
  private flying = false;

  get visible(): { moth: boolean; firefly: boolean } {
    return { moth: this.mothShown, firefly: this.fireflyShown };
  }

  show(type: CreatureType): void {
    if (type === "nogo") {
      this.mothShown = true;
      this.fireflyShown = this.flying;
    } else {
      this.mothShown = false;
      this.fireflyShown = true;
      this.flying = false; // a new go trial replaces a firefly still on its way to Luma
    }
  }

  /** The child caught the firefly: it stays in view for its flight. */
  caught(): void {
    this.flying = true;
    this.fireflyShown = true;
  }

  /** The stimulus time is over. */
  hide(): void {
    this.mothShown = false;
    this.fireflyShown = this.flying;
  }

  /** The flight reached Luma. */
  landed(): void {
    this.flying = false;
    this.fireflyShown = false;
  }
}

type Shown = { visible: boolean };

/** Copies what the creature view says onto the two three.js nodes. */
export function syncCreatures(view: CreatureView, moth: Shown, firefly: Shown): void {
  moth.visible = view.visible.moth;
  firefly.visible = view.visible.firefly;
}

/** A trial lights its creature (the scene calls this inside the frame that draws the onset). */
export function startStimulus(view: CreatureView, type: CreatureType, moth: Shown, firefly: Shown): void {
  view.show(type);
  syncCreatures(view, moth, firefly);
}

/** The stimulus time is over: the creature is off the screen in this very frame. */
export function endStimulus(view: CreatureView, moth: Shown, firefly: Shown): void {
  view.hide();
  syncCreatures(view, moth, firefly);
}
