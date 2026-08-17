/**
 * The user's identity, and the pure functions that present it.
 *
 * Deliberately NOT in lib/queries.ts: that module is `server-only`, and the top
 * bar, the account menu and the settings cards are client components that need
 * the type and the two formatters. Importing them from there would drag the
 * Supabase server client — cookies and all — into the browser bundle, which is
 * exactly what `server-only` exists to prevent.
 *
 * Nothing here touches the database. `getProfile` lives in lib/queries.ts.
 */

export interface Profile {
  userId: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  notation: "international" | "subcontinental";
  theme: string;
  /** From auth.users, for the "this session" panel. */
  lastSignInAt: string | null;
  /**
   * Whether a quick-unlock PIN exists for this ACCOUNT, not this browser. The
   * lock screen needs it to tell "enter your PIN" from "set one up" after a
   * fresh sign-in, when localStorage holds no wrapped session yet.
   */
  pinSet: boolean;
}

/** What to call someone when their name is missing: the local part of the email. */
export function displayName(p: Pick<Profile, "fullName" | "email">): string {
  return p.fullName?.trim() || p.email.split("@")[0] || "Your account";
}

/**
 * Avatar initials. First and last word of the name, so "Mohammad Haris Imran"
 * reads MI rather than MH — the surname is the half people recognise.
 */
export function initialsOf(p: Pick<Profile, "fullName" | "email">): string {
  const words = (p.fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (p.email.slice(0, 2) || "?").toUpperCase();
}
