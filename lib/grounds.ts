/**
 * The five section grounds. These are the only legal page backgrounds.
 * See design/DESIGN-SYSTEM.md §1.1 and design/LANDING-SPEC.md §2.
 */

export const GROUNDS = ["ink", "slate", "warm", "pine", "paper"] as const;

export type Ground = (typeof GROUNDS)[number];

export const GROUND_HEX: Record<Ground, string> = {
  ink: "#0A0B0D",
  slate: "#101318",
  warm: "#17150F",
  pine: "#0E1C17",
  paper: "#F2EEE6",
};

/**
 * Per-ground radial bloom. Lets two scenes share a ground (PSX and Mutual
 * Funds both sit on `warm`) while still feeling like different rooms.
 */
export const GROUND_BLOOM: Record<Ground, string> = {
  ink: "radial-gradient(900px 700px at 78% 12%, rgba(201,162,39,0.10), transparent 62%)",
  slate: "radial-gradient(1000px 800px at 22% 30%, rgba(201,162,39,0.06), transparent 60%)",
  warm: "radial-gradient(900px 750px at 70% 60%, rgba(201,162,39,0.09), transparent 62%)",
  pine: "radial-gradient(1000px 800px at 50% 40%, rgba(63,191,127,0.07), transparent 60%)",
  paper: "radial-gradient(900px 700px at 30% 20%, rgba(142,113,24,0.07), transparent 60%)",
};
