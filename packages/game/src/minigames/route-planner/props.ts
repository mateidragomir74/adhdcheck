// Route Planner props, built in code from three.js primitives in the Bridge Wait toon style (outline hulls, 4-step
// gradient map): the lily pad Luma hops on, the stones that block a square, the glowing seed in its lotus
// cradle, and the ring that marks the pads Luma can reach with one tap. No downloaded model.
import {
  AdditiveBlending,
  BoxGeometry,
  type CanvasTexture,
  Color,
  CylinderGeometry,
  type DataTexture,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
} from "three";
import { outline } from "../bridge-wait/luma";
import { WATER_Y } from "../bridge-wait/world";
import { PAD_R, PAD_TOP_Y } from "./board3d";

export const SEED_GOLD = new Color(0xffd54d);

/** Geometries and materials shared by every board, created once per scene and disposed with it. */
export interface Kit {
  padGeo: CylinderGeometry;
  innerGeo: CylinderGeometry;
  veinGeo: BoxGeometry;
  padMat: MeshToonMaterial;
  veinMat: MeshToonMaterial;
  rockGeo: DodecahedronGeometry;
  rockMat: MeshToonMaterial;
  rockMat2: MeshToonMaterial;
  foamMat: MeshBasicMaterial;
  reedGeo: CylinderGeometry;
  reedMat: MeshToonMaterial;
  cattailMat: MeshToonMaterial;
  bushMat: MeshToonMaterial;
  bushMat2: MeshToonMaterial;
  sphere: SphereGeometry;
  petalMat: MeshToonMaterial;
  seedMat: MeshToonMaterial;
  seedHalo: SpriteMaterial;
  ringGeo: TorusGeometry;
  ringMat: MeshBasicMaterial;
  waterRingGeo: PlaneGeometry;
  outlineMat: MeshBasicMaterial;
  grad: DataTexture;
}

export function buildKit(grad: DataTexture, outlineMat: MeshBasicMaterial, glow: CanvasTexture): Kit {
  const toon = (c: number, emissive = 0x000000) =>
    new MeshToonMaterial({ color: new Color(c), gradientMap: grad, emissive: new Color(emissive) });
  return {
    // A pad with the classic notch (an open slice of 40 degrees).
    padGeo: new CylinderGeometry(1, 1, 0.07, 30, 1, false, 0.35, Math.PI * 2 - 0.7),
    innerGeo: new CylinderGeometry(0.74, 0.74, 0.02, 30, 1, false, 0.45, Math.PI * 2 - 0.9),
    veinGeo: new BoxGeometry(0.62, 0.012, 0.035).translate(0.31, 0, 0),
    padMat: toon(0x35a463),
    veinMat: toon(0x2a8a55),
    rockGeo: new DodecahedronGeometry(1, 1),
    rockMat: toon(0xa4a7c2),
    rockMat2: toon(0x878ba8),
    foamMat: new MeshBasicMaterial({ map: glow, color: 0xffffff, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }),
    reedGeo: new CylinderGeometry(0.018, 0.024, 1, 5),
    reedMat: toon(0x3f9a5c),
    cattailMat: toon(0x8a5a3a),
    bushMat: toon(0x2f9e6e),
    bushMat2: toon(0x3cb37a),
    sphere: new SphereGeometry(1, 20, 14),
    petalMat: toon(0xff9cc4),
    seedMat: toon(0xffd54d, 0x8a5a00),
    seedHalo: new SpriteMaterial({ map: glow, color: 0xffd36b, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }),
    ringGeo: new TorusGeometry(PAD_R + 0.07, 0.026, 8, 48),
    ringMat: new MeshBasicMaterial({ color: 0xfffdf7, transparent: true, opacity: 0.85 }),
    waterRingGeo: new PlaneGeometry(1, 1),
    outlineMat,
    grad,
  };
}

export interface Pad {
  root: Group;
  /** Own material for the light disc on top, so the celebration can light pads one by one. */
  top: MeshToonMaterial;
}

/** A lily pad, turned by `turn` radians so the notches do not line up across the board. */
export function buildPad(kit: Kit, turn: number): Pad {
  const root = new Group();
  const pad = new Mesh(kit.padGeo, kit.padMat);
  pad.scale.set(PAD_R, 1, PAD_R);
  pad.position.y = PAD_TOP_Y - 0.035;
  outline(pad, kit.outlineMat, 1.0).scale.set(1.07, 1.6, 1.07);
  const top = new MeshToonMaterial({ color: new Color(0x5cc77a), gradientMap: kit.grad, emissive: new Color(0x000000) });
  const inner = new Mesh(kit.innerGeo, top);
  inner.scale.set(PAD_R, 1, PAD_R);
  inner.position.y = PAD_TOP_Y + 0.004;
  root.add(pad, inner);
  for (let k = 0; k < 5; k++) {
    const v = new Mesh(kit.veinGeo, kit.veinMat);
    v.scale.set(PAD_R, 1, 1);
    v.position.y = PAD_TOP_Y + 0.016;
    v.rotation.y = 0.9 + k * 1.05;
    root.add(v);
  }
  root.rotation.y = turn;
  return { root, top };
}

