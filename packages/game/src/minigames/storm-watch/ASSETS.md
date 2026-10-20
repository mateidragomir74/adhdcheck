# Storm Watch Assets

All visuals and audio in Storm Watch are 100% procedurally synthesized:

- **Visuals (3D WebGL / three.js)**:
  - Procedural geometries: spheres, cylinders, cones, rings, boxes
  - Luma rig reused from `bridge-wait/luma.ts` (original procedural character)
  - Cartoon colorful birds, lantern post, fireflies, moths, owl symbols procedurally built
  - Subtle rain overlay in pure CSS

- **Audio (Web Audio API)**:
  - All sound effects (chime, tap, owl hoot, rolling thunder, Luma babble, rain noise) are generated in real-time via Web Audio oscillators, noise buffers, and biquad filters.
  - Zero external MP3/WAV files required.
  - 100% offline-ready, zero network latency, zero CORS or 404 risk.
