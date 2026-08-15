/**
 * Film-grain overlay. Kills gradient banding on the dark grounds and adds the
 * texture that flat CSS colour cannot produce. Mounted once, at the root.
 * Styles live in design/tokens.css (.noise-overlay).
 */
export function NoiseOverlay() {
  return <div className="noise-overlay" aria-hidden="true" />;
}
