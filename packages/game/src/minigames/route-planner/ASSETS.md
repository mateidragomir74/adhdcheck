# Route Planner: assets

No third-party file is added by this mini-game.

## Reused from Bridge Wait (licences listed in ../bridge-wait/ASSETS.md)

- Sound samples, served from `/games/bridge-wait/audio/` through `assetBase` (the convention Star Path and
  Treasure Choice use): `start-pluck.mp3` (start), `arrive-sparkle.mp3` (a seed reaches Luma), `jingle-ready.mp3`
  (a solved board), `jingle-done.mp3` (end). All Kenney, CC0 1.0, licence verified at source in
  ../bridge-wait/ASSETS.md.
- Luma (`../bridge-wait/luma.ts`), the river valley and bridge (`../bridge-wait/world.ts`), the river ambience
  (`../bridge-wait/audio.ts`) and the particles (`Particles` in `../bridge-wait/scene.ts`): made in that repo
  folder, no third-party licence.

## Made in this folder (no third-party licence)

- Lily pads, stones, seeds and lotuses, reach rings, riverside reeds and bushes, the far bank with its trees and
  lanterns: built in code from three.js primitives (`props.ts`).
- The landing plip: synthesised with the Web Audio API (`audio.ts`).
- The practice hand: the Bridge Wait SVG, redrawn in `ui.ts`.

## Libraries

- three 0.186.1, MIT (https://github.com/mrdoob/three.js/blob/dev/LICENSE), already a dependency of
  `@adhdcheck/game`. No new dependency.
