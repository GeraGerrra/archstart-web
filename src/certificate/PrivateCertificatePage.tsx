import { Button, StatusMark } from "@/src/design-system";
import type { MyCertificateProjection } from "./types";
import { CertificateIssueControl } from "./CertificateIssueControl";
import { formatCertificateDate, publicCertificatePath } from "./model";

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
    <main className="asa-certificate-page asa-container">
      <header className="asa-certificate-page__intro">
        <div>
          <span className="asa-kicker">ТЕХНИЧЕСКИЙ ПРОСМОТР</span>
          <h1>Сертификат о завершении курса</h1>
          <p>Функциональная версия. Финальная визуальная композиция будет утверждена отдельно.</p>
        </div>
        <StatusMark
          status={revoked ? "locked" : "complete"}
          label={revoked ? "Отозван" : "Действителен"}
        />
      </header>

      <article className={`asa-certificate-document${revoked ? " asa-certificate-document--revoked" : ""}`}>
        <span className="asa-certificate-document__brand">ARCH.START</span>
        <p className="asa-certificate-document__type">CERTIFICATE OF COMPLETION</p>
        <h2>{certificate.displayName}</h2>
        <p>завершил(а) некоммерческий образовательный курс</p>
        <h3>{certificate.courseTitle}</h3>
        <dl>
          <div><dt>Дата выпуска</dt><dd>{formatCertificateDate(certificate.issuedAt)}</dd></div>
          <div><dt>Версия курса</dt><dd>{certificate.courseVersion}</dd></div>
          <div><dt>Код сертификата</dt><dd><code>{certificate.certificateCode}</code></dd></div>
        </dl>
        {revoked ? <strong className="asa-certificate-document__revoked">REVOKED</strong> : null}
      </article>

      <p className="asa-certificate-disclaimer">
        Сертификат подтверждает завершение некоммерческого образовательного курса ARCH.START.
        Он не является государственной аккредитацией, университетским кредитом,
        профессиональной лицензией или официальной квалификацией архитектора.
      </p>

      <div className="asa-certificate-actions">
        <Button href="/prototype/a/dashboard">Вернуться в «Мой курс»</Button>
        <Button href={publicCertificatePath(certificate.certificateCode)} variant="dark">
          Проверить публичную запись
        </Button>
      </div>
    </main>
  );
}