/** A cluster of three rounded grey stones with white foam around them: Luma cannot land there. The broken, uneven
 * outline keeps it from reading as one more round pad. */
export function buildRock(kit: Kit, turn: number): Group {
  const root = new Group();
  const foam = new Mesh(kit.waterRingGeo, kit.foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.scale.set(1.15, 1.0, 1);
  foam.position.y = WATER_Y + 0.012;
  root.add(foam);
  const stones: [number, number, number, number, number, MeshToonMaterial][] = [
    // x, z, radius, height, tilt, material
    [-0.08, -0.05, 0.27, 0.36, 0.2, kit.rockMat],
    [0.2, 0.14, 0.17, 0.24, -0.3, kit.rockMat2],
    [-0.2, 0.2, 0.12, 0.16, 0.4, kit.rockMat2],
  ];
  for (const [x, z, r, h, tilt, mat] of stones) {
    const m = new Mesh(kit.rockGeo, mat);
    m.scale.set(r, h, r * 0.92);
    m.position.set(x, WATER_Y + h * 0.35, z);
    m.rotation.set(tilt * 0.4, tilt * 3, tilt * 0.3);
    outline(m, kit.outlineMat, 1.08);
    root.add(m);
  }
  root.rotation.y = turn;
  return root;
}

/** Riverside planting near the board: reeds at the water's edge and round bushes on the banks. Static, low
 * contrast, outside the board, so nothing competes with the pads (adhdcheck-dev skill, calm design). */
export function buildRiverside(kit: Kit, rnd: () => number): Group {
  const g = new Group();
  for (const side of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const z = 1.0 + k * 1.25 + rnd() * 0.5;
      const x = side * (2.62 + rnd() * 0.18);
      for (let j = 0; j < 3; j++) {
        const h = 0.45 + rnd() * 0.35;
        const stem = new Mesh(kit.reedGeo, kit.reedMat);
        stem.scale.set(1, h, 1);
        stem.position.set(x + (rnd() - 0.5) * 0.22, WATER_Y + 0.3 + h / 2, z + (rnd() - 0.5) * 0.22);
        stem.rotation.set((rnd() - 0.5) * 0.25, 0, (rnd() - 0.5) * 0.25);
        g.add(stem);
        if (j === 0) {
          const head = new Mesh(kit.sphere, kit.cattailMat);
          head.scale.set(0.045, 0.11, 0.045);
          head.position.set(stem.position.x, stem.position.y + h / 2, stem.position.z);
          g.add(head);
        }
      }
    }
    for (let k = 0; k < 4; k++) {
      const x = side * (3.3 + rnd() * 1.2);
      const z = 0.6 + k * 1.7 + rnd() * 0.8;
      for (let j = 0; j < 3; j++) {
        const r = 0.32 + rnd() * 0.2;
        const b = new Mesh(kit.sphere, j % 2 ? kit.bushMat : kit.bushMat2);
        b.scale.set(r, r * 0.85, r);
        b.position.set(x + (rnd() - 0.5) * 0.6, 0.6 + r * 0.55, z + (rnd() - 0.5) * 0.5);
        outline(b, kit.outlineMat, 1.05);
        g.add(b);
      }
    }
  }
  return g;
}

/**
 * The far bank upstream of the bridge: the river bends away behind a grassy bank with round trees, bushes and two
 * soft lanterns, so on a tall phone screen the top of the picture is a cosy wood rather than an empty strip of
 * water. Static. Far beyond the board, so it never competes with the pads.
 */
