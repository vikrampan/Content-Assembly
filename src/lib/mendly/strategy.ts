// ===========================================================================
// The Strategy Desk — format decision logic (Mendly Stage 04, deck page 8)
//
// "How we choose the format — never by taste." The client brings the OBJECTIVE
// (the message); the engine maps it to a format deterministically. This is the
// literal encoding of the deck's mapping table + tie-breakers, so the decision
// is reproducible and defensible — never a debate.
// ===========================================================================

export type Objective = "launch" | "educate" | "vibe" | "urgency";
export type Medium = "post" | "reel";

interface FormatRow {
  goal: string;
  post: string;
  reel: string;
}

// Brand-agnostic creative directions. `{subject}` is filled per brand (e.g.
// "the coffee", "each piece", "the skincare") so the *direction* stays
// universal while the wording fits the brand. Defaults to "the product".
export const OBJECTIVES: Record<Objective, FormatRow> = {
  launch: {
    goal: "Launch something new",
    post: "Product hero — {subject} in macro detail, zero distraction",
    reel: "Hero reel — {subject} in extreme close-up, texture-forward",
  },
  educate: {
    goal: "Educate or tell a story",
    post: "Carousel — the story across slides: origin, process, the people",
    reel: "Behind-the-scenes reel — how {subject} is made, on camera",
  },
  vibe: {
    goal: "Build vibe & immersion",
    post: "Ambience post — the world the brand lives in",
    reel: "Sensory reel — the mood and motion around {subject}",
  },
  urgency: {
    goal: "Drive urgency & reach",
    post: "Offer / FOMO post — finite drops, a hard deadline",
    reel: "Trend-jack reel — riding a rising audio early",
  },
};

/** The three tie-breakers when two formats fit (deck page 8, bottom). */
export const TIE_BREAKERS = [
  "The calendar — festival or monsoon content wins its week",
  "Your data — what historically converted for this account",
  "Feed rhythm — never the same format twice in a row",
] as const;

export interface FormatDecision {
  objective: Objective;
  goal: string;
  medium: Medium;
  /** The specific chosen format description. */
  formatType: string;
  /** The DB content_format enum value (post | carousel | reel). */
  dbFormat: "post" | "carousel" | "reel";
  /** Why this format — never by taste. */
  rationale: string;
}

/**
 * Decide the format for a brief. `medium` (reel vs post) is the human's lever —
 * motion & sound, or a held frame — chosen by what the message needs. Given
 * that lever + the objective, the specific format is determined by the table.
 */
export function decideFormat(
  objective: Objective,
  medium: Medium,
  subject?: string | null,
): FormatDecision {
  const row = OBJECTIVES[objective];
  const noun = (subject && subject.trim()) || "the product";
  const formatType = (medium === "reel" ? row.reel : row.post).replace(/\{subject\}/g, noun);
  // The educate/post cell is a carousel; everything else is a single post/reel.
  const dbFormat =
    medium === "reel"
      ? "reel"
      : objective === "educate"
        ? "carousel"
        : "post";
  const rationale = `Objective "${row.goal}" + ${medium} → ${formatType}. Derived from the strategy mapping, not taste. Tie-breakers if two formats fit: ${TIE_BREAKERS.join("; ")}.`;
  return { objective, goal: row.goal, medium, formatType, dbFormat, rationale };
}

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  launch: "Launch something new",
  educate: "Educate or tell a story",
  vibe: "Build vibe & immersion",
  urgency: "Drive urgency & reach",
};
