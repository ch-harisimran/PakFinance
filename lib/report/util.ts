import "server-only";

import { getProfile as getProfileQuery } from "@/lib/queries";
import { displayName, type Profile } from "@/lib/profile";

/**
 * Thin re-exports so lib/report/data.ts has one import surface, and so the
 * report never reaches for the Supabase client directly.
 */

export const getProfile = getProfileQuery;

export function displayNameOf(profile: Profile | null): string {
  return profile ? displayName(profile) : "Your account";
}
