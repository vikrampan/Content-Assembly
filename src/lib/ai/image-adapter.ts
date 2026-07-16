// ===========================================================================
// AI Image Adapter (Module 3 / Layer 3) — STUBBED
//
// This is the seam for AI background generation. The important business logic
// — automatically appending the brand's locked visual rules to whatever the
// creator types — lives here and is REAL. Only the network call to a provider
// is stubbed. Swap `StubImageProvider` for a real one later without touching
// callers.
// ===========================================================================

export interface GenerateImageInput {
  /** Raw prompt typed by the Team Incharge. */
  prompt: string;
  /** Brand's locked visual suffix, e.g. from workspaces.ai_style_suffix. */
  brandStyleSuffix?: string | null;
  /** Optional aspect ratio hint, e.g. "1:1", "4:5", "9:16". */
  aspectRatio?: string;
}

export interface GenerateImageResult {
  /** The exact prompt sent to the model (brand rules already appended). */
  finalPrompt: string;
  /** URL or data URI of the generated image. */
  imageUrl: string;
  provider: string;
}

/**
 * Composes the final on-brand prompt. This is the value the platform adds:
 * the creator never has to copy/paste hex codes or style rules — they are
 * appended automatically from the workspace's Brand Book.
 */
export function composeBrandedPrompt(input: GenerateImageInput): string {
  const base = input.prompt.trim();
  const suffix = (input.brandStyleSuffix ?? "").trim();
  if (!suffix) return base;
  // Avoid double-appending if the creator already pasted the suffix.
  if (base.toLowerCase().includes(suffix.toLowerCase())) return base;
  return `${base}, ${suffix}`;
}

export interface ImageProvider {
  readonly name: string;
  generate(input: GenerateImageInput): Promise<GenerateImageResult>;
}

/**
 * Stub provider — returns a deterministic placeholder so the whole Module 3
 * flow is exercisable end-to-end without a real API key or spend.
 */
export class StubImageProvider implements ImageProvider {
  readonly name = "stub";

  async generate(input: GenerateImageInput): Promise<GenerateImageResult> {
    const finalPrompt = composeBrandedPrompt(input);
    // A tiny inline SVG placeholder tinted toward the brand's cream default.
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>
      <rect width='100%' height='100%' fill='#FFF9E9'/>
      <text x='50%' y='50%' font-family='sans-serif' font-size='16'
        fill='#8a7a55' text-anchor='middle'>on-brand placeholder</text>
    </svg>`;
    const imageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return { finalPrompt, imageUrl, provider: this.name };
  }
}

/**
 * Factory driven by env. Today only "stub" exists; add real providers
 * (Replicate / Stability / OpenAI / etc.) as new cases here.
 */
export function getImageProvider(): ImageProvider {
  const provider = process.env.AI_IMAGE_PROVIDER ?? "stub";
  switch (provider) {
    case "stub":
    default:
      return new StubImageProvider();
  }
}
