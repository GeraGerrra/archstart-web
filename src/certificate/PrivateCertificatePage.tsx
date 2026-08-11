import { Button, StatusMark } from "@/src/design-system";
import type { MyCertificateProjection } from "./types";
import { CertificateArtwork } from "./CertificateArtwork";
import { CertificateIssueControl } from "./CertificateIssueControl";
import { CertificatePrintControl } from "./CertificatePrintControl";
import { publicCertificatePath } from "./model";

function RequirementRows({ projection }: { projection: MyCertificateProjection }) {
  return (
    <dl className="asa-certificate-requirements">
      <div><dt>Завершённые уроки</dt><dd>{projection.completedLessons} / {projection.requiredLessons}</dd></div>
      <div><dt>Принятые проекты</dt><dd>{projection.acceptedProjects} / {projection.requiredProjects}</dd></div>
      <div><dt>Имя и фамилия</dt><dd>{projection.profileNameReady ? "Готово" : "Нужно заполнить"}</dd></div>
    </dl>
  );
}

export function PrivateCertificatePage({
  projection,
}: {
  projection: MyCertificateProjection;
}) {
  if (projection.state === "unavailable") {
    return (
      <main className="asa-certificate-page asa-container">
        <span className="asa-kicker">СЕРТИФИКАТ</span>
        <h1>Проверка временно недоступна</h1>
        <p>Не удалось загрузить состояние сертификата. Попробуйте открыть страницу позднее.</p>
        <Button href="/prototype/a/dashboard">Вернуться в «Мой курс»</Button>
      </main>
    );
  }

  if (projection.state === "locked") {
    return (
      <main className="asa-certificate-page asa-container">
        <span className="asa-kicker">СЕРТИФИКАТ</span>
        <h1>Сертификат пока недоступен</h1>
        <p>Сертификат выпускается после завершения всех сорока уроков и принятия восьми проектов.</p>
        <RequirementRows projection={projection} />
        <div className="asa-certificate-actions">
          {!projection.profileNameReady ? <Button href="/profile">Заполнить профиль</Button> : null}
          <Button href="/prototype/a/course" variant="dark">Открыть весь курс</Button>
        </div>
      </main>
    );
  }

  if (projection.state === "eligible") {
    return (
      <main className="asa-certificate-page asa-container">
        <span className="asa-kicker">СЕРТИФИКАТ</span>
        <h1>Сертификат доступен</h1>
        <p>Все условия подтверждены сервером.</p>
        <RequirementRows projection={projection} />
        <section className="asa-certificate-name-confirmation" aria-labelledby="certificate-name-title">
          <h2 id="certificate-name-title">Имя на сертификате</h2>
          <strong>{projection.displayNamePreview ?? "Имя профиля не найдено"}</strong>
          <p>После выпуска имя сохраняется снимком и не меняется вместе с профилем.</p>
          <div className="asa-certificate-actions">
            <Button href="/profile">Изменить профиль</Button>
            <CertificateIssueControl />
          </div>
        </section>
      </main>
    );
  }

  const certificate = projection.certificate;
  if (!certificate) {
    return (
      <main className="asa-certificate-page asa-container">
        <h1>Сертификат временно недоступен</h1>
        <Button href="/prototype/a/dashboard">Вернуться в «Мой курс»</Button>
      </main>
    );
  }

  const revoked = projection.state === "revoked";
  return (
    <main className="asa-certificate-page asa-certificate-page--issued">
      <header className="asa-certificate-page__intro asa-container asa-certificate-no-print">
        <div>
          <span className="asa-kicker">СЕРТИФИКАТ</span>
          <h1>Сертификат о завершении курса</h1>
          <p>
            {revoked
              ? "Сертификат сохранён в истории, но больше не является действительным."
              : "Сертификат готов к печати, сохранению в PDF и публичной проверке."}
          </p>
        </div>
        <StatusMark
          status={revoked ? "locked" : "complete"}
          label={revoked ? "Отозван" : "Действителен"}
        />
      </header>

      <div className="asa-certificate-print-root">
        <CertificateArtwork
          certificateCode={certificate.certificateCode}
          courseTitle={certificate.courseTitle}
          courseVersion={certificate.courseVersion}
          displayName={certificate.displayName}
          issuedAt={certificate.issuedAt}
          status={revoked ? "REVOKED" : "VALID"}
        />
      </div>

      <div className="asa-certificate-page__actions asa-container asa-certificate-no-print">
        <CertificatePrintControl />
        <div className="asa-certificate-actions">
          <Button href="/prototype/a/dashboard">Вернуться в «Мой курс»</Button>
          <Button href={publicCertificatePath(certificate.certificateCode)}>
            Проверить публичную запись
          </Button>
        </div>
      </div>
    </main>
  );
}
