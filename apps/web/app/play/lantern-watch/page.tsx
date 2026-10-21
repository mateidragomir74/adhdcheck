import { requireHarness } from "@/lib/game-harness";
import { LanternWatchClient } from "./LanternWatchClient";

export const metadata = { title: "ADHDCheck · Lantern Watch (dev)" };

export default function LanternWatchPage() {
  requireHarness();
  return <LanternWatchClient />;
}
