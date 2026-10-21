// The night river valley: banks, river, rope bridge with lanterns, trees, rocks, flowers, sky details.
// Procedural and low-poly; repeated props are InstancedMesh so the whole world stays at a few dozen draw calls.
// Layout uses a fixed seed so every child sees the same scene.
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  type DataTexture,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  RepeatWrapping,
  type Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import { mulberry32 } from "./logic";
import { outline } from "./luma";

export const BANK_Y = 0.6;
export const WATER_Y = 0.22;
export const BRIDGE_HALF = 2.8;
export const BANK_EDGE = 2.5;
export const SIDE_X = 3.7;
export const RAIL_Z = 0.72;
const SAG = 0.2;
const POSTS_X = [-BRIDGE_HALF, -0.95, 0.95, BRIDGE_HALF];

export function deckY(x: number): number {
  const u = Math.min(1, Math.abs(x) / BRIDGE_HALF);
  return BANK_Y + 0.03 - SAG * (1 - u * u);
}

/** Height Luma stands at for a given x (bank or bridge deck). */
export function groundY(x: number): number {
  return Math.abs(x) > BRIDGE_HALF - 0.05 ? BANK_Y : deckY(x) + 0.05;
}

export function glowTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.22, "rgba(255,255,255,0.85)");
    r.addColorStop(0.5, "rgba(255,255,255,0.28)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(c);
}

function shadowTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(20,12,50,0.55)");
    r.addColorStop(0.6, "rgba(20,12,50,0.3)");
    r.addColorStop(1, "rgba(20,12,50,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(c);
}

function rippleTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    const base = g.createLinearGradient(0, 0, 256, 0);
    base.addColorStop(0, "#2f6fc0");
    base.addColorStop(0.5, "#3f8fdc");
    base.addColorStop(1, "#2f6fc0");
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    const rnd = mulberry32(99);
    g.strokeStyle = "rgba(190,230,255,0.28)";
    g.lineCap = "round";
    for (let k = 0; k < 26; k++) {
      const x = rnd() * 256;
      const y = rnd() * 256;
      const w = 18 + rnd() * 40;
      g.lineWidth = 2 + rnd() * 2.5;
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.quadraticCurveTo(x, y - 5, x + w / 2, y);
      g.stroke();
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1.5, 15);
  return t;
}

export interface Lanterns {
  glass: MeshBasicMaterial;
  halo: SpriteMaterial;
  reflection: MeshBasicMaterial;
  halos: Sprite[];
  light: PointLight;
}

export interface World {
  lanterns: Lanterns;
  water: CanvasTexture;
  shadow: Mesh;
  fireflies: Points;
  fireflyBase: Float32Array;
  glow: CanvasTexture;
}

export const LANTERN_OFF = new Color(0x3d3352);
export const LANTERN_ON = new Color(0xffe58a);

export interface WorldOptions {
  /** The decorative lily pads and lotus in the near river. Default true. Route Planner turns them off: its board
   * of pads sits there, and a decorative pad would read as one more pad to tap. */
  lilyPads?: boolean;
  /** false: the bridge posts carry no lamp (Lantern Watch puts its own lanterns on the deck). Default true. */
  postLamps?: boolean;
}

