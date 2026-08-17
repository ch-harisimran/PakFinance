/**
 * Row filtering for the per-screen search boxes.
 *
 * Case- and accent-insensitive substring matching across whichever fields the
 * screen considers searchable. Deliberately not fuzzy: on a list of your own
 * records you know what you are looking for, and fuzzy matching mostly succeeds
 * at surfacing the row you did not mean.
 *
 * Multiple words all have to match, though not in order or in the same field —
 * "meezan car" finds the car loan from Meezan Bank.
 */

/** Lowercase, strip accents, collapse whitespace. */
function normalise(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matches(query: string, ...fields: (string | number | null | undefined)[]): boolean {
  const q = normalise(query);
  if (!q) return true;

  const haystack = normalise(
    fields.filter((f) => f !== null && f !== undefined).join(" "),
  );

  return q.split(" ").every((word) => haystack.includes(word));
}

/** Filter a list by a predicate that pulls the searchable fields off each row. */
export function filterBy<T>(
  rows: T[],
  query: string,
  fields: (row: T) => (string | number | null | undefined)[],
): T[] {
  if (!query.trim()) return rows;
  return rows.filter((row) => matches(query, ...fields(row)));
}

/** `searchParams.q` arrives as string | string[] | undefined. */
export function readQuery(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}
