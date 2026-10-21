// Where the Route Planner board sits in the 3D river, how the camera frames it, and which square a tap hits.
// Pure math on a three.js camera (no DOM, no WebGL), so it is unit-tested in node (board3d.test.ts).
//
// Row 0 of the puzzle is the back of the board (towards the bridge), row ROWS - 1 the front (towards the child),
// column 0 the left: the same orientation as the 2D board it replaces. A tap is cast from the camera onto the plane
// of the pad tops, so the tap area of a square is the whole square, not only the pad drawn on it.
import { type PerspectiveCamera, Vector3 } from "three";
import { WATER_Y } from "../bridge-wait/world";
import type { Cell } from "./types";

/** Distance between square centres, world units. Design choice (no sourced value). */
export const SPACING = 0.94;
/** Lily pad radius, world units. */
export const PAD_R = 0.41;
/** z of row 0, in front of the Bridge Wait bridge (its front rail is at z 0.72). */
export const ROW0_Z = 1.75;
/** Height of the pad tops: taps are cast onto this plane. */
export const PAD_TOP_Y = WATER_Y + 0.05;
/** Smallest distance between square centres on screen, CSS px: the 44 px of the adhdcheck-dev skill plus a margin. */
export const MIN_TAP_PX = 48;
/** Camera elevation above the water, degrees. Steep enough that rocks and Luma barely overlap the square behind. */
const ELEVATION = (62 * Math.PI) / 180;
/** NDC band the board must stay inside. Above it, the speech bubble: about the top quarter of the screen, a little
 * less on a short landscape phone, where the board needs the height to keep its squares large enough to tap. */
const NDC_X = 0.92;
const NDC_BOTTOM = -0.93;
export const boardTopNdc = (h: number): number => (h < 500 ? 0.58 : 0.46);
/** Height of the tallest thing on a back-row square (a rock, Luma's head), so it stays on screen too. */
const PROP_H = 0.75;

export function cellWorld(cell: Cell, cols: number, _rows: number, y = PAD_TOP_Y): Vector3 {
  return new Vector3((cell.c - (cols - 1) / 2) * SPACING, y, ROW0_Z + cell.r * SPACING);
}

/** The square containing a point of the pad-top plane, or null outside the board. */
export function cellAtWorld(x: number, z: number, cols: number, rows: number): Cell | null {
  const c = Math.round(x / SPACING + (cols - 1) / 2) + 0; // + 0 turns -0 into 0
  const r = Math.round((z - ROW0_Z) / SPACING) + 0;
  return c >= 0 && r >= 0 && c < cols && r < rows ? { c, r } : null;
}

/** The outer corners of the board (pad edges), at pad height and, on the back row, at prop height. */
export function padCornersWorld(cols: number, rows: number): Vector3[] {
  const hx = ((cols - 1) / 2) * SPACING + PAD_R;
  const z0 = ROW0_Z - PAD_R;
  const z1 = ROW0_Z + (rows - 1) * SPACING + PAD_R;
  return [
    new Vector3(-hx, PAD_TOP_Y, z0),
    new Vector3(hx, PAD_TOP_Y, z0),
    new Vector3(-hx, PAD_TOP_Y, z1),
    new Vector3(hx, PAD_TOP_Y, z1),
    new Vector3(-hx, PAD_TOP_Y + PROP_H, z0 + PAD_R),
    new Vector3(hx, PAD_TOP_Y + PROP_H, z0 + PAD_R),
  ];
}

const tmp = new Vector3();

function place(cam: PerspectiveCamera, target: Vector3, d: number) {
  cam.position.set(target.x, target.y + Math.sin(ELEVATION) * d, target.z + Math.cos(ELEVATION) * d);
  cam.lookAt(target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

function bounds(cam: PerspectiveCamera, pts: Vector3[]) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    tmp.copy(p).project(cam);
    x0 = Math.min(x0, tmp.x);
    x1 = Math.max(x1, tmp.x);
    y0 = Math.min(y0, tmp.y);
    y1 = Math.max(y1, tmp.y);
  }
  return { x0, x1, y0, y1 };
}

