import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { COLS, PUZZLES, ROWS } from "./logic";
import { MIN_TAP_PX, SPACING, boardTopNdc, cellAtWorld, cellNdc, cellWorld, fitBoardCamera, minCellPx, padCornersWorld, pickCell } from "./board3d";

const VIEWPORTS: [number, number][] = [
  [390, 844], // phone portrait
  [844, 390], // phone landscape
  [1024, 768], // tablet landscape
  [768, 1024], // tablet portrait
  [1440, 900], // laptop
];

describe("cellWorld / cellAtWorld", () => {
  it("lays row 0 at the back and row 4 at the front, column 0 on the left, one SPACING apart", () => {
    const a = cellWorld({ c: 0, r: 0 }, COLS, ROWS);
    const b = cellWorld({ c: 1, r: 0 }, COLS, ROWS);
    const d = cellWorld({ c: 0, r: 1 }, COLS, ROWS);
    expect(b.x - a.x).toBeCloseTo(SPACING);
    expect(d.z - a.z).toBeCloseTo(SPACING);
    expect(cellWorld({ c: 2, r: 2 }, COLS, ROWS).x).toBeCloseTo(0);
  });

  it("maps every point of a cell's square back to that cell, and nothing outside the board", () => {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const w = cellWorld({ c, r }, COLS, ROWS);
        for (const [dx, dz] of [
          [0, 0],
          [0.45, 0.45],
          [-0.45, 0.45],
          [0.45, -0.45],
          [-0.45, -0.45],
        ] as const)
          expect(cellAtWorld(w.x + dx * SPACING, w.z + dz * SPACING, COLS, ROWS)).toEqual({ c, r });
      }
    const corner = cellWorld({ c: 0, r: 0 }, COLS, ROWS);
    expect(cellAtWorld(corner.x - 0.6 * SPACING, corner.z, COLS, ROWS)).toBeNull();
    expect(cellAtWorld(corner.x, corner.z - 0.6 * SPACING, COLS, ROWS)).toBeNull();
    const far = cellWorld({ c: 4, r: 4 }, COLS, ROWS);
    expect(cellAtWorld(far.x + 0.6 * SPACING, far.z, COLS, ROWS)).toBeNull();
  });
});

describe("fitBoardCamera", () => {
  for (const [w, h] of VIEWPORTS) {
    describe(`${w} x ${h}`, () => {
      const cam = new PerspectiveCamera();
      fitBoardCamera(cam, w, h, COLS, ROWS);

      it(`keeps every square at least ${MIN_TAP_PX} CSS px apart (touch target)`, () => {
        expect(MIN_TAP_PX).toBeGreaterThanOrEqual(44);
        expect(minCellPx(cam, w, h, COLS, ROWS)).toBeGreaterThanOrEqual(MIN_TAP_PX);
      });

      it("shows the whole board on screen, below the speech bubble band at the top", () => {
        const v = new Vector3();
        for (const p of padCornersWorld(COLS, ROWS)) {
          v.copy(p).project(cam);
          expect(Math.abs(v.x)).toBeLessThanOrEqual(0.97);
          expect(v.y).toBeGreaterThanOrEqual(-0.97);
          // The speech bubble lives above the board: at most 0.6 in NDC, a fifth of the screen height from the top.
          expect(v.y).toBeLessThanOrEqual(boardTopNdc(h) + 1e-6);
          expect(boardTopNdc(h)).toBeLessThanOrEqual(0.6);
        }
      });

      it("picks back the square under every square's centre", () => {
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++) {
            const n = cellNdc(cam, { c, r }, COLS, ROWS);
            expect(pickCell(cam, n.x, n.y, COLS, ROWS)).toEqual({ c, r });
          }
        expect(pickCell(cam, 0, 0.99, COLS, ROWS)).toBeNull(); // the sky
      });
    });
  }

  it("fits every measured board the same way (5 x 5)", () => {
    for (const pz of PUZZLES) expect([pz.cols, pz.rows]).toEqual([COLS, ROWS]);
  });
});
