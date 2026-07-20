// ===========================================================================
// The Content desk's copywriting knowledge — hook formulas, psychological
// triggers, frameworks, and engagement devices. Pure data (no next imports) so
// both the client UI and the server AI lib build from the same source of truth.
// ===========================================================================

export interface Named { key: string; label: string; hint: string }

/** Proven hook formulas — the shapes that stop the scroll. */
export const HOOK_FORMULAS: Named[] = [
  { key: "curiosity_gap", label: "Curiosity gap", hint: "Open a loop the reader must close." },
  { key: "bold_claim", label: "Bold claim", hint: "A confident, specific assertion." },
  { key: "contrarian", label: "Contrarian take", hint: "Challenge a common belief." },
  { key: "warning", label: "Warning / negativity", hint: "The mistake / what to avoid." },
  { key: "listicle", label: "Listicle", hint: "“N things that…” promise." },
  { key: "question", label: "Direct question", hint: "A question they can't not answer." },
  { key: "story_open", label: "Story open", hint: "Drop them mid-scene." },
  { key: "stat_shock", label: "Stat shock", hint: "A surprising number." },
  { key: "relatable", label: "Callout / relatable", hint: "“You when…” moment of recognition." },
  { key: "before_after", label: "Before → after", hint: "The transformation tease." },
  { key: "fomo", label: "FOMO", hint: "What they're missing right now." },
  { key: "how_to", label: "How-to promise", hint: "A clear outcome, fast." },
  { key: "secret", label: "Insider secret", hint: "What the pros won't tell you." },
  { key: "myth_bust", label: "Myth-bust", hint: "“Stop believing X.”" },
];

/** Cialdini + modern persuasion levers. */
export const TRIGGERS: Named[] = [
  { key: "scarcity", label: "Scarcity", hint: "Limited time / quantity." },
  { key: "social_proof", label: "Social proof", hint: "Others already love it." },
  { key: "authority", label: "Authority", hint: "Expertise & credentials." },
  { key: "reciprocity", label: "Reciprocity", hint: "Give value first." },
  { key: "curiosity", label: "Curiosity", hint: "An unresolved gap." },
  { key: "loss_aversion", label: "Loss aversion", hint: "Fear of missing / losing." },
  { key: "novelty", label: "Novelty", hint: "New, unseen, fresh." },
  { key: "tribe", label: "Tribe / identity", hint: "“People like us.”" },
  { key: "anchoring", label: "Anchoring", hint: "Set a reference point." },
  { key: "commitment", label: "Commitment", hint: "Small yes → big yes." },
];

/** Copy structures the whole post can be drafted to. */
export const FRAMEWORKS: Named[] = [
  { key: "aida", label: "AIDA", hint: "Attention → Interest → Desire → Action." },
  { key: "pas", label: "PAS", hint: "Problem → Agitate → Solve." },
  { key: "bab", label: "BAB", hint: "Before → After → Bridge." },
  { key: "reel", label: "Hook → Retain → Reward", hint: "Retention structure for reels." },
];

/** Engagement devices ("traps") that lift saves, shares, and comments. */
export const DEVICES: Named[] = [
  { key: "open_loop", label: "Open loop", hint: "Tease a payoff kept until the end." },
  { key: "cliffhanger", label: "Cliffhanger", hint: "“Wait for it…”" },
  { key: "comment_bait", label: "Comment bait", hint: "Invite a specific reply." },
  { key: "save_bait", label: "Save bait", hint: "“Save this for later.”" },
  { key: "share_bait", label: "Share bait", hint: "“Tag someone who…”" },
  { key: "controversy", label: "Controversy dial", hint: "A spicy, debate-sparking angle." },
];

export const PLATFORMS: { key: string; label: string; hint: string }[] = [
  { key: "instagram", label: "Instagram", hint: "Caption + hashtags, line breaks, emoji per policy." },
  { key: "linkedin", label: "LinkedIn", hint: "Professional, hook-first, no hashtags spam." },
  { key: "x", label: "X / Twitter", hint: "Punchy; can be a thread." },
  { key: "facebook", label: "Facebook", hint: "Conversational, slightly longer." },
  { key: "tiktok", label: "TikTok", hint: "Spoken-word script + on-screen text." },
];

const byKey = (arr: Named[]) => Object.fromEntries(arr.map((x) => [x.key, x]));
export const HOOK_MAP = byKey(HOOK_FORMULAS);
export const TRIGGER_MAP = byKey(TRIGGERS);
export const FRAMEWORK_MAP = byKey(FRAMEWORKS);
export const DEVICE_MAP = byKey(DEVICES);
export const labelOf = (map: Record<string, Named>, k: string) => map[k]?.label ?? k;
