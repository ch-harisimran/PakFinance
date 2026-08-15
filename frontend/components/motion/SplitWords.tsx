import type { ReactNode } from "react";

/**
 * Splits text into per-word spans inside overflow-hidden masks, so a headline
 * can rise word by word from behind its own baseline.
 *
 * Rendered on the server: the text is real, selectable, and in the DOM for
 * crawlers before any JS runs. The animation only ever moves what is already
 * there.
 *
 * Words carry `data-word` for GSAP to target; the mask carries the overflow.
 */
export function SplitWords({
  text,
  className,
  wordClassName,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
}) {
  return (
    <span className={className}>
      {text.split(" ").map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block overflow-hidden align-bottom"
          style={{ paddingBottom: "0.12em", marginBottom: "-0.12em" }}
        >
          <span data-word className={`inline-block ${wordClassName ?? ""}`}>
            {word}
            {" "}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Same masking, for a fragment that needs custom markup inside. */
export function WordMask({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-block overflow-hidden align-bottom"
      style={{ paddingBottom: "0.12em", marginBottom: "-0.12em" }}
    >
      <span data-word className="inline-block">
        {children}
      </span>
    </span>
  );
}
