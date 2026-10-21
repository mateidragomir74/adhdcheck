import Phaser from "phaser";
import { LumaScene } from "./scenes/LumaScene";

export interface GameHandle {
  destroy: () => void;
}

export function mountGame(parent: HTMLElement): GameHandle {
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
export * from "./minigames/wake-fireflies";
export * from "./minigames/lantern-watch";
export * from "./minigames/storm-watch";
