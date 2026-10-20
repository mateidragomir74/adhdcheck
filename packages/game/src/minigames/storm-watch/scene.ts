// Storm Watch in 3D (three.js). Browser only: imported lazily by mount.ts.
// High contrast, cartoon style, organic tree perches (no artificial rings), catch fly-away.

import {
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PointLight,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { isPrimaryPointer } from "../../pointer";
import { StormWatchAudio } from "./audio";
import { buildLuma, makeOutlineMaterial, type LumaRig } from "../bridge-wait/luma";
import { StormWatchRunner } from "./runner";
import { STRINGS } from "./strings";
import type { DistractorType, ScheduledTrial, StormWatchResult, TrialType } from "./types";
import { buildUi } from "./ui";

export interface SceneOptions {
  seed?: number;
  trialsPerBlock?: number;
  stimulusMs?: number;
  skipPractice?: boolean;
  onComplete?: (result: StormWatchResult) => void;
}

// 8 Organic perch locations in FRONT of tree foliage (Z: 0.45 to 0.55) so they are NEVER hidden or occluded
const NATURAL_TREE_PERCHES: [number, number, number][] = [
  [-2.0, 1.55, 0.45],  // 0: Far-left tree branch
  [-1.2, 2.05, 0.50],  // 1: Left high canopy branch
  [-0.4, 1.40, 0.55],  // 2: Left-center mid branch
  [ 0.1, 2.15, 0.50],  // 3: Center high canopy branch
  [ 0.7, 1.35, 0.55],  // 4: Right-center mid branch
  [ 1.3, 1.95, 0.50],  // 5: Right high branch
  [ 2.0, 1.45, 0.45],  // 6: Far-right tree branch
  [-1.0, 1.30, 0.55],  // 7: Mid-left branch (well above jars and Luma)
];

export function createStormWatchScene(parent: HTMLElement, opts: SceneOptions = {}) {
  let destroyed = false;
  let rafId = 0;

  const audio = new StormWatchAudio();
  const ui = buildUi(parent);

  // Setup Three.js scene
  const scene = new Scene();

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.45, 5.2);
  camera.lookAt(new Vector3(0, 1.2, 0));

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(parent.clientWidth || 800, parent.clientHeight || 600);
  ui.root.insertBefore(renderer.domElement, ui.root.firstChild);

  // Vibrant high-contrast lighting
  const hemiLight = new HemisphereLight(0xdbe6ff, 0x4a3b7a, 2.7);
  scene.add(hemiLight);

  const moonLight = new DirectionalLight(0xffffff, 2.4);
  moonLight.position.set(4, 9, 5);
  scene.add(moonLight);

  const ambientFill = new AmbientLight(0x7365a8, 1.2);
  scene.add(ambientFill);

  // Stimulus localized point light (lights up surrounding tree leaves when firefly/owl appears)
  const stimulusPointLight = new PointLight(0xffea00, 0, 9);
  scene.add(stimulusPointLight);

  // Forest ground (lush cartoon palette)
  const groundGeo = new CylinderGeometry(14, 14, 0.4, 32);
  const groundMat = new MeshLambertMaterial({ color: 0x324470 });
  const ground = new Mesh(groundGeo, groundMat);
  ground.position.y = -0.35;
  scene.add(ground);

  // Forest trees with lush cartoon branches
  const treeGroup = new Group();
  const trunkGeo = new CylinderGeometry(0.2, 0.3, 3.0, 8);
  const foliageGeo = new ConeGeometry(1.2, 2.7, 8);
  const trunkMat = new MeshLambertMaterial({ color: 0x4c3c6e });
  const foliageMat = new MeshLambertMaterial({ color: 0x3b4985 });

  // 7 distinct trees across the clearing
  const TREE_CONFIGS = [
    { x: -2.3, z: -1.0, scale: 1.1 },
    { x: -1.4, z: -1.4, scale: 1.2 },
    { x: -0.5, z: -1.7, scale: 1.0 },
    { x: 0.5, z: -1.6, scale: 1.15 },
    { x: 1.3, z: -1.2, scale: 1.05 },
    { x: 2.2, z: -1.1, scale: 1.2 },
    { x: 3.1, z: -1.5, scale: 1.1 },
  ];

  TREE_CONFIGS.forEach((cfg) => {
    const t = new Group();
    const trunk = new Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.4;
    const foliage = new Mesh(foliageGeo, foliageMat);
    foliage.position.y = 2.7;
    t.add(trunk, foliage);
    t.position.set(cfg.x, -0.2, cfg.z);
    t.scale.setScalar(cfg.scale);
    treeGroup.add(t);
  });
  scene.add(treeGroup);

  // Target stimulus group (moves to natural perches)
  const stimulusGroup = new Group();

  // High-contrast circular perch target plate (wooden rim & dark contrast disc & wooden branch log)
  const perchPlateGroup = new Group();

  // Deep dark night circular backing plate
  const discGeo = new CircleGeometry(0.50, 32);
  const discMat = new MeshBasicMaterial({ color: 0x140e24 });
  const plateDisc = new Mesh(discGeo, discMat);

  // Outer frame rim
  const rimGeo = new RingGeometry(0.50, 0.60, 32);
  const rimMat = new MeshBasicMaterial({ color: 0x3d271d });
  const plateRim = new Mesh(rimGeo, rimMat);

  // Dynamic accent ring (changes color: gold for firefly, ruby-red for cricket, amber for owl)
  const accentGeo = new RingGeometry(0.46, 0.49, 32);
  const accentMat = new MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.75 });
  const plateAccent = new Mesh(accentGeo, accentMat);

  // Dynamic outer pulse aura ring (changes color: gold / red / amber)
  const pulseGeo = new RingGeometry(0.60, 0.74, 32);
  const pulseMat = new MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.45 });
  const platePulse = new Mesh(pulseGeo, pulseMat);

  // Natural wooden branch log right beneath the creature
  const logGeo = new CylinderGeometry(0.08, 0.08, 0.95, 12);
  const logMat = new MeshBasicMaterial({ color: 0x5a3d28 });
  const plateLog = new Mesh(logGeo, logMat);
  plateLog.rotation.z = Math.PI / 2;
  plateLog.position.set(0, -0.38, 0.04);

  // Small moss clump on the branch
  const moss = new Mesh(new SphereGeometry(0.07, 8, 8), new MeshBasicMaterial({ color: 0x3d7a46 }));
  moss.position.set(0.24, -0.34, 0.10);
  moss.scale.set(1.4, 0.7, 1.0);

  perchPlateGroup.add(plateDisc, plateRim, plateAccent, platePulse, plateLog, moss);
  perchPlateGroup.position.set(0, 0, -0.06);
  perchPlateGroup.visible = false;
  stimulusGroup.add(perchPlateGroup);

  // 1. Golden Firefly (Go) - radiant, neon lime-yellow glowing fairy bug
  const fireflyGroup = new Group();

  // Emissive glowing abdomen core (pure lime-gold, no murky Lambert lighting)
  const fireflyCore = new Mesh(
    new SphereGeometry(0.24, 16, 16),
    new MeshBasicMaterial({ color: 0xeeff41 }),
  );
  fireflyCore.position.set(0, -0.06, 0.04);
  fireflyCore.scale.set(0.9, 1.15, 0.9);

  // Radiant outer glow halo
  const fireflyGlow = new Mesh(
    new SphereGeometry(0.52, 16, 16),
    new MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.55 }),
  );
  fireflyGlow.position.set(0, -0.06, 0.04);

  // Cute golden-yellow head
  const fireflyHead = new Mesh(
    new SphereGeometry(0.14, 14, 14),
    new MeshBasicMaterial({ color: 0xffd600 }),
  );
  fireflyHead.position.set(0, 0.16, 0.06);

  // Friendly black eyes with white sparkle catchlights
  const fEyeL = new Mesh(new SphereGeometry(0.038, 8, 8), new MeshBasicMaterial({ color: 0x140e2b }));
  fEyeL.position.set(-0.065, 0.18, 0.18);
  const fEyeR = fEyeL.clone();
  fEyeR.position.x = 0.065;
  const fSparkleL = new Mesh(new SphereGeometry(0.014, 6, 6), new MeshBasicMaterial({ color: 0xffffff }));
  fSparkleL.position.set(-0.055, 0.195, 0.21);
  const fSparkleR = fSparkleL.clone();
  fSparkleR.position.x = 0.075;

  // Fluttering fairy wings (translucent cyan-white crystal wings)
  const wingGeo = new SphereGeometry(0.18, 12, 12);
  const wingMat = new MeshBasicMaterial({ color: 0xe0f7fa, transparent: true, opacity: 0.82 });
  const fireflyWingL = new Mesh(wingGeo, wingMat);
  fireflyWingL.scale.set(0.35, 1.4, 0.1);
  fireflyWingL.position.set(-0.20, 0.10, 0.02);
  fireflyWingL.rotation.z = -0.35;
  const fireflyWingR = fireflyWingL.clone();
  fireflyWingR.position.x = 0.20;
  fireflyWingR.rotation.z = 0.35;

  // Antennae with glowing yellow bulbs on tips
  const antGeo = new CylinderGeometry(0.014, 0.014, 0.22, 6);
  const antMat = new MeshBasicMaterial({ color: 0xffd600 });
  const antL = new Mesh(antGeo, antMat);
  antL.rotation.z = -0.42;
  antL.position.set(-0.08, 0.31, 0.06);
  const antR = antL.clone();
  antR.rotation.z = 0.42;
  antR.position.x = 0.08;

  const antBulbGeo = new SphereGeometry(0.04, 8, 8);
  const antBulbMat = new MeshBasicMaterial({ color: 0xffff00 });
  const bulbL = new Mesh(antBulbGeo, antBulbMat);
  bulbL.position.set(-0.16, 0.40, 0.06);
  const bulbR = bulbL.clone();
  bulbR.position.x = 0.16;

  fireflyGroup.add(fireflyCore, fireflyGlow, fireflyHead, fEyeL, fEyeR, fSparkleL, fSparkleR, fireflyWingL, fireflyWingR, antL, antR, bulbL, bulbR);
  fireflyGroup.visible = false;
  stimulusGroup.add(fireflyGroup);

  // 2. Shadow Cricket (No-Go) - spiky obsidian-black insect with GLOWING RED DANGER EYES
  const cricketGroup = new Group();

  // Pure dark obsidian carapace (MeshBasicMaterial so no murky Lambert wash)
  const cricketMat = new MeshBasicMaterial({ color: 0x16131f });
  const cricketAccentMat = new MeshBasicMaterial({ color: 0xef4444 }); // Danger ruby accents

  // Segmented abdomen & thorax
  const cricketBody = new Mesh(new CylinderGeometry(0.09, 0.12, 0.44, 8), cricketMat);
  cricketBody.rotation.z = 0.35;
  cricketBody.position.set(0.04, 0.02, 0.04);

  // Red danger stripe across carapace
  const cStripe = new Mesh(new CylinderGeometry(0.095, 0.11, 0.06, 8), cricketAccentMat);
  cStripe.rotation.z = 0.35;
  cStripe.position.set(0.04, 0.08, 0.04);

  // Dark spiky head
  const cricketHead = new Mesh(new SphereGeometry(0.12, 8, 8), cricketMat);
  cricketHead.position.set(-0.18, 0.18, 0.05);

  // VIVID GLOWING RED DANGER EYES
  const redEyeMat = new MeshBasicMaterial({ color: 0xff0033 });
  const redEyeGlowMat = new MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.5 });
  const cEyeL = new Mesh(new SphereGeometry(0.05, 8, 8), redEyeMat);
  cEyeL.position.set(-0.24, 0.22, 0.13);
  const cEyeGlowL = new Mesh(new SphereGeometry(0.09, 8, 8), redEyeGlowMat);
  cEyeGlowL.position.copy(cEyeL.position);

  const cEyeR = new Mesh(new SphereGeometry(0.05, 8, 8), redEyeMat);
  cEyeR.position.set(-0.16, 0.25, 0.15);
  const cEyeGlowR = new Mesh(new SphereGeometry(0.09, 8, 8), redEyeGlowMat);
  cEyeGlowR.position.copy(cEyeR.position);

  // Long sweeping antennae with danger red tips
  const cAntGeo = new CylinderGeometry(0.012, 0.008, 0.42, 6);
  const cAntMat = new MeshBasicMaterial({ color: 0x221c30 });
  const cAntL = new Mesh(cAntGeo, cAntMat);
  cAntL.rotation.z = -0.55;
  cAntL.position.set(-0.28, 0.38, 0.08);
  const cAntTipL = new Mesh(new SphereGeometry(0.024, 6, 6), redEyeMat);
  cAntTipL.position.set(-0.46, 0.56, 0.08);

  const cAntR = cAntL.clone();
  cAntR.rotation.z = -0.22;
  cAntR.position.set(-0.24, 0.38, -0.02);
  const cAntTipR = new Mesh(new SphereGeometry(0.024, 6, 6), redEyeMat);
  cAntTipR.position.set(-0.32, 0.58, -0.02);

  // Prominent spiky bent hind jumping legs
  const legGeo = new CylinderGeometry(0.022, 0.016, 0.36, 6);
  const legMat = new MeshBasicMaterial({ color: 0x1f182c });
  const cLegL = new Mesh(legGeo, legMat);
  cLegL.position.set(0.18, -0.02, 0.15);
  cLegL.rotation.x = 0.7;
  cLegL.rotation.z = -0.7;
  const cLegR = cLegL.clone();
  cLegR.position.z = -0.15;
  cLegR.rotation.x = -0.7;

  cricketGroup.add(cricketBody, cStripe, cricketHead, cEyeL, cEyeGlowL, cEyeR, cEyeGlowR, cAntL, cAntTipL, cAntR, cAntTipR, cLegL, cLegR);
  cricketGroup.visible = false;
  stimulusGroup.add(cricketGroup);

  // 3. Night Owl (Go-Audio) - warm feathered cartoon chestnut owl with white chest and big golden eyes
  const owlGroup = new Group();

  // Warm chestnut-brown feathered body
  const owlBodyMat = new MeshBasicMaterial({ color: 0x8b4513 });
  const owlBody = new Mesh(new SphereGeometry(0.25, 16, 16), owlBodyMat);
  owlBody.scale.set(1.0, 1.15, 0.9);
  owlBody.position.set(0, -0.02, 0.04);

  // Soft cream/buff feathered chest patch
  const chestMat = new MeshBasicMaterial({ color: 0xfef3c7 });
  const owlChest = new Mesh(new SphereGeometry(0.18, 14, 14), chestMat);
  owlChest.position.set(0, -0.06, 0.14);
  owlChest.scale.set(0.85, 1.0, 0.5);

  // Cute brown feather chevrons on chest
  const speckMat = new MeshBasicMaterial({ color: 0x92400e });
  const speck1 = new Mesh(new ConeGeometry(0.02, 0.04, 3), speckMat);
  speck1.position.set(0, -0.02, 0.22);
  speck1.rotation.z = Math.PI;
  const speck2 = speck1.clone();
  speck2.position.set(-0.06, -0.08, 0.21);
  const speck3 = speck1.clone();
  speck3.position.set(0.06, -0.08, 0.21);

  // Heart-shaped pale cream facial disk
  const faceMat = new MeshBasicMaterial({ color: 0xfffbeb });
  const faceL = new Mesh(new SphereGeometry(0.12, 12, 12), faceMat);
  faceL.position.set(-0.075, 0.12, 0.14);
  faceL.scale.set(1.0, 0.9, 0.35);
  const faceR = faceL.clone();
  faceR.position.x = 0.075;

  // Feathery ear tufts (horns) on top of head
  const tuftMat = new MeshBasicMaterial({ color: 0x78350f });
  const tuftGeo = new ConeGeometry(0.065, 0.16, 4);
  const tuftL = new Mesh(tuftGeo, tuftMat);
  tuftL.position.set(-0.14, 0.30, 0.06);
  tuftL.rotation.z = 0.35;
  const tuftR = tuftL.clone();
  tuftR.position.x = 0.14;
  tuftR.rotation.z = -0.35;

  // Folded side wings
  const oWingMat = new MeshBasicMaterial({ color: 0x6e2c05 });
  const oWingGeo = new SphereGeometry(0.18, 10, 10);
  const oWingL = new Mesh(oWingGeo, oWingMat);
  oWingL.scale.set(0.4, 1.1, 0.6);
  oWingL.position.set(-0.24, -0.02, 0.05);
  oWingL.rotation.z = -0.25;
  const oWingR = oWingL.clone();
  oWingR.position.x = 0.24;
  oWingR.rotation.z = 0.25;

  // Big nocturnal owl eyes: amber rim + large glowing golden-yellow iris + black pupil + shiny catchlight!
  const eyeRimMat = new MeshBasicMaterial({ color: 0xd97706 });
  const oRimL = new Mesh(new SphereGeometry(0.082, 12, 12), eyeRimMat);
  oRimL.position.set(-0.08, 0.12, 0.18);
  const oRimR = oRimL.clone();
  oRimR.position.x = 0.08;

  const oIrisMat = new MeshBasicMaterial({ color: 0xffcc00 }); // Brilliant golden-yellow iris
  const oIrisL = new Mesh(new SphereGeometry(0.072, 12, 12), oIrisMat);
  oIrisL.position.set(-0.08, 0.12, 0.19);
  const oIrisR = oIrisL.clone();
  oIrisR.position.x = 0.08;

  const oPupilMat = new MeshBasicMaterial({ color: 0x0f0b1e }); // Large glossy nocturnal pupil
  const oPupilL = new Mesh(new SphereGeometry(0.042, 10, 10), oPupilMat);
  oPupilL.position.set(-0.08, 0.12, 0.23);
  const oPupilR = oPupilL.clone();
  oPupilR.position.x = 0.08;

  const oCatchMat = new MeshBasicMaterial({ color: 0xffffff }); // Catchlight
  const oCatchL = new Mesh(new SphereGeometry(0.016, 6, 6), oCatchMat);
  oCatchL.position.set(-0.065, 0.14, 0.26);
  const oCatchR = oCatchL.clone();
  oCatchR.position.x = 0.095;

  // Vibrant curved golden-orange beak
  const beakMat = new MeshBasicMaterial({ color: 0xf59e0b });
  const beak = new Mesh(new ConeGeometry(0.05, 0.14, 6), beakMat);
  beak.rotation.x = Math.PI * 0.65;
  beak.position.set(0, 0.04, 0.24);

  owlGroup.add(owlBody, owlChest, speck1, speck2, speck3, faceL, faceR, tuftL, tuftR, oWingL, oWingR, oRimL, oRimR, oIrisL, oIrisR, oPupilL, oPupilR, oCatchL, oCatchR, beak);
  owlGroup.visible = false;
  stimulusGroup.add(owlGroup);

  scene.add(stimulusGroup);

  // Luma Rig on bottom-left, standing beside the collection jars (no clipping!)
  const outlineMat = makeOutlineMaterial();
  const luma: LumaRig = buildLuma(null as any, outlineMat);
  luma.root.position.set(-1.65, -0.22, 0.65);
  luma.root.scale.setScalar(0.74);
  luma.root.rotation.y = 0.55;
  scene.add(luma.root);

  // Stump Pedestal 1: for Firefly Jar
  const stump1Group = new Group();
  const stump1Trunk = new Mesh(
    new CylinderGeometry(0.22, 0.26, 0.36, 16),
    new MeshLambertMaterial({ color: 0x5a3d28 }),
  );
  const stump1Top = new Mesh(
    new CylinderGeometry(0.222, 0.222, 0.02, 16),
    new MeshLambertMaterial({ color: 0x825938 }),
  );
  stump1Top.position.y = 0.18;
  const mossMat = new MeshLambertMaterial({ color: 0x3d7a46 });
  const moss1 = new Mesh(new SphereGeometry(0.06, 8, 8), mossMat);
  moss1.position.set(0.16, 0.08, 0.12);
  moss1.scale.set(1.2, 0.7, 0.9);
  stump1Group.add(stump1Trunk, stump1Top, moss1);
  stump1Group.position.set(-0.98, -0.16, 0.95);
  scene.add(stump1Group);

  // Jar 1: Firefly Jar (Golden)
  const fireflyJarGroup = new Group();
  const fJarBase = new Mesh(
    new CylinderGeometry(0.18, 0.18, 0.03, 16),
    new MeshLambertMaterial({ color: 0xb45309 }),
  );
  fJarBase.position.y = -0.22;
  const fJarGlass = new Mesh(
    new CylinderGeometry(0.15, 0.17, 0.44, 16),
    new MeshBasicMaterial({ color: 0xbbf2f6, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  const fJarLid = new Mesh(
    new CylinderGeometry(0.16, 0.16, 0.06, 16),
    new MeshLambertMaterial({ color: 0xd97706 }),
  );
  fJarLid.position.y = 0.23;
  const fireflyJarLight = new PointLight(0xffea00, 0.9, 3.0);
  fireflyJarLight.position.y = 0;
  const fireflyMotesGroup = new Group();
  fireflyJarGroup.add(fJarBase, fJarGlass, fJarLid, fireflyJarLight, fireflyMotesGroup);
  fireflyJarGroup.position.set(-0.98, 0.24, 0.95);
  scene.add(fireflyJarGroup);

  // Stump Pedestal 2: for Owl Jar
  const stump2Group = new Group();
  const stump2Trunk = new Mesh(
    new CylinderGeometry(0.22, 0.26, 0.36, 16),
    new MeshLambertMaterial({ color: 0x5a3d28 }),
  );
  const stump2Top = new Mesh(
    new CylinderGeometry(0.222, 0.222, 0.02, 16),
    new MeshLambertMaterial({ color: 0x825938 }),
  );
  stump2Top.position.y = 0.18;
  const moss2 = new Mesh(new SphereGeometry(0.06, 8, 8), mossMat);
  moss2.position.set(-0.14, -0.04, 0.14);
  moss2.scale.set(1.1, 0.6, 1.0);
  stump2Group.add(stump2Trunk, stump2Top, moss2);
  stump2Group.position.set(-0.42, -0.16, 1.05);
  scene.add(stump2Group);

  // Jar 2: Owl Roost Jar (Amber)
  const owlJarGroup = new Group();
  const oJarBase = new Mesh(
    new CylinderGeometry(0.18, 0.18, 0.03, 16),
    new MeshLambertMaterial({ color: 0x92400e }),
  );
  oJarBase.position.y = -0.22;
  const oJarGlass = new Mesh(
    new CylinderGeometry(0.15, 0.17, 0.44, 16),
    new MeshBasicMaterial({ color: 0xffedd5, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  const oJarLid = new Mesh(
    new CylinderGeometry(0.16, 0.16, 0.06, 16),
    new MeshLambertMaterial({ color: 0xb45309 }),
  );
  oJarLid.position.y = 0.23;
  const owlJarLight = new PointLight(0xff7700, 0.9, 3.0);
  owlJarLight.position.y = 0;
  const owlMotesGroup = new Group();
  owlJarGroup.add(oJarBase, oJarGlass, oJarLid, owlJarLight, owlMotesGroup);
  owlJarGroup.position.set(-0.42, 0.24, 1.05);
  scene.add(owlJarGroup);

  // Collections state: countable items in both jars
  interface CaughtMote {
    mesh: Group;
    baseX: number;
    baseY: number;
    baseZ: number;
    phase: number;
  }
  const caughtFireflies: CaughtMote[] = [];
  const caughtOwls: CaughtMote[] = [];

  function addCaughtFirefly() {
    const mote = new Group();
    const core = new Mesh(
      new SphereGeometry(0.038, 12, 12),
      new MeshBasicMaterial({ color: 0xfffa40 }),
    );
    const glow = new Mesh(
      new SphereGeometry(0.072, 12, 12),
      new MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    const wingL = new Mesh(
      new SphereGeometry(0.02, 6, 6),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
    );
    wingL.scale.set(0.35, 1.3, 0.2);
    wingL.position.set(-0.03, 0.02, 0);
    const wingR = wingL.clone();
    wingR.position.x = 0.03;
    mote.add(core, glow, wingL, wingR);

    const idx = caughtFireflies.length;
    const phi = idx * 2.39996;
    const r = 0.025 + ((idx * 0.028) % 0.08);
    const y = -0.14 + (((idx * 0.045) + 0.02) % 0.28);
    const x = Math.cos(phi) * r;
    const z = Math.sin(phi) * r;
    mote.position.set(x, y, z);
    fireflyMotesGroup.add(mote);

    caughtFireflies.push({
      mesh: mote,
      baseX: x,
      baseY: y,
      baseZ: z,
      phase: Math.random() * Math.PI * 2,
    });

    fireflyJarLight.intensity = Math.min(0.9 + caughtFireflies.length * 0.12, 4.0);
    ui.setJarCounts(caughtFireflies.length, caughtOwls.length);
  }

  function addCaughtOwl() {
    const mote = new Group();
    const core = new Mesh(
      new SphereGeometry(0.042, 12, 12),
      new MeshBasicMaterial({ color: 0xff9900 }),
    );
    const glow = new Mesh(
      new SphereGeometry(0.076, 12, 12),
      new MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    // Two bright owl eyes
    const eyeMat = new MeshBasicMaterial({ color: 0xffffff });
    const pupMat = new MeshBasicMaterial({ color: 0x140e2b });
    const eyeL = new Mesh(new SphereGeometry(0.014, 6, 6), eyeMat);
    eyeL.position.set(-0.014, 0.01, 0.032);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.014;
    const pL = new Mesh(new SphereGeometry(0.007, 6, 6), pupMat);
    pL.position.set(-0.014, 0.01, 0.042);
    const pR = pL.clone();
    pR.position.x = 0.014;
    mote.add(core, glow, eyeL, eyeR, pL, pR);

    const idx = caughtOwls.length;
    const phi = idx * 2.39996;
    const r = 0.025 + ((idx * 0.028) % 0.08);
    const y = -0.14 + (((idx * 0.045) + 0.02) % 0.28);
    const x = Math.cos(phi) * r;
    const z = Math.sin(phi) * r;
    mote.position.set(x, y, z);
    owlMotesGroup.add(mote);

    caughtOwls.push({
      mesh: mote,
      baseX: x,
      baseY: y,
      baseZ: z,
      phase: Math.random() * Math.PI * 2,
    });

    owlJarLight.intensity = Math.min(0.9 + caughtOwls.length * 0.12, 4.0);
    ui.setJarCounts(caughtFireflies.length, caughtOwls.length);
  }

  // Independent Flying Projectiles: guarantees 100% of caught items reach the jars
  interface FlyingProjectile {
    mesh: Group;
    startPos: Vector3;
    targetPos: Vector3;
    progress: number;
    kind: "firefly" | "owl";
  }
  const activeProjectiles: FlyingProjectile[] = [];
  const fireflyJarTarget = new Vector3(-0.98, 0.36, 0.95);
  const owlJarTarget = new Vector3(-0.42, 0.36, 1.05);

  // Cartoon Birds for Block B distractor
  interface ActiveBird {
    mesh: Group;
    speedX: number;
    baseY: number;
    flapPhase: number;
    flapSpeed: number;
    wingL: Mesh;
    wingR: Mesh;
  }
  const birds: ActiveBird[] = [];
  const BIRD_COLORS = [0xff3366, 0x0284c7, 0xfacc15, 0x10b981, 0xa855f7, 0xf97316];

  function spawnBirdFlock(count: number = 3 + Math.floor(Math.random() * 3)) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const baseHeight = 1.2 + Math.random() * 1.4;
    const baseSpeed = 4.4 + Math.random() * 1.6;

    for (let k = 0; k < count; k++) {
      const birdGroup = new Group();
      const color = BIRD_COLORS[(k + Math.floor(Math.random() * BIRD_COLORS.length)) % BIRD_COLORS.length]!;
      const birdMat = new MeshLambertMaterial({ color });

      const body = new Mesh(new SphereGeometry(0.16, 8, 8), birdMat);
      body.scale.set(1.5, 0.9, 0.9);

      const beak = new Mesh(new ConeGeometry(0.06, 0.14, 6), new MeshLambertMaterial({ color: 0xffb700 }));
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.24, 0, 0);

      const eyeMat = new MeshBasicMaterial({ color: 0xffffff });
      const pupilMat = new MeshBasicMaterial({ color: 0x18113c });
      const eye = new Mesh(new SphereGeometry(0.045, 6, 6), eyeMat);
      eye.position.set(0.12, 0.08, 0.11);
      const pupil = new Mesh(new SphereGeometry(0.022, 6, 6), pupilMat);
      pupil.position.set(0.14, 0.08, 0.13);
      birdGroup.add(eye, pupil);

      const wingGeo = new BoxGeometry(0.32, 0.02, 0.22);
      const wingL = new Mesh(wingGeo, birdMat);
      wingL.position.set(0, 0.06, 0.16);
      const wingR = new Mesh(wingGeo, birdMat);
      wingR.position.set(0, 0.06, -0.16);

      birdGroup.add(body, beak, wingL, wingR);

      // Stagger birds in flock formation across the screen
      const startX = (dir > 0 ? -5.6 : 5.6) - dir * (k * 0.85 + Math.random() * 0.4);
      const startY = baseHeight + (k - (count - 1) / 2) * 0.28 + (Math.random() * 0.2 - 0.1);
      const startZ = 1.0 + Math.random() * 1.8;

      birdGroup.position.set(startX, startY, startZ);
      if (dir < 0) birdGroup.rotation.y = Math.PI;

      scene.add(birdGroup);
      birds.push({
        mesh: birdGroup,
        speedX: dir * (baseSpeed + (Math.random() * 0.8 - 0.4)),
        baseY: startY,
        flapPhase: Math.random() * Math.PI * 2,
        flapSpeed: 0.032 + Math.random() * 0.012,
        wingL,
        wingR,
      });
    }
  }

  // Screen shake on wrong cricket tap and thunder strikes
  let shakeTime = 0;
  let lightningIntensity = 0;

  // Persistent Storm Director: flocks of birds and lightning strikes throughout the entire game
  let nextBirdFlockTime = 2200;
  let nextLightningTime = 4800;

  function triggerLightningAndThunder() {
    audio.thunder();
    ui.flashLightning();
    lightningIntensity = 1.0;
    moonLight.intensity = 12.0;
    ambientFill.intensity = 5.0;
    hemiLight.intensity = 5.5;
    shakeTime = 0.55;
  }

  // Runner state machine
  let activeStimulusType: TrialType | null = null;
  let currentPerchIdx = 0;

  const runner = new StormWatchRunner(
    {
      onStateChange(st) {
        if (destroyed) return;
        switch (st) {
          case "intro":
            ui.setRain(true);
            ui.say(STRINGS.readyQuestion, STRINGS.readySubtext);
            ui.showIntro(true, () => {
              audio.unlock();
              audio.startRain();
              ui.setRain(true);
              audio.babble(1200);
              runner.start();
            });
            ui.showHand(false);
            break;
          case "practice-intro":
            ui.showIntro(false);
            ui.setRain(true);
            audio.babble(1200);
            ui.say(STRINGS.practiceIntro, STRINGS.practiceIntroSub);
            ui.showHand(false);
            break;
          case "practice-trial-stimulus": {
            const cur = runner.getCurrentTrial();
            if (cur) {
              if (cur.type === "go") {
                ui.say(STRINGS.practiceGo1, STRINGS.goldenFireflyTip);
                audio.babble(800);
                audio.fireflyChirp();
                ui.showHand(true, window.innerWidth * 0.5, window.innerHeight * 0.45);
              } else if (cur.type === "nogo") {
                ui.say(STRINGS.practiceNogo, STRINGS.shadowCricketTip);
                audio.babble(800);
                audio.cricketChirp();
                ui.showHand(false);
              } else if (cur.type === "go_audio") {
                ui.say(STRINGS.practiceAudio, STRINGS.owlTip);
                audio.babble(800);
                audio.owlHoot();
                ui.showHand(true, window.innerWidth * 0.5, window.innerHeight * 0.45);
              }
            }
            break;
          }
          case "practice-trial-feedback": {
            const lastOutcome = runner.getLastPracticeOutcome();
            if (lastOutcome === "hit") {
              ui.say(STRINGS.feedbackHit);
            } else if (lastOutcome === "correct_reject") {
              ui.say(STRINGS.feedbackNogoSuccess);
            } else if (lastOutcome === "commission") {
              ui.say(STRINGS.feedbackNogoFail);
            } else if (lastOutcome === "omission") {
              ui.say(STRINGS.feedbackOmission);
            } else {
              ui.say(null);
            }
            ui.showHand(false);
            break;
          }
          case "between":
            audio.babble(1000);
            ui.say(STRINGS.betweenBlocks);
            break;
          case "block-intro": {
            const cur = runner.getCurrentTrial();
            ui.showIntro(false);
            ui.showHand(false);
            if (cur?.blockKind === "storm") {
              ui.say(STRINGS.stormBlockIntro);
            } else {
              ui.say(STRINGS.calmBlockIntro);
            }
            audio.startRain();
            ui.setRain(true);
            audio.babble(1400);
            break;
          }
          case "trial-isi":
            ui.say(null);
            break;
          case "trial-stimulus":
            break;
          case "celebration":
            audio.stopRain();
            audio.catchSuccess();
            ui.showCelebration(true, STRINGS.celebration);
            break;
        }
      },
      onStimulusOnset(trial) {
        if (destroyed) return;
        activeStimulusType = trial.type;
        currentPerchIdx = (trial.treeLocation ?? 0) % NATURAL_TREE_PERCHES.length;
        const pos = NATURAL_TREE_PERCHES[currentPerchIdx]!;

        // Place stimulus at natural tree perch
        stimulusGroup.position.set(pos[0], pos[1], pos[2]);
        stimulusGroup.scale.set(1, 1, 1);

        perchPlateGroup.visible = true;
        fireflyGroup.visible = trial.type === "go";
        cricketGroup.visible = trial.type === "nogo";
        owlGroup.visible = trial.type === "go_audio";

        if (trial.type === "go") {
          (platePulse.material as MeshBasicMaterial).color.setHex(0xffea00);
          (plateAccent.material as MeshBasicMaterial).color.setHex(0xffcc00);
          stimulusPointLight.color.setHex(0xffea00);
          stimulusPointLight.position.set(pos[0], pos[1] + 0.1, pos[2] + 0.2);
          stimulusPointLight.intensity = 5.5;
        } else if (trial.type === "nogo") {
          (platePulse.material as MeshBasicMaterial).color.setHex(0xff0033);
          (plateAccent.material as MeshBasicMaterial).color.setHex(0xff1744);
          stimulusPointLight.intensity = 0; // Crickets do not emit light
        } else if (trial.type === "go_audio") {
          (platePulse.material as MeshBasicMaterial).color.setHex(0xff9900);
          (plateAccent.material as MeshBasicMaterial).color.setHex(0xffaa00);
          stimulusPointLight.color.setHex(0xff9900);
          stimulusPointLight.position.set(pos[0], pos[1] + 0.1, pos[2] + 0.2);
          stimulusPointLight.intensity = 4.5;
          audio.owlHoot();
        }
      },
      onStimulusEnd() {
        if (destroyed) return;
        activeStimulusType = null;
        perchPlateGroup.visible = false;
        fireflyGroup.visible = false;
        cricketGroup.visible = false;
        owlGroup.visible = false;
        stimulusPointLight.intensity = 0;
      },
      onDistractorTrigger(trial) {
        if (destroyed) return;
        const dType: DistractorType = trial.distractorType ?? "bird";
        if (dType === "bird" || dType === "both") {
          spawnBirdFlock();
        }
        if (dType === "thunder" || dType === "both") {
          triggerLightningAndThunder();
        }
      },
      onHit() {
        if (destroyed) return;
        audio.catchSuccess();

        const isOwl = activeStimulusType === "go_audio";
        const kind: "firefly" | "owl" = isOwl ? "owl" : "firefly";

        // Spawn independent flying projectile
        const proj = new Group();
        if (kind === "firefly") {
          const core = new Mesh(new SphereGeometry(0.18, 12, 12), new MeshBasicMaterial({ color: 0xeeff41 }));
          const glow = new Mesh(new SphereGeometry(0.36, 12, 12), new MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.6 }));
          proj.add(core, glow);
        } else {
          const body = new Mesh(new SphereGeometry(0.20, 12, 12), new MeshBasicMaterial({ color: 0x8b4513 }));
          const chest = new Mesh(new SphereGeometry(0.12, 10, 10), new MeshBasicMaterial({ color: 0xfef3c7 }));
          chest.position.set(0, -0.04, 0.10);
          const eyeL = new Mesh(new SphereGeometry(0.045, 8, 8), new MeshBasicMaterial({ color: 0xffcc00 }));
          eyeL.position.set(-0.06, 0.06, 0.14);
          const eyeR = eyeL.clone();
          eyeR.position.x = 0.06;
          const glow = new Mesh(new SphereGeometry(0.38, 12, 12), new MeshBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.5 }));
          proj.add(body, chest, eyeL, eyeR, glow);
        }
        proj.position.copy(stimulusGroup.position);
        scene.add(proj);

        activeProjectiles.push({
          mesh: proj,
          startPos: stimulusGroup.position.clone(),
          targetPos: isOwl ? owlJarTarget : fireflyJarTarget,
          progress: 0,
          kind,
        });

        // Hide branch stimulus immediately so it cannot be double-tapped
        perchPlateGroup.visible = false;
        fireflyGroup.visible = false;
        owlGroup.visible = false;
        stimulusPointLight.intensity = 0;
      },
      onCommission() {
        if (destroyed) return;
        // Tapped shadow cricket: clearly audible cartoon bonk sound!
        audio.wrongTap();

        // Subtle camera shake
        shakeTime = 0.2;

        // Cricket shrinks and darts away immediately
        cricketGroup.scale.set(0.4, 0.4, 0.4);
        perchPlateGroup.visible = false;
        setTimeout(() => {
          cricketGroup.visible = false;
        }, 70);
      },
      onTapFeedback() {
        if (destroyed) return;
        audio.tap();
      },
      onComplete(res) {
        if (destroyed) return;
        opts.onComplete?.(res);
      },
    },
    {
      seed: opts.seed,
      trialsPerBlock: opts.trialsPerBlock,
      stimulusMs: opts.stimulusMs,
      skipPractice: opts.skipPractice,
    },
  );

  function getStimulusScreenPos(): { x: number; y: number; radiusPx: number } | null {
    if (activeStimulusType === null) return null;
    const p = stimulusGroup.position.clone().project(camera);
    if (p.z > 1) return null;

    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    const screenX = ((p.x + 1) / 2) * w;
    const screenY = ((-p.y + 1) / 2) * h;

    const edgeP = stimulusGroup.position.clone().add(new Vector3(0.56, 0, 0)).project(camera);
    const edgeScreenX = ((edgeP.x + 1) / 2) * w;
    const baseRadius = Math.abs(edgeScreenX - screenX);
    const radiusPx = Math.max(65, baseRadius * 1.4);

    return { x: screenX, y: screenY, radiusPx };
  }

  // Explicitly initialize intro modal and start callback on mount
  ui.setRain(true);
  ui.say(STRINGS.readyQuestion, STRINGS.readySubtext);
  ui.showIntro(true, () => {
    audio.unlock();
    audio.startRain();
    ui.setRain(true);
    audio.babble(1200);
    runner.start();
  });

  function onPointerDown(e: PointerEvent) {
    if (!isPrimaryPointer(e)) return;
    audio.unlock();
    audio.startRain();
    const rect = ui.root.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let isHitOnStimulus = false;
    const stimPos = getStimulusScreenPos();
    if (stimPos) {
      const dist = Math.hypot(x - stimPos.x, y - stimPos.y);
      if (dist <= stimPos.radiusPx) {
        isHitOnStimulus = true;
      }
    }

    runner.pointerDown(e.timeStamp, x, y, isHitOnStimulus);
  }

  ui.root.addEventListener("pointerdown", onPointerDown);

  function onResize() {
    if (destroyed) return;
    const w = parent.clientWidth || 800;
    const h = parent.clientHeight || 600;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  const ro = new ResizeObserver(() => onResize());
  ro.observe(parent);
  onResize();

  // Animation loop
  let lastT = performance.now();
  function loop(now: number) {
    if (destroyed) return;
    rafId = requestAnimationFrame(loop);

    const dt = Math.min((now - lastT) / 1000, 0.1);
    lastT = now;

    // Advance runner BEFORE render
    runner.frame(now);

    // Camera shake on error
    if (shakeTime > 0) {
      shakeTime -= dt;
      camera.position.x = (Math.random() - 0.5) * 0.12;
      camera.position.y = 1.45 + (Math.random() - 0.5) * 0.08;
    } else {
      camera.position.x = 0;
      camera.position.y = 1.45;
    }

    // Luma breathing & wing flutter
    const idleTime = now * 0.003;
    luma.squash.scale.y = 1 + Math.sin(idleTime * 2) * 0.035;
    luma.squash.scale.x = 1 - Math.sin(idleTime * 2) * 0.018;
    luma.wings.forEach((w, idx) => {
      w.rotation.y = (idx === 0 ? 1 : -1) * (0.35 + Math.sin(now * 0.02) * 0.45);
    });

    // Animate caught fireflies inside Firefly Jar (countable!)
    for (let i = 0; i < caughtFireflies.length; i++) {
      const m = caughtFireflies[i]!;
      m.mesh.position.y = m.baseY + Math.sin(now * 0.0035 + m.phase) * 0.015;
      m.mesh.position.x = m.baseX + Math.cos(now * 0.0025 + m.phase) * 0.012;
      const pulse = 1 + Math.sin(now * 0.006 + m.phase) * 0.12;
      m.mesh.scale.set(pulse, pulse, pulse);
    }

    // Animate caught owls inside Owl Jar (countable!)
    for (let i = 0; i < caughtOwls.length; i++) {
      const m = caughtOwls[i]!;
      m.mesh.position.y = m.baseY + Math.sin(now * 0.003 + m.phase) * 0.014;
      m.mesh.position.x = m.baseX + Math.cos(now * 0.002 + m.phase) * 0.010;
      const pulse = 1 + Math.sin(now * 0.005 + m.phase) * 0.10;
      m.mesh.scale.set(pulse, pulse, pulse);
    }

    // Animate independent flying projectiles into their respective jars
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
      const p = activeProjectiles[i]!;
      p.progress += dt * 3.8;
      const t = Math.min(p.progress, 1);
      p.mesh.position.lerpVectors(p.startPos, p.targetPos, t);
      p.mesh.position.y += Math.sin(t * Math.PI) * 0.55;
      const scale = Math.max(0.12, 1 - t * 0.75);
      p.mesh.scale.set(scale, scale, scale);

      if (t >= 1) {
        scene.remove(p.mesh);
        activeProjectiles.splice(i, 1);
        if (p.kind === "firefly") {
          addCaughtFirefly();
        } else {
          addCaughtOwl();
        }
      }
    }

    // Subtle breathing pulse for target perch circle plate
    if (perchPlateGroup.visible) {
      const plateBreath = 1 + Math.sin(now * 0.012) * 0.08;
      platePulse.scale.set(plateBreath, plateBreath, 1);
    }
    // Idle flutter while waiting on branch
    if (activeStimulusType === "go") {
      const pulse = 1 + Math.sin(now * 0.018) * 0.15;
      fireflyGroup.scale.set(pulse, pulse, pulse);
      fireflyWingL.rotation.z = Math.sin(now * 0.045) * 0.6;
      fireflyWingR.rotation.z = -Math.sin(now * 0.045) * 0.6;
    } else if (activeStimulusType === "nogo") {
      cAntL.rotation.z = -0.55 + Math.sin(now * 0.035) * 0.22;
      cAntR.rotation.z = -0.22 + Math.cos(now * 0.035) * 0.22;
    } else if (activeStimulusType === "go_audio") {
      const pulse = 1 + Math.sin(now * 0.014) * 0.08;
      owlGroup.scale.set(pulse, pulse, pulse);
      tuftL.rotation.z = 0.35 + Math.sin(now * 0.012) * 0.12;
      tuftR.rotation.z = -0.35 - Math.sin(now * 0.012) * 0.12;
    }

    // Lightning light surge decay back to standard night-forest ambient
    if (lightningIntensity > 0) {
      lightningIntensity = Math.max(0, lightningIntensity - dt * 2.8);
      moonLight.intensity = 2.4 + lightningIntensity * 9.6;
      ambientFill.intensity = 1.2 + lightningIntensity * 3.8;
      hemiLight.intensity = 2.7 + lightningIntensity * 2.8;
    }

    // Atmospheric Storm Director: flocks of birds and lightning throughout the entire gameplay!
    if (!destroyed && runner.state !== "celebration" && runner.state !== "done") {
      if (now >= nextBirdFlockTime) {
        spawnBirdFlock(3 + Math.floor(Math.random() * 3));
        nextBirdFlockTime = now + 4000 + Math.random() * 3500;
      }

      if (now >= nextLightningTime) {
        triggerLightningAndThunder();
        nextLightningTime = now + 6000 + Math.random() * 4500;
      }
    }

    // Animate & update bird flocks
    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i]!;
      b.mesh.position.x += b.speedX * dt;
      b.mesh.position.y = b.baseY + Math.sin(now * 0.008 + b.flapPhase) * 0.16;
      b.wingL.rotation.z = Math.sin(now * b.flapSpeed + b.flapPhase) * 0.85;
      b.wingR.rotation.z = -Math.sin(now * b.flapSpeed + b.flapPhase) * 0.85;

      if (Math.abs(b.mesh.position.x) > 8.0) {
        scene.remove(b.mesh);
        birds.splice(i, 1);
      }
    }

    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(loop);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      ui.root.removeEventListener("pointerdown", onPointerDown);
      for (const p of activeProjectiles) {
        scene.remove(p.mesh);
      }
      activeProjectiles.length = 0;
      audio.close();
      ui.destroy();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
