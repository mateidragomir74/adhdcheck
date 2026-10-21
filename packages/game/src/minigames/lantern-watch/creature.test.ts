import { describe, expect, it } from "vitest";
import { CreatureView, endStimulus, startStimulus } from "./creature";

// R3-L2: task.stimulus_ms is the time the firefly or moth is on screen. The creature must be gone in the frame
// that hides it, or a moth is visible longer than the declared 500 ms and taps are logged as "isi" while it shows.
describe("CreatureView", () => {
  it("shows a firefly for a go trial and a moth for a no-go trial", () => {
    const c = new CreatureView();
    c.show("go");
    expect(c.visible).toEqual({ moth: false, firefly: true });
    c.show("nogo");
    expect(c.visible).toEqual({ moth: true, firefly: false });
  });

  it("removes a moth in the same frame as the hide", () => {
    const c = new CreatureView();
    c.show("nogo");
    c.hide();
    expect(c.visible).toEqual({ moth: false, firefly: false });
  });

  it("removes a firefly nobody caught in the same frame as the hide", () => {
    const c = new CreatureView();
    c.show("go");
    c.hide();
    expect(c.visible).toEqual({ moth: false, firefly: false });
  });

  it("keeps a caught firefly in view while it flies to Luma, then removes it", () => {
    const c = new CreatureView();
    c.show("go");
    c.caught();
    c.hide();
    expect(c.visible.firefly).toBe(true);
    c.landed();
    expect(c.visible).toEqual({ moth: false, firefly: false });
  });

  it("a flying firefly does not stay visible beside the next moth", () => {
    const c = new CreatureView();
    c.show("go");
    c.caught();
    c.hide();
    c.show("nogo");
    expect(c.visible).toEqual({ moth: true, firefly: true });
    c.hide();
    expect(c.visible).toEqual({ moth: false, firefly: true });
  });
});

// R4-7: the scene calls these two functions, so a scene that forgets to hide the creature fails here.
describe("startStimulus and endStimulus (the seam the scene uses)", () => {
  const nodes = () => ({ moth: { visible: false }, firefly: { visible: false } });

  it("endStimulus takes a moth off the screen", () => {
    const c = new CreatureView();
    const n = nodes();
    startStimulus(c, "nogo", n.moth, n.firefly);
    expect(n.moth.visible).toBe(true);
    endStimulus(c, n.moth, n.firefly);
    expect(n.moth.visible).toBe(false);
  });

  it("endStimulus takes an uncaught firefly off the screen but not a caught one", () => {
    const c = new CreatureView();
    const n = nodes();
    startStimulus(c, "go", n.moth, n.firefly);
    endStimulus(c, n.moth, n.firefly);
    expect(n.firefly.visible).toBe(false);
    startStimulus(c, "go", n.moth, n.firefly);
    c.caught();
    endStimulus(c, n.moth, n.firefly);
    expect(n.firefly.visible).toBe(true);
  });
});
