import { createClient } from "@/lib/supabase/server";
import { parentFromUser } from "./parent-from-user";

// The logged-in parent for the FR-50 email routes. getUser asks Supabase auth, so the confirmation state
// (email_confirmed_at) is the server's, never a claim copied from the request or the token (R3-E2).
export async function getParent() {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data?.user;
  return { supabase, parent: parentFromUser(user) };
}
