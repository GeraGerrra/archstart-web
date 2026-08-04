"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { AUTH_LIMITS, getSiteOrigin } from "./config";
import { readProfileByUserId } from "./guards";
import { PASSWORD_POLICY_COPY_RU, validatePasswordPolicy } from "./password-policy";
import { DEFAULT_ACCOUNT_DESTINATION, safeRelativeDestination } from "./redirects";
import type { AuthActionState, AuthFieldName } from "./types";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function rawText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function normalizedEmail(formData: FormData): string {
  return text(formData, "email").toLowerCase();
}

function errorState(message: string, fieldErrors?: Partial<Record<AuthFieldName, string>>): AuthActionState {
  return { status: "error", message, fieldErrors };
}

function validateNames(firstName: string, lastName: string): Partial<Record<AuthFieldName, string>> {
  const errors: Partial<Record<AuthFieldName, string>> = {};
  if (!firstName) errors.firstName = "Введите имя.";
  else if (firstName.length > AUTH_LIMITS.nameMax) errors.firstName = `Не более ${AUTH_LIMITS.nameMax} символов.`;
  if (!lastName) errors.lastName = "Введите фамилию.";
  else if (lastName.length > AUTH_LIMITS.nameMax) errors.lastName = `Не более ${AUTH_LIMITS.nameMax} символов.`;
  return errors;
}

async function claimedUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  return error || typeof data?.claims?.sub !== "string" ? null : data.claims.sub;
}

export async function signUpAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const email = normalizedEmail(formData);
  const password = rawText(formData, "password");
  const passwordConfirm = rawText(formData, "passwordConfirm");
  const fieldErrors = validateNames(firstName, lastName);
  if (!email || !email.includes("@")) fieldErrors.email = "Введите корректный email.";
  const passwordPolicyError = validatePasswordPolicy(password);
  if (passwordPolicyError) fieldErrors.password = passwordPolicyError;
  if (password !== passwordConfirm) fieldErrors.passwordConfirm = "Пароли не совпадают.";
  if (Object.keys(fieldErrors).length) return errorState("Проверьте отмеченные поля.", fieldErrors);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
      emailRedirectTo: `${getSiteOrigin()}/auth/confirm?next=/onboarding`,
    },
  });
  if (error?.code === "weak_password") return errorState("Проверьте пароль.", { password: PASSWORD_POLICY_COPY_RU });
  if (error) return errorState("Не удалось создать аккаунт. Проверьте данные и попробуйте ещё раз.");
  redirect("/auth/check-email?mode=signup");
}

export async function signInAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = normalizedEmail(formData);
  const password = rawText(formData, "password");
  const next = safeRelativeDestination(formData.get("next"));
  const fieldErrors: Partial<Record<AuthFieldName, string>> = {};
  if (!email || !email.includes("@")) fieldErrors.email = "Введите корректный email.";
  if (!password) fieldErrors.password = "Введите пароль.";
  if (Object.keys(fieldErrors).length) return errorState("Проверьте отмеченные поля.", fieldErrors);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return errorState("Не удалось войти. Проверьте email, пароль и подтверждение почты.");
  const { data: claimsResult, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsResult?.claims?.sub === "string" ? claimsResult.claims.sub : "";
  if (claimsError || !userId) return errorState("Сессия не подтверждена. Попробуйте войти ещё раз.");
  const profile = await readProfileByUserId(userId);
  redirect(profile?.onboarding_completed_at ? next : "/onboarding");
}

export async function forgotPasswordAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = normalizedEmail(formData);
  if (!email || !email.includes("@")) return errorState("Введите корректный email.", { email: "Проверьте адрес." });
  const supabase = await createServerSupabaseClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteOrigin()}/auth/confirm?next=/auth/update-password`,
  });
  redirect("/auth/check-email?mode=recovery");
}

export async function updatePasswordAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const password = rawText(formData, "password");
  const passwordConfirm = rawText(formData, "passwordConfirm");
  const fieldErrors: Partial<Record<AuthFieldName, string>> = {};
  const passwordPolicyError = validatePasswordPolicy(password);
  if (passwordPolicyError) fieldErrors.password = passwordPolicyError;
  if (password !== passwordConfirm) fieldErrors.passwordConfirm = "Пароли не совпадают.";
  if (Object.keys(fieldErrors).length) return errorState("Проверьте новый пароль.", fieldErrors);
  if (!(await claimedUserId())) redirect("/auth/sign-in?error=session");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error?.code === "weak_password") return errorState("Проверьте пароль.", { password: PASSWORD_POLICY_COPY_RU });
  if (error) return errorState("Не удалось обновить пароль. Запросите новую ссылку восстановления.");
  redirect(DEFAULT_ACCOUNT_DESTINATION);
}

export async function onboardingAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const discoverySource = text(formData, "discoverySource");
  const fieldErrors = validateNames(firstName, lastName);
  if (!discoverySource) fieldErrors.discoverySource = "Ответ обязателен.";
  else if (discoverySource.length > AUTH_LIMITS.discoverySourceMax) fieldErrors.discoverySource = `Не более ${AUTH_LIMITS.discoverySourceMax} символов.`;
  if (Object.keys(fieldErrors).length) return errorState("Проверьте отмеченные поля.", fieldErrors);
  const userId = await claimedUserId();
  if (!userId) redirect("/auth/sign-in?next=/onboarding");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("profiles").update({
    first_name: firstName,
    last_name: lastName,
    discovery_source: discoverySource,
    onboarding_completed_at: new Date().toISOString(),
  }).eq("user_id", userId);
  if (error) return errorState("Не удалось сохранить ответы. Попробуйте ещё раз.");
  redirect(DEFAULT_ACCOUNT_DESTINATION);
}

export async function updateProfileAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const discoverySource = text(formData, "discoverySource");
  const fieldErrors = validateNames(firstName, lastName);
  if (!discoverySource) fieldErrors.discoverySource = "Ответ обязателен.";
  else if (discoverySource.length > AUTH_LIMITS.discoverySourceMax) fieldErrors.discoverySource = `Не более ${AUTH_LIMITS.discoverySourceMax} символов.`;
  if (Object.keys(fieldErrors).length) return errorState("Проверьте отмеченные поля.", fieldErrors);
  const userId = await claimedUserId();
  if (!userId) redirect("/auth/sign-in?next=/profile");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("profiles").update({
    first_name: firstName,
    last_name: lastName,
    discovery_source: discoverySource,
  }).eq("user_id", userId);
  if (error) return errorState("Не удалось обновить профиль. Попробуйте ещё раз.");
  redirect("/profile?saved=1");
}

export async function signOutAction(): Promise<never> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}
