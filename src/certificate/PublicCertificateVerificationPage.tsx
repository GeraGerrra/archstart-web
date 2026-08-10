import Link from "next/link";
import { StatusMark } from "@/src/design-system";
import type { PublicCertificateVerification } from "./types";
import { formatCertificateDate } from "./model";

export function PublicCertificateVerificationPage({
  verification,
}: {
  verification: PublicCertificateVerification;
}) {
  if (!verification.found) {
    return (
      <main className="asa-public-certificate-page">
        <Link href="/prototype/a/home" className="asa-public-certificate-page__brand">ARCH.START</Link>
        <section className="asa-public-certificate-record" aria-labelledby="certificate-not-found-title">
          <span className="asa-kicker">ПРОВЕРКА СЕРТИФИКАТА</span>
          <h1 id="certificate-not-found-title">Сертификат не найден</h1>
          <p>Проверьте код или запросите у владельца актуальную ссылку.</p>
        </section>
      </main>
    );
  }

  const revoked = verification.status === "REVOKED";
  return (
    <main className="asa-public-certificate-page">
      <Link href="/prototype/a/home" className="asa-public-certificate-page__brand">ARCH.START</Link>
      <article className="asa-public-certificate-record" aria-labelledby="public-certificate-title">
        <header>
          <div>
            <span className="asa-kicker">ПРОВЕРКА СЕРТИФИКАТА</span>
            <h1 id="public-certificate-title">Certificate of Completion</h1>
          </div>
          <StatusMark
            status={revoked ? "locked" : "complete"}
            label={revoked ? "REVOKED" : "VALID"}
          />
        </header>
        <dl>
          <div><dt>Имя</dt><dd>{verification.displayName}</dd></div>
          <div><dt>Курс</dt><dd>{verification.courseTitle}</dd></div>
          <div><dt>Версия</dt><dd>{verification.courseVersion}</dd></div>
          <div><dt>Дата выпуска</dt><dd>{verification.issuedAt ? formatCertificateDate(verification.issuedAt) : "—"}</dd></div>
          <div><dt>Код</dt><dd><code>{verification.certificateCode}</code></dd></div>
        </dl>
        <p className="asa-certificate-disclaimer">
          Эта запись подтверждает завершение некоммерческого курса ARCH.START и не является
          государственной аккредитацией, университетским кредитом или профессиональной лицензией.
        </p>
      </article>
    </main>
  );
}