export function buildWorld(scene: Scene, grad: DataTexture, outlineMat: MeshBasicMaterial, opts: WorldOptions = {}): World {
  const postLamps = opts.postLamps ?? true;
  const rnd = mulberry32(2024);
  const toon = (c: number) => new MeshToonMaterial({ color: new Color(c), gradientMap: grad });
  const white = toon(0xffffff); // instanced meshes tint it per instance
  const dummy = new Object3D();
  const glow = glowTexture();

  // Banks: big boxes, grass on top and earth facing the river.
  const grass = toon(0x56c46e);
  const earth = toon(0x86573f);
  const bankGeo = new BoxGeometry(37.5, 1.8, 90);
  const left = new Mesh(bankGeo, [earth, earth, grass, earth, earth, earth]);
  left.position.set(-BANK_EDGE - 18.75, BANK_Y - 0.9, -1);
  const right = new Mesh(bankGeo, [earth, earth, grass, earth, earth, earth]);
  right.position.set(BANK_EDGE + 18.75, BANK_Y - 0.9, -1);
  scene.add(left, right);

  // River
  const water = rippleTexture();
  const river = new Mesh(new PlaneGeometry(BANK_EDGE * 2 + 0.4, 90), new MeshBasicMaterial({ map: water }));
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, WATER_Y, -1);
  scene.add(river);

  // Lily pads (static), in the near river, away from the bridge.
  const padMat = toon(0x3fae6a);
  const pads: [number, number, number][] = [
    [-1.4, 3.4, 0.42],
    [1.6, 4.6, 0.5],
    [-0.4, 6.4, 0.38],
    [1.1, 2.4, 0.3],
    [-1.9, 5.6, 0.34],
  ];
  const padGeo = new CylinderGeometry(1, 1, 0.04, 20, 1, false, 0.4, Math.PI * 2 - 0.8);
  for (const [x, z, r] of pads) {
    const p = new Mesh(padGeo, padMat);
    p.scale.set(r, 1, r);
    p.position.set(x, WATER_Y + 0.02, z);
    p.rotation.y = rnd() * 6; // drawn even when the pads are off, so the rest of the seeded layout is unchanged
    if (opts.lilyPads !== false) scene.add(p);
  }
  const lotus = new Mesh(new SphereGeometry(0.13, 12, 8), toon(0xff9cc4));
  lotus.scale.y = 0.7;
  lotus.position.set(1.6, WATER_Y + 0.1, 4.6);
  if (opts.lilyPads !== false) scene.add(lotus);

  // Stones along both bank edges.
  const stoneGeo = new DodecahedronGeometry(1, 1);
  const stones = new InstancedMesh(stoneGeo, white, 60);
  const stoneColors = [0x8d87bf, 0x7a74ad, 0x9b95c9];
  let si = 0;
  for (const s of [-1, 1]) {
    for (let z = -14; z < 9 && si < 60; z += 0.8 + rnd() * 0.5) {
      const r = (0.16 + rnd() * 0.14) * (z > 2 ? 0.75 : 1);
      dummy.position.set(s * (BANK_EDGE + 0.05 + rnd() * 0.12), BANK_Y - 0.1, z);
      dummy.scale.set(r * 1.3, r * 0.7, r);
      dummy.rotation.set(rnd(), rnd() * 6, rnd());
      dummy.updateMatrix();
      stones.setMatrixAt(si, dummy.matrix);
      stones.setColorAt(si, new Color(stoneColors[si % 3] as number));
      si++;
    }
  }
  stones.count = si;
  scene.add(stones);

  // Trees: round puffy ones and pines, on both banks, kept clear of the bridge and of Luma's spots.
  const canopy = new InstancedMesh(new IcosahedronGeometry(1, 2), white, 80);
  const trunks = new InstancedMesh(new CylinderGeometry(0.12, 0.2, 1, 7), toon(0x6b4232), 40);
  const cones = new InstancedMesh(new ConeGeometry(1, 1.4, 8), white, 60);
  const leafColors = [0x2f9e6e, 0x3cb37a, 0x5ac48a, 0x2b8f7a, 0x7fd67f];
  const pineColors = [0x23806e, 0x2d9478, 0x1f6f66];
  let ci = 0;
  let ti = 0;
  let pi = 0;
  const spots: [number, number][] = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 15; k++) {
      const front = k >= 12;
      const x = s * (front ? 7 + rnd() * 5 : 4.8 + rnd() * 9);
      const z = front ? 1.5 + rnd() * 4 : -2.6 - rnd() * 14;
      spots.push([x, z]);
    }
  }
  for (const [x, z] of spots) {
    const h = 1.1 + rnd() * 1.1;
    const pine = rnd() < 0.4;
    dummy.rotation.set(0, rnd() * 6, 0);
    dummy.position.set(x, BANK_Y + h / 2, z);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(ti++, dummy.matrix);
    if (pine) {
      for (let l = 0; l < 3; l++) {
        const r = 1.05 - l * 0.28;
        dummy.position.set(x, BANK_Y + h + 0.4 + l * 0.65, z);
        dummy.scale.set(r, r, r);
        dummy.updateMatrix();
        cones.setMatrixAt(pi, dummy.matrix);
        cones.setColorAt(pi, new Color(pineColors[pi % 3] as number));
        pi++;
      }
    } else {
      const n = 2 + Math.floor(rnd() * 2);
      for (let l = 0; l < n; l++) {
        const r = 0.75 + rnd() * 0.45;
        dummy.position.set(x + (rnd() - 0.5) * 0.9, BANK_Y + h + 0.5 + l * 0.35, z + (rnd() - 0.5) * 0.7);
        dummy.scale.set(r, r * 0.92, r);
        dummy.updateMatrix();
        canopy.setMatrixAt(ci, dummy.matrix);
        canopy.setColorAt(ci, new Color(leafColors[Math.floor(rnd() * leafColors.length)] as number));
        ci++;
      }
    }
  }
  canopy.count = ci;
  trunks.count = ti;
  cones.count = pi;
  scene.add(canopy, trunks, cones);

  // Grass blades on the bank tops.
  const blades = new InstancedMesh(new ConeGeometry(0.05, 0.34, 3).translate(0, 0.17, 0), white, 420);
  const bladeColors = [0x6fd27a, 0x4fb86a, 0x8fe08a];
  let bi = 0;
  while (bi < 420) {
    const s = rnd() < 0.5 ? -1 : 1;
    const x = s * (BANK_EDGE + 0.3 + rnd() * 10);
    const z = -12 + rnd() * 20;
    if (Math.abs(Math.abs(x) - SIDE_X) < 0.7 && Math.abs(z) < 0.8) continue; // keep Luma's spot clear
    dummy.position.set(x, BANK_Y, z);
    dummy.rotation.set((rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.4);
    const sc = 0.7 + rnd() * 0.8;
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    blades.setMatrixAt(bi, dummy.matrix);
    blades.setColorAt(bi, new Color(bladeColors[bi % 3] as number));
    bi++;
  }
  scene.add(blades);

  // Flowers and mushrooms near the front of each bank.
  const heads = new InstancedMesh(new SphereGeometry(1, 10, 8), white, 70);
  const stems = new InstancedMesh(new CylinderGeometry(0.015, 0.015, 1, 4).translate(0, 0.5, 0), toon(0x3c9a55), 70);
  const flowerColors = [0xff8fc0, 0xffe066, 0xb9a3ff, 0xffffff, 0x7fd0ff];
  let fi = 0;
  while (fi < 70) {
    const s = rnd() < 0.5 ? -1 : 1;
    const x = s * (BANK_EDGE + 0.5 + rnd() * 6);
    const z = -3 + rnd() * 9;
    if (Math.abs(Math.abs(x) - SIDE_X) < 0.8 && Math.abs(z) < 1) continue;
    const h = 0.18 + rnd() * 0.2;
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, BANK_Y, z);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    stems.setMatrixAt(fi, dummy.matrix);
    dummy.position.set(x, BANK_Y + h, z);
    dummy.scale.setScalar(0.07 + rnd() * 0.04);
    dummy.updateMatrix();
    heads.setMatrixAt(fi, dummy.matrix);
    heads.setColorAt(fi, new Color(flowerColors[fi % flowerColors.length] as number));
    fi++;
  }
  scene.add(heads, stems);

  const caps = new InstancedMesh(new SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), white, 14);
  const mStems = new InstancedMesh(new CylinderGeometry(0.6, 0.75, 1, 8).translate(0, 0.5, 0), toon(0xfff1d6), 14);
  const capColors = [0xff6f91, 0xff9a62, 0xd98cff];
  const shroomSpots: [number, number][] = [
    [-5.6, 1.2],
    [-5.3, 1.6],
    [-6.4, -1.4],
    [5.4, 1.4],
    [5.8, 1.1],
    [6.6, -1.8],
    [-4.6, 3.8],
    [4.7, 4.2],
    [4.9, 3.9],
    [-7.5, 2.6],
    [7.6, 2.8],
    [-4.4, -2.4],
    [4.3, -2.6],
    [-8.2, -0.5],
  ];
  shroomSpots.forEach(([x, z], k) => {
    const r = 0.13 + rnd() * 0.12;
    dummy.rotation.set(0, 0, (rnd() - 0.5) * 0.3);
    dummy.position.set(x, BANK_Y, z);
    dummy.scale.set(r * 0.45, r * 1.4, r * 0.45);
    dummy.updateMatrix();
    mStems.setMatrixAt(k, dummy.matrix);
    dummy.position.set(x, BANK_Y + r * 1.35, z);
    dummy.scale.set(r * 1.25, r, r * 1.25);
    dummy.updateMatrix();
    caps.setMatrixAt(k, dummy.matrix);
    caps.setColorAt(k, new Color(capColors[k % 3] as number));
  });
  scene.add(caps, mStems);

  // Distant hills, layered.
  const hillSpec: [number, number, number, number, number][] = [
    [-22, -40, 14, 7, 0x4a4796],
    [4, -46, 20, 8, 0x3d3c87],
    [26, -40, 15, 7.5, 0x4a4796],
    [-10, -32, 10, 4.2, 0x3b6f8f],
    [14, -30, 11, 4.6, 0x3b6f8f],
  ];
  const hillGeo = new SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const [x, z, r, h, c] of hillSpec) {
    const m = new Mesh(hillGeo, toon(c));
    m.scale.set(r, h, r * 0.6);
    m.position.set(x, BANK_Y - 0.2, z);
    scene.add(m);
  }

  // Moon and stars (static: nothing in the sky twinkles during the wait).
  const moon = new Mesh(new SphereGeometry(1.7, 24, 16), new MeshBasicMaterial({ color: 0xf7e9c6, fog: false }));
  moon.position.set(-17, 11, -60);
  const moonHalo = new Sprite(
    new SpriteMaterial({ map: glow, color: 0xffe9c2, transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false, fog: false }),
  );
  moonHalo.scale.setScalar(13);
  moonHalo.position.copy(moon.position);
  scene.add(moon, moonHalo);

  const starPos: number[] = [];
  for (let k = 0; k < 220; k++) {
    const a = rnd() * Math.PI * 2;
    const e = 0.12 + rnd() * 0.9;
    starPos.push(Math.cos(a) * 90 * Math.cos(e), 8 + Math.sin(e) * 70, -Math.abs(Math.sin(a)) * 90 - 20);
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute("position", new Float32BufferAttribute(starPos, 3));
  const stars = new Points(
    starGeo,
    new PointsMaterial({ color: 0xfff6e0, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }),
  );
  scene.add(stars);

  // Bridge: planks, posts, ropes, lanterns.
  const bridge = new Group();
  const wood = [0xb9824f, 0xa87245, 0xc8925a];
  // Planks are slightly wider than their spacing (0.35 vs 0.335) and only lightly
  // jittered, so neighbours overlap and no water shows between them. A darker
  // underlay board under each plank closes any remaining seam.
  const planks = new InstancedMesh(new BoxGeometry(0.35, 0.08, 1.36), white, 20);
  const under = new InstancedMesh(new BoxGeometry(0.4, 0.05, 1.3), toon(0x6e4628), 20);
  let pk = 0;
  for (let x = -BRIDGE_HALF + 0.17; x <= BRIDGE_HALF - 0.1 && pk < 20; x += 0.335) {
    const slope = (deckY(x + 0.01) - deckY(x - 0.01)) / 0.02;
    dummy.position.set(x, deckY(x) - 0.06, 0);
    dummy.rotation.set(0, 0, Math.atan(slope));
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    under.setMatrixAt(pk, dummy.matrix);
    dummy.position.set(x, deckY(x), (rnd() - 0.5) * 0.04);
    dummy.rotation.set((rnd() - 0.5) * 0.03, (rnd() - 0.5) * 0.02, Math.atan(slope));
    dummy.updateMatrix();
    planks.setMatrixAt(pk, dummy.matrix);
    planks.setColorAt(pk, new Color(wood[pk % 3] as number));
    pk++;
  }
  planks.count = pk;
  under.count = pk;
  bridge.add(under);
  bridge.add(planks);

  const postMat = toon(0x8a5a3a);
  const ropeMat = toon(0xd9b071);
  const capMat = toon(0x5a3d6b);
  const glass = new MeshBasicMaterial({ color: LANTERN_OFF.clone() });
  const halo = new SpriteMaterial({
    map: glow,
    color: 0xffc457,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const reflection = new MeshBasicMaterial({
    map: glow,
    color: 0xffc457,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const halos: Sprite[] = [];
  const glassGeo = new SphereGeometry(0.17, 18, 12);
  const capGeo = new ConeGeometry(0.22, 0.18, 6);
  const baseGeo = new CylinderGeometry(0.13, 0.15, 0.08, 6);
  const postGeo = new CylinderGeometry(0.075, 0.09, 1, 8);
  const reflGeo = new PlaneGeometry(1, 1);
  for (const z of [-RAIL_Z, RAIL_Z]) {
    for (const x of POSTS_X) {
      const end = Math.abs(x) >= BRIDGE_HALF;
      const bottom = end ? BANK_Y - 0.1 : WATER_Y - 0.3;
      const top = deckY(x) + 0.95;
      const post = new Mesh(postGeo, postMat);
      post.scale.y = top - bottom;
      post.position.set(x, (top + bottom) / 2, z);
      outline(post, outlineMat, 1.0).scale.set(1.35, 1.0, 1.35);
      bridge.add(post);
      const base = new Mesh(baseGeo, capMat);
      base.position.set(x, top + 0.02, z);
      if (!postLamps) {
        // Plain post: a small cap only, no glass and no halo.
        const knob = new Mesh(capGeo, capMat);
        knob.scale.set(0.6, 0.6, 0.6);
        knob.position.set(x, top + 0.1, z);
        outline(knob, outlineMat, 1.12);
        bridge.add(base, knob);
        continue;
      }
      const lamp = new Mesh(glassGeo, glass);
      lamp.position.set(x, top + 0.2, z);
      outline(lamp, outlineMat, 1.12);
      const cap = new Mesh(capGeo, capMat);
      cap.position.set(x, top + 0.42, z);
      outline(cap, outlineMat, 1.12);
      const h = new Sprite(halo);
      h.position.set(x, top + 0.2, z + 0.05);
      h.scale.setScalar(1.9);
      halos.push(h);
      bridge.add(base, lamp, cap, h);
      if (!end) {
        const r = new Mesh(reflGeo, reflection);
        r.rotation.x = -Math.PI / 2;
        r.scale.set(0.9, 2.4, 1);
        r.position.set(x, WATER_Y + 0.01, z + 1.4);
        bridge.add(r);
      }
    }
    // Hand rope through the post tops, sagging between posts, and a lower rope.
    for (const [lift, radius] of [
      [0.82, 0.04],
      [0.42, 0.028],
    ] as const) {
      const pts: Vector3[] = [];
      for (let k = 0; k <= 24; k++) {
        const x = -BRIDGE_HALF + (k / 24) * BRIDGE_HALF * 2;
        let between = 0;
        for (let p = 0; p < POSTS_X.length - 1; p++) {
          const a = POSTS_X[p] as number;
          const b = POSTS_X[p + 1] as number;
          if (x >= a && x <= b) between = Math.sin(((x - a) / (b - a)) * Math.PI);
        }
        pts.push(new Vector3(x, deckY(x) + lift - 0.1 * between, z));
      }
      bridge.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), 60, radius, 6, false), ropeMat));
    }
  }
  scene.add(bridge);

  const light = new PointLight(0xffc457, 0, 7, 2);
  light.position.set(0, 2.4, -0.6);
  scene.add(light);

  // Luma's blob shadow (cheap, no shadow maps).
  const shadow = new Mesh(
    new PlaneGeometry(1.1, 1.1),
    new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // Decorative fireflies: only shown outside the measured trial loop, kept away from the bridge.
  const ffCount = 34;
  const ffBase = new Float32Array(ffCount * 3);
  let fk = 0;
  while (fk < ffCount) {
    const x = (rnd() - 0.5) * 22;
    const z = -10 + rnd() * 13;
    if (Math.abs(x) < 4.6 && z > -4) continue;
    ffBase[fk * 3] = x;
    ffBase[fk * 3 + 1] = 1.4 + rnd() * 2.8;
    ffBase[fk * 3 + 2] = z;
    fk++;
  }
  const ffGeo = new BufferGeometry();
  ffGeo.setAttribute("position", new Float32BufferAttribute(Array.from(ffBase), 3));
  const fireflies = new Points(
    ffGeo,
    new PointsMaterial({
      map: glow,
      color: 0xd9ff8a,
      size: 0.38,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(fireflies);

  return { lanterns: { glass, halo, reflection, halos, light }, water, shadow, fireflies, fireflyBase: ffBase, glow };
}
