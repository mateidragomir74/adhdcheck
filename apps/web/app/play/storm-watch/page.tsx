import { requireHarness } from "@/lib/game-harness";
import { StormWatchClient } from "./StormWatchClient";

export const metadata = { title: "ADHDCheck · Storm Watch (dev)" };

export default function StormWatchPage() {
  requireHarness();
  return <StormWatchClient />;
}
