// Lantern Watch props, built in code from three.js primitives (no downloaded model): a row of lanterns that
// stand on the bridge deck, the firefly (go) and the moth (no-go). Go and no-go differ in three ways at once,
// so neither colour vision nor the creature alone carries the signal (colour-blind safe):
//   - go:    warm gold glow (bright), a small round glowing firefly with tiny wings hovering in front;
//   - no-go: cool blue-violet glow (clearly darker), a big moth with wide spread wings sitting on the glass.
import {
  AdditiveBlending,
  type CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  type DataTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
} from "three";
import { outline } from "../bridge-wait/luma";
import { deckY } from "../bridge-wait/world";

export const LANTERN_X = [-1.65, 0, 1.65] as const;
/** Lanterns stand a little in front of the deck's centre line so the far rail never crosses them. */
export const LANTERN_Z = 0.18;
const STAND = 0.78; // post height above the deck

export const GLASS_OFF = new Color(0x5b4d85);
export const GO_GLASS = new Color(0xffd84a);
export const GO_HALO = new Color(0xffbf3d);
export const NOGO_GLASS = new Color(0x7d8fe8);
export const NOGO_HALO = new Color(0x6f7dff);

export interface Lantern {
  root: Group;
  glass: MeshBasicMaterial;
  halo: SpriteMaterial;
  haloSprite: Sprite;
  /** World position of the glass centre (hit test and flights). */
  centre: { x: number; y: number; z: number };
}

export function lanternTopY(x: number): number {
  return deckY(x) + STAND;
}

export function buildLanterns(grad: DataTexture, outlineMat: MeshBasicMaterial, glow: CanvasTexture): Lantern[] {
  const toon = (c: number) => new MeshToonMaterial({ color: new Color(c), gradientMap: grad });
  const wood = toon(0x8a5a3a);
  const metal = toon(0x5a3d6b);
  const postGeo = new CylinderGeometry(0.06, 0.08, 1, 8);
  const footGeo = new CylinderGeometry(0.2, 0.24, 0.07, 10);
  const baseGeo = new CylinderGeometry(0.26, 0.3, 0.1, 10);
  const glassGeo = new SphereGeometry(0.34, 24, 16);
  const capGeo = new ConeGeometry(0.4, 0.3, 10);
  const knobGeo = new SphereGeometry(0.07, 10, 8);
  const ringGeo = new TorusGeometry(0.11, 0.025, 6, 16);
  const barGeo = new CylinderGeometry(0.018, 0.018, 0.62, 5);

  return LANTERN_X.map((x) => {
    const root = new Group();
    const deck = deckY(x);
    const top = lanternTopY(x);
    root.position.set(x, 0, LANTERN_Z);

    const foot = new Mesh(footGeo, metal);
    foot.position.y = deck + 0.04;
    const post = new Mesh(postGeo, wood);
    post.scale.y = STAND;
    post.position.y = deck + STAND / 2;
    outline(post, outlineMat, 1.0).scale.set(1.4, 1.0, 1.4);
    const base = new Mesh(baseGeo, metal);
    base.position.y = top + 0.03;
    outline(base, outlineMat, 1.1);

    const glass = new MeshBasicMaterial({ color: GLASS_OFF.clone() });
    const bulb = new Mesh(glassGeo, glass);
    bulb.scale.set(1, 1.12, 1);
    bulb.position.y = top + 0.4;
    outline(bulb, outlineMat, 1.08);

    // Four thin frame bars around the glass give it a lantern silhouette even when dark.
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const bar = new Mesh(barGeo, metal);
      bar.position.set(Math.cos(a) * 0.3, top + 0.4, Math.sin(a) * 0.3);
      root.add(bar);
    }
    const cap = new Mesh(capGeo, metal);
    cap.position.y = top + 0.86;
    outline(cap, outlineMat, 1.1);
    const knob = new Mesh(knobGeo, metal);
    knob.position.y = top + 1.04;
    const ring = new Mesh(ringGeo, metal);
    ring.position.y = top + 1.15;

    const halo = new SpriteMaterial({ map: glow, color: GO_HALO.clone(), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
    const haloSprite = new Sprite(halo);
    haloSprite.position.set(0, top + 0.4, 0.1);
    haloSprite.scale.setScalar(2.3);

    root.add(foot, post, base, bulb, cap, knob, ring, haloSprite);
    return { root, glass, halo, haloSprite, centre: { x, y: top + 0.4, z: LANTERN_Z } };
  });
}

export interface Firefly {
  root: Group;
  wings: Mesh[];
  glowMat: SpriteMaterial;
  bodyMats: MeshBasicMaterial[];
}

/** Go: a small round firefly with a big glowing tail, cream face and tiny wings. */
export function buildFirefly(outlineMat: MeshBasicMaterial, glow: CanvasTexture): Firefly {
  const root = new Group();
  const tailMat = new MeshBasicMaterial({ color: 0xc8ff5a, transparent: true });
  const tail = new Mesh(new SphereGeometry(0.15, 18, 12), tailMat);
  tail.position.set(0, -0.05, 0);
  outline(tail, outlineMat, 1.12);
  const headMat = new MeshBasicMaterial({ color: 0x3a2a6e, transparent: true });
  const head = new Mesh(new SphereGeometry(0.095, 14, 10), headMat);
  head.position.set(0, 0.13, 0.02);
  const eyeMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true });
  const eyeGeo = new SphereGeometry(0.028, 8, 6);
  for (const s of [-1, 1]) {
    const e = new Mesh(eyeGeo, eyeMat);
    e.position.set(s * 0.04, 0.15, 0.1);
    root.add(e);
  }
  const wingMat = new MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.75, side: DoubleSide, depthWrite: false });
  const wingGeo = new SphereGeometry(0.11, 12, 8);
  const wings: Mesh[] = [];
  for (const s of [-1, 1]) {
    const w = new Mesh(wingGeo, wingMat);
    w.scale.set(1, 0.45, 0.12);
    w.position.set(s * 0.13, 0.16, -0.04);
    w.rotation.z = s * 0.5;
    wings.push(w);
    root.add(w);
  }
  const glowMat = new SpriteMaterial({ map: glow, color: 0xd8ff7a, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false });
  const g = new Sprite(glowMat);
  g.position.set(0, -0.05, 0.02);
  g.scale.setScalar(0.6);
  root.add(tail, head, g);
  return { root, wings, glowMat, bodyMats: [tailMat, headMat, eyeMat, wingMat] };
}

