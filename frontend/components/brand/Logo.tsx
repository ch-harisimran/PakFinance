import Link from "next/link";

/**
 * The PakFinance mark — a four-facet diamond, lit from the upper-left.
 *
 * Inlined as SVG rather than loaded from /brand/mark.svg: it is four polygons,
 * so an <img> would cost a network request to save nothing, and inlining keeps
 * it crisp at every size and available before first paint. The file still ships
 * in public/brand for the manifest, share cards and anywhere outside React.
 *
 * The facet colours are the brass ramp from the design system, so the mark and
 * the UI are lit by the same light source.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="PakFinance"
    >
      <polygon points="50,8 14,44 50,44" fill="#E6C767" />
      <polygon points="50,8 86,44 50,44" fill="#C9A227" />
      <polygon points="14,44 50,92 50,44" fill="#C9A227" />
      <polygon points="86,44 50,92 50,44" fill="#8E7118" />
    </svg>
  );
}

/**
 * Mark + wordmark. `href` makes it a link home; omit it for contexts that are
 * already home, or where a nested link would be invalid.
 */
export function Logo({
  href = "/",
  size = 32,
  text = 21,
  showText = true,
  className = "",
}: {
  href?: string | null;
  size?: number;
  text?: number;
  showText?: boolean;
  className?: string;
}) {
  const inner = (
    <>
      <LogoMark size={size} className="flex-none" />
      {showText && (
        <span
          className="truncate tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-display)", fontSize: text }}
        >
          PakFinance
        </span>
      )}
    </>
  );

  const classes = `flex min-w-0 items-center gap-2.5 ${className}`;

  if (!href) {
    return <span className={classes}>{inner}</span>;
  }

  return (
    <Link href={href} className={classes} aria-label="PakFinance home">
      {inner}
    </Link>
  );
}
