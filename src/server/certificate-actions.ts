"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { parseIssuedCertificate, publicCertificatePath } from "@/src/certificate/model";
import type { CertificateIssueActionResult } from "@/src/certificate/types";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

function safeFailure(
  status: Exclude<CertificateIssueActionResult["status"], "success">,
  message: string,
): CertificateIssueActionResult {
  return { status, message };
}

export async function issueMyCourseCertificateAction(): Promise<CertificateIssueActionResult> {
  const client = await createServerSupabaseClient();
  const { data: claimsResult, error: claimsError } = await client.auth.getClaims();
  const userId = typeof claimsResult?.claims?.sub === "string"
    ? claimsResult.claims.sub
    : "";

  if (claimsError || !userId) {
    return safeFailure("auth-required", "Войдите в аккаунт, чтобы сформировать сертификат.");
  }

  try {
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      return safeFailure("error", "Проверка профиля временно недоступна.");
    }
    if (!profile?.onboarding_completed_at) {
      return safeFailure("onboarding-required", "Сначала завершите настройку профиля.");
    }

    const { data, error } = await client.rpc("issue_my_course_certificate");
    if (error) {
      if (error.code === "23514") {
        return safeFailure(
          "ineligible",
          "Сертификат пока недоступен. Завершите 40 уроков и получите принятие всех восьми проектов.",
        );
      }
      if (error.code === "55000") {
        return safeFailure("revoked", "Этот сертификат был отозван и не может быть выпущен повторно.");
      }
      return safeFailure("error", "Формирование сертификата временно недоступно.");
    }

    const issued = parseIssuedCertificate(data);
    if (!issued) {
      return safeFailure("error", "Сервер не подтвердил выпуск сертификата.");
    }

    revalidatePath("/dashboard");
    revalidatePath("/certificate");
    revalidatePath(publicCertificatePath(issued.certificate.certificateCode));

    return {
      status: "success",
      message: issued.reused
        ? "Сертификат уже был выпущен. Открываем сохранённую запись."
        : "Сертификат выпущен.",
      certificateCode: issued.certificate.certificateCode,
      reused: issued.reused,
    };
  } catch {
    return safeFailure("error", "Формирование сертификата временно недоступно.");
  }
}