export interface Moth {
  root: Group;
  wings: Group[];
  mats: (MeshBasicMaterial | MeshToonMaterial)[];
}

/** No-go: a moth with four wide wings (dusky violet with pale eye spots) and feathery antennae. */
export function buildMoth(grad: DataTexture, outlineMat: MeshBasicMaterial): Moth {
  const toon = (c: number) => new MeshToonMaterial({ color: new Color(c), gradientMap: grad, transparent: true });
  const wingMat = toon(0x5b4a86);
  const spotMat = toon(0xd9d2f2);
  const bodyMat = toon(0x3a2f58);
  const root = new Group();
  const body = new Mesh(new SphereGeometry(0.09, 12, 10), bodyMat);
  body.scale.set(1, 2.3, 1);
  outline(body, outlineMat, 1.12);
  root.add(body);
  const wingGeo = new SphereGeometry(1, 18, 10);
  const spotGeo = new SphereGeometry(1, 12, 8);
  const wings: Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new Group();
    pivot.position.x = s * 0.05;
    const upper = new Mesh(wingGeo, wingMat);
    upper.scale.set(0.34, 0.24, 0.03);
    upper.position.set(s * 0.3, 0.1, 0);
    upper.rotation.z = s * 0.35;
    outline(upper, outlineMat, 1.08);
    const lower = new Mesh(wingGeo, wingMat);
    lower.scale.set(0.22, 0.17, 0.03);
    lower.position.set(s * 0.2, -0.16, 0);
    lower.rotation.z = -s * 0.4;
    outline(lower, outlineMat, 1.1);
    const spot = new Mesh(spotGeo, spotMat);
    spot.scale.set(0.085, 0.085, 0.02);
    spot.position.set(s * 0.34, 0.11, 0.025);
    pivot.add(upper, lower, spot);
    wings.push(pivot);
    root.add(pivot);
  }
  const antMat = toon(0x3a2f58);
  const antGeo = new ConeGeometry(0.07, 0.22, 3);
  for (const s of [-1, 1]) {
    const a = new Mesh(antGeo, antMat);
    a.position.set(s * 0.07, 0.29, 0.02);
    a.rotation.z = -s * 0.5;
    a.scale.set(1, 1, 0.25);
    root.add(a);
  }
  return { root, wings, mats: [wingMat, spotMat, bodyMat, antMat] };
}
