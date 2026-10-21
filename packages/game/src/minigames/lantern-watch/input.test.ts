import { describe, expect, it, vi } from "vitest";
import { forwardPointerDown } from "./input";

// R3-L6: a response time is measured from event.timeStamp (the moment of the touch), never from the time the
// handler runs. A rewrite that read performance.now() in the handler passed every earlier test.
describe("forwardPointerDown", () => {
  const rect = { left: 10, top: 20 };

  it("hands the runner the event's own timeStamp and coordinates relative to the game root", () => {
    vi.spyOn(performance, "now").mockReturnValue(99999);
    const pointerDown = vi.fn().mockReturnValue("response");
    const kind = forwardPointerDown({ timeStamp: 1234.5, clientX: 110, clientY: 70 }, rect, { pointerDown }, () => 2);
    expect(kind).toBe("response");
    expect(pointerDown).toHaveBeenCalledWith(1234.5, 100, 50, 2);
    expect(pointerDown.mock.calls[0]?.[0]).not.toBe(99999);
    vi.restoreAllMocks();
  });

  it("hit-tests the point in the same coordinates it passes on", () => {
    const hit = vi.fn().mockReturnValue(null);
    forwardPointerDown({ timeStamp: 1, clientX: 15, clientY: 25 }, rect, { pointerDown: () => "ignored" }, hit);
    expect(hit).toHaveBeenCalledWith(5, 5);
  });
});
