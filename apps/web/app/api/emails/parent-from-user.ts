// The parent behind an email request, from the Supabase auth user. emailConfirmed is true only when auth has
// confirmed the address (email_confirmed_at); it is never assumed (R3-E2).
export type EmailParent = { id: string; email: string; emailConfirmed: boolean };

export function parentFromUser(user: { id?: string | null; email?: string | null; email_confirmed_at?: string | null } | null | undefined): EmailParent | null {
  if (!user?.id || !user.email) return null;
  return { id: user.id, email: user.email, emailConfirmed: Boolean(user.email_confirmed_at) };
}