export function buildFarBank(kit: Kit, rnd: () => number, glow: CanvasTexture): Group {
  const g = new Group();
  const toon = (c: number) => new MeshToonMaterial({ color: new Color(c), gradientMap: kit.grad });
  const grass = toon(0x56c46e);
  const earth = toon(0x86573f);
  const bank = new Mesh(new BoxGeometry(40, 1.8, 24), [earth, earth, grass, earth, earth, earth]);
  bank.position.set(0, 0.6 - 0.9, -4.6 - 12);
  g.add(bank);
  const trunkMat = toon(0x6b4232);
  const trunkGeo = new CylinderGeometry(0.12, 0.2, 1, 7);
  const leaf = [0x2f9e6e, 0x3cb37a, 0x5ac48a, 0x2b8f7a];
  for (let k = 0; k < 11; k++) {
    const x = -6 + k * 1.2 + (rnd() - 0.5) * 0.6;
    const z = -6.2 - rnd() * 2.6;
    const h = 0.9 + rnd() * 0.9;
    const trunk = new Mesh(trunkGeo, trunkMat);
    trunk.scale.set(1, h, 1);
    trunk.position.set(x, 0.6 + h / 2, z);
    g.add(trunk);
    for (let j = 0; j < 3; j++) {
      const r = 0.6 + rnd() * 0.4;
      const c = new Mesh(kit.sphere, toon(leaf[Math.floor(rnd() * leaf.length)] as number));
      c.scale.set(r, r * 0.9, r);
      c.position.set(x + (rnd() - 0.5) * 0.8, 0.6 + h + 0.4 + j * 0.3, z + (rnd() - 0.5) * 0.6);
      outline(c, kit.outlineMat, 1.04);
      g.add(c);
    }
  }
  for (let k = 0; k < 9; k++) {
    const r = 0.3 + rnd() * 0.18;
    const b = new Mesh(kit.sphere, k % 2 ? kit.bushMat : kit.bushMat2);
    b.scale.set(r, r * 0.8, r);
    b.position.set(-4.4 + k * 1.1 + (rnd() - 0.5) * 0.4, 0.6 + r * 0.5, -4.95 - rnd() * 0.3);
    outline(b, kit.outlineMat, 1.05);
    g.add(b);
  }
  // Two lantern posts on the far bank: a steady warm glow, never a cue.
  const postMat = toon(0x8a5a3a);
  const capMat = toon(0x5a3d6b);
  const glass = new MeshBasicMaterial({ color: 0xffe58a });
  const halo = new SpriteMaterial({ map: glow, color: 0xffc457, transparent: true, opacity: 0.38, blending: AdditiveBlending, depthWrite: false });
  for (const x of [-1.7, 1.7]) {
    const post = new Mesh(trunkGeo, postMat);
    post.scale.set(0.45, 1.3, 0.45);
    post.position.set(x, 0.6 + 0.65, -5.2);
    const lamp = new Mesh(kit.sphere, glass);
    lamp.scale.setScalar(0.17);
    lamp.position.set(x, 0.6 + 1.45, -5.2);
    outline(lamp, kit.outlineMat, 1.12);
    const cap = new Mesh(kit.sphere, capMat);
    cap.scale.set(0.22, 0.09, 0.22);
    cap.position.set(x, 0.6 + 1.64, -5.2);
    const h = new Sprite(halo);
    h.scale.setScalar(1.5);
    h.position.set(x, 0.6 + 1.45, -5.1);
    g.add(post, lamp, cap, h);
  }
  return g;
}

export interface Seed {
  root: Group;
  /** The glowing seed itself (flies to Luma when picked up); the lotus cradle stays and closes. */
  seed: Group;
  cradle: Group;
}

/** A glowing golden seed resting in a small pink lotus on a pad. */
export function buildSeed(kit: Kit): Seed {
  const root = new Group();
  const cradle = new Group();
  cradle.position.y = PAD_TOP_Y + 0.03;
  for (let k = 0; k < 6; k++) {
    const pivot = new Group();
    pivot.rotation.y = (k / 6) * Math.PI * 2;
    const petal = new Mesh(kit.sphere, kit.petalMat);
    petal.scale.set(0.075, 0.03, 0.15);
    petal.position.z = 0.11;
    petal.rotation.x = -0.55;
    outline(petal, kit.outlineMat, 1.14);
    pivot.add(petal);
    cradle.add(pivot);
  }
  const seed = new Group();
  seed.position.y = PAD_TOP_Y + 0.17;
  const body = new Mesh(kit.sphere, kit.seedMat);
  body.scale.set(0.095, 0.12, 0.095);
  outline(body, kit.outlineMat, 1.12);
  const shine = new Mesh(kit.sphere, new MeshBasicMaterial({ color: 0xfffbe0 }));
  shine.scale.setScalar(0.028);
  shine.position.set(-0.035, 0.05, 0.075);
  const halo = new Sprite(kit.seedHalo);
  halo.scale.setScalar(0.85);
  seed.add(halo, body, shine);
  root.add(cradle, seed);
  return { root, seed, cradle };
}

/** The flat white ring around a pad Luma can reach with one tap (shown, never animated). */
export function buildReachRing(kit: Kit): Mesh {
  const m = new Mesh(kit.ringGeo, kit.ringMat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = PAD_TOP_Y + 0.012;
  return m;
}

export function disposeKit(kit: Kit): void {
  for (const g of [kit.padGeo, kit.innerGeo, kit.veinGeo, kit.rockGeo, kit.reedGeo, kit.sphere, kit.ringGeo, kit.waterRingGeo]) g.dispose();
  for (const m of [
    kit.padMat, kit.veinMat, kit.rockMat, kit.rockMat2, kit.foamMat, kit.reedMat, kit.cattailMat, kit.bushMat, kit.bushMat2,
    kit.petalMat, kit.seedMat, kit.seedHalo, kit.ringMat,
  ])
    m.dispose();
}
