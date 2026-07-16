/**
 * Placeholder Database types.
 *
 * Regenerate the REAL types from your live schema with:
 *   npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
 * (or `--project-id <ref>` against a hosted project).
 *
 * Until then this loose type keeps the app compiling. It is intentionally
 * permissive — swap it for the generated file before shipping.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
