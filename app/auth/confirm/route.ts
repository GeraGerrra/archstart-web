import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { readProfileByUserId } from "@/src/auth/guards";
import { safeRelativeDestination } from "@/src/auth/redirects";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const requestedType = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeRelativeDestination(url.searchParams.get("next"));
  const supabase = await createServerSupabaseClient();
  let failed = false;
  const recoveryFlow = requestedType === "recovery" || next === "/auth/update-password";
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && requestedType && EMAIL_OTP_TYPES.has(requestedType)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: requestedType });
    failed = Boolean(error);
  } else {
    failed = true;
  }
  if (failed) return NextResponse.redirect(new URL("/auth/sign-in?error=confirmation", request.url));
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  if (error || !userId) return NextResponse.redirect(new URL("/auth/sign-in?error=confirmation", request.url));
  if (recoveryFlow) return NextResponse.redirect(new URL(next, request.url));
  const profile = await readProfileByUserId(userId);
  return NextResponse.redirect(new URL(profile?.onboarding_completed_at ? next : "/onboarding", request.url));
}