/**
 * Frames the board: as large as fits in the band [NDC_BOTTOM, boardTopNdc] x [-NDC_X, NDC_X], low on the screen (near
 * the child's hand) in portrait. The camera looks at the board centre; the image is then slid vertically with a
 * view offset, which moves the picture without changing the perspective (moving the camera would resize the board).
 */
export function fitBoardCamera(cam: PerspectiveCamera, w: number, h: number, cols: number, rows: number): void {
  const W = Math.max(1, w);
  const H = Math.max(1, h);
  cam.aspect = W / H;
  cam.fov = W < H ? 34 : 30;
  cam.near = 0.1;
  cam.far = 200;
  cam.clearViewOffset();
  const top = boardTopNdc(H);
  const pts = padCornersWorld(cols, rows);
  const target = new Vector3(0, PAD_TOP_Y, ROW0_Z + ((rows - 1) / 2) * SPACING);
  const bandH = top - NDC_BOTTOM;

  // Smallest distance at which the board fits the band (binary search; the board shrinks as d grows).
  const fits = (d: number) => {
    place(cam, target, d);
    const b = bounds(cam, pts);
    return b.x1 - b.x0 <= 2 * NDC_X && b.y1 - b.y0 <= bandH * 0.98;
  };
  let lo = 2;
  let hi = 80;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  place(cam, target, hi);
  const b = bounds(cam, pts);
  const height = b.y1 - b.y0;
  const want = Math.min(top - height / 2, NDC_BOTTOM + 0.04 + height / 2);
  // A view offset of y px shows the image from y px lower down, so the content moves up by 2y/H in NDC.
  const dy = ((want - (b.y0 + b.y1) / 2) * H) / 2;
  cam.setViewOffset(W, H, 0, dy, W, H);
  cam.updateProjectionMatrix();
}

/** NDC position of a square's centre (x right, y up, both in -1..1). */
export function cellNdc(cam: PerspectiveCamera, cell: Cell, cols: number, rows: number): { x: number; y: number } {
  const v = cellWorld(cell, cols, rows).project(cam);
  return { x: v.x, y: v.y };
}

/** Screen position of a world point in CSS px from the top-left of a w x h canvas. */
export function toScreen(cam: PerspectiveCamera, p: Vector3, w: number, h: number): { x: number; y: number } {
  tmp.copy(p).project(cam);
  return { x: ((tmp.x + 1) / 2) * w, y: ((1 - tmp.y) / 2) * h };
}

const ray = new Vector3();

/** The square under an NDC point: the camera ray meets the pad-top plane inside that square. */
export function pickCell(cam: PerspectiveCamera, ndcX: number, ndcY: number, cols: number, rows: number): Cell | null {
  ray.set(ndcX, ndcY, 0.5).unproject(cam).sub(cam.position).normalize();
  if (ray.y >= -1e-6) return null; // pointing at or above the horizon
  const t = (PAD_TOP_Y - cam.position.y) / ray.y;
  return cellAtWorld(cam.position.x + ray.x * t, cam.position.z + ray.z * t, cols, rows);
}

/** Smallest on-screen distance between neighbouring square centres, CSS px (the size of the smallest tap area). */
export function minCellPx(cam: PerspectiveCamera, w: number, h: number, cols: number, rows: number): number {
  let min = Infinity;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const a = toScreen(cam, cellWorld({ c, r }, cols, rows), w, h);
      for (const n of [
        { c: c + 1, r },
        { c, r: r + 1 },
      ]) {
        if (n.c >= cols || n.r >= rows) continue;
        const b = toScreen(cam, cellWorld(n, cols, rows), w, h);
        min = Math.min(min, Math.hypot(b.x - a.x, b.y - a.y));
      }
    }
  return min;
}
