import { requireHarness } from "@/lib/game-harness";
import { WakeFirefliesClient } from "./WakeFirefliesClient";

export const metadata = { title: "ADHDCheck · Wake the fireflies (dev)" };

export default function WakeFirefliesPage() {
  requireHarness();
  return <WakeFirefliesClient />;
}
