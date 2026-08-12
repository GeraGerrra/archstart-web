import "server-only";

import {
  composeMyCertificateProjection,
  emptyPublicCertificateVerification,
  normalizeCertificateCode,
  parseMyCertificateEligibility,
  parseOwnCertificateSnapshot,
  parsePublicCertificateVerification,
  unavailableCertificateProjection,
} from "@/src/certificate/model";
import type {
  MyCertificateProjection,
  PublicCertificateVerification,
} from "@/src/certificate/types";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

async function authenticatedUserId(): Promise<{
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
} | null> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  return !error && userId ? { client, userId } : null;
}

export async function loadMyCertificateProjection(): Promise<MyCertificateProjection> {
  const session = await authenticatedUserId();
  if (!session) return unavailableCertificateProjection();

  try {
    const { data, error } = await session.client.rpc(
      "get_my_course_certificate_eligibility",
    );
    if (error) return unavailableCertificateProjection();

    const eligibility = parseMyCertificateEligibility(data);
    if (!eligibility) return unavailableCertificateProjection();

    if (!eligibility.certificateReference) {
      return composeMyCertificateProjection(eligibility, null)
        ?? unavailableCertificateProjection();
    }

    const { data: certificateData, error: certificateError } = await session.client
      .from("course_certificates")
      .select(
        "id,certificate_code,display_name_snapshot,course_code,course_version,course_title_snapshot,issued_at,revoked_at,created_at",
      )
      .eq("id", eligibility.certificateReference.certificateId)
      .maybeSingle();

    if (certificateError) return unavailableCertificateProjection();
    const certificate = parseOwnCertificateSnapshot(certificateData, eligibility);
    return composeMyCertificateProjection(eligibility, certificate)
      ?? unavailableCertificateProjection();
  } catch {
    return unavailableCertificateProjection();
  }
}

export async function loadPublicCertificateVerification(
  certificateCodeValue: unknown,
): Promise<PublicCertificateVerification> {
  const certificateCode = normalizeCertificateCode(certificateCodeValue);
  if (!certificateCode) return emptyPublicCertificateVerification();

  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("verify_course_certificate", {
      p_certificate_code: certificateCode,
    });
    if (error) return emptyPublicCertificateVerification();
    return parsePublicCertificateVerification(data)
      ?? emptyPublicCertificateVerification();
  } catch {
    return emptyPublicCertificateVerification();
  }
}
