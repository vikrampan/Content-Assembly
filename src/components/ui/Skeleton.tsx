// Loading skeletons — shape-preserving placeholders while data/AI is in flight.
import type { CSSProperties } from "react";

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-pulse rounded ${className}`} style={{ background: "var(--panel-2)", ...style }} />;
}

/** A few lines of shimmering text — good for paragraphs the AI is writing. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  const widths = ["100%", "92%", "78%", "96%", "70%"];
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}
