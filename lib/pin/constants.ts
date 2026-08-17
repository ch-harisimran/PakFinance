/**
 * PIN constants, deliberately free of a `"use client"` directive.
 *
 * `lib/pin/crypto.ts` is browser code and carries that directive, so a server
 * action importing a constant from it would be reaching across the client
 * boundary for a number. These live here instead and both sides import them,
 * which keeps one source of truth for a value that appears in the pad, the
 * validation and the copy.
 */

/** Six digits: 10^6, not the 10^4 a four-digit PIN would give an offline grind. */
export const PIN_LENGTH = 6;

/** Wrong tries before the wrapped session is destroyed and a full sign-in is required. */
export const MAX_ATTEMPTS = 5;

/** How long a wrapped session stays usable before a full login is required. */
export const PIN_VALID_DAYS = 5;
