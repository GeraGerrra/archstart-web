import type { Metadata } from "next";
import { PublicCertificateVerificationPage } from "@/src/certificate";
import { loadPublicCertificateVerification } from "@/src/server/certificate-projection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Проверка сертификата — ARCH.START",
  description: "Публичная проверка сертификата о завершении курса ARCH.START.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function PublicCertificatePage({
  params,
}: {
  params: Promise<{ certificateCode: string }>;
}) {
  const { certificateCode } = await params;
  const verification = await loadPublicCertificateVerification(certificateCode);
  return <PublicCertificateVerificationPage verification={verification} />;
}
