// The pointerdown path to the runner. The response time is measured from the event's own timeStamp (the moment
// of the touch, in the same clock as the frame timestamps), never from performance.now() inside the handler,
// which would add the time the event waited for the main thread (research/03 section 2.3 item 4).
import type { TapKind } from "./runner";

export interface PointerLike {
  timeStamp: number;
  clientX: number;
  clientY: number;
}

export function forwardPointerDown(
  e: PointerLike,
  rect: { left: number; top: number },
  runner: { pointerDown(tMs: number, x: number, y: number, lantern: number | null): TapKind },
  hit: (x: number, y: number) => number | null,
): TapKind {
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return runner.pointerDown(e.timeStamp, x, y, hit(x, y));
}
