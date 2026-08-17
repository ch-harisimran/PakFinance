"use client";

import type { WrappedSession } from "@/lib/pin/crypto";
import { MAX_ATTEMPTS } from "@/lib/pin/crypto";

/**
 * Where the wrapped session lives.
 *
 * localStorage rather than a cookie: this blob must never travel to the server.
 * It is useless without the PIN, and sending it on every request would only
 * widen its exposure.
 */

const KEY = "pf.pin.session";
const ATTEMPTS = "pf.pin.attempts";
const IDLE = "pf.pin.lockedAt";

export function savePin(blob: WrappedSession) {
  localStorage.setItem(KEY, JSON.stringify(blob));
  localStorage.removeItem(ATTEMPTS);
}

export function loadPin(): WrappedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WrappedSession) : null;
  } catch {
    return null;
  }
}

/** Wipes the wrapped session. The next visit needs a full login. */
export function clearPin() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(ATTEMPTS);
  localStorage.removeItem(IDLE);
}

export function attemptsLeft(): number {
  const used = Number(localStorage.getItem(ATTEMPTS) ?? 0);
  return Math.max(0, MAX_ATTEMPTS - used);
}

/** Returns attempts remaining after recording this failure. */
export function recordFailure(): number {
  const used = Number(localStorage.getItem(ATTEMPTS) ?? 0) + 1;
  localStorage.setItem(ATTEMPTS, String(used));
  const left = MAX_ATTEMPTS - used;
  // Out of tries: destroy the blob rather than leaving it for an offline grind.
  if (left <= 0) clearPin();
  return Math.max(0, left);
}

export function resetFailures() {
  localStorage.removeItem(ATTEMPTS);
}

/** Set when the app locks itself, so a reload stays locked. */
export function markLocked() {
  localStorage.setItem(IDLE, String(Date.now()));
}

export function clearLocked() {
  localStorage.removeItem(IDLE);
}

export function wasLocked(): boolean {
  return localStorage.getItem(IDLE) !== null;
}
