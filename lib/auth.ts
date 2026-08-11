import { createUniversalAuth, fetchWithRetry } from "@virtualiti-peru/universal-auth/next";

export const VOUCHEK_APPLICATION_ID =
  process.env.VOUCHEK_APPLICATION_ID ?? "c8071a8f-45f6-4749-b9a8-f5ec37cde6de";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasSupabaseConfig = Boolean(supabaseUrl?.trim() && anonKey?.trim());

const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

if (!hasSupabaseConfig && !isBuildPhase && process.env.NODE_ENV === "production") {
  throw new Error("Supabase auth is not configured for VouChek (SUPABASE_URL / SUPABASE_ANON_KEY).");
}

export const { auth, handlers, signIn, signOut, unstable_update } = createUniversalAuth({
  supabaseUrl: supabaseUrl?.trim() || "https://placeholder.supabase.co",
  anonKey: anonKey?.trim() || "sb_publishable_build_placeholder",
  applicationId: VOUCHEK_APPLICATION_ID,
  signInPage: "/sign-in",
  fetch: (input, init) => fetchWithRetry(input, init),
});
