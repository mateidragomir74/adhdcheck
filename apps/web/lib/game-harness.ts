import "server-only";
import { notFound } from "next/navigation";

// The dev harness pages under /play (bridge-wait, star-path, treasure-choice, route-planner, wake-fireflies, lantern-watch) run a game with
// no play link, which FR-01 does not allow in production. They render only in development, or when the
// server flag GAME_HARNESS is "1" (read when the page is built).
export function harnessEnabled(env: { NODE_ENV?: string; GAME_HARNESS?: string } = process.env): boolean {
  return env.NODE_ENV === "development" || env.GAME_HARNESS === "1";
}

export function requireHarness(): void {
  if (!harnessEnabled()) notFound();
}
