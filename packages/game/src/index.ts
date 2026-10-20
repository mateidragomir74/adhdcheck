// Placeholder game (Person 1 builds the real one). Browser only: Phaser touches `window` when it
// loads, so it is imported inside mountGame and never at module load. Call this from a client
// component that is itself loaded with next/dynamic and ssr: false.
export type GameHandle = { destroy: () => void };

export async function mountGame(parent: HTMLElement): Promise<GameHandle> {
  const mod = await import("phaser");
  const Phaser = (mod as unknown as { default?: typeof mod }).default ?? mod;

  class LumaScene extends Phaser.Scene {
    constructor() {
      super("luma");
    }
    create() {
      const { width, height } = this.scale;
      this.cameras.main.setBackgroundColor("#0b1430");
      this.add
        .text(width / 2, height / 2, "Luma", { fontFamily: "sans-serif", fontSize: "48px", color: "#ffffff" })
        .setOrigin(0.5);
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 800,
    height: 600,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: LumaScene,
  });

  return { destroy: () => game.destroy(true) };
}

export * from "./minigames/bridge-wait";
export * from "./minigames/treasure-choice";
export * from "./minigames/star-path";
export * from "./minigames/route-planner";
export * from "./minigames/storm-watch";
