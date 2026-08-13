import { Button, StatusMark } from "@/src/design-system";
import type { MyCertificateProjection } from "./types";
import { CertificateIssueControl } from "./CertificateIssueControl";
import { formatCertificateDate, publicCertificatePath } from "./model";

function CertificateMetrics({ projection }: { projection: MyCertificateProjection }) {
  return (
    <dl className="asa-certificate-metrics">
      <div>
        <dt>Уроки</dt>
        <dd>{projection.completedLessons} / {projection.requiredLessons}</dd>
      </div>
      <div>
        <dt>Принятые проекты</dt>
        <dd>{projection.acceptedProjects} / {projection.requiredProjects}</dd>
      </div>
      <div>
        <dt>Имя профиля</dt>
        <dd>{projection.profileNameReady ? "Заполнено" : "Не заполнено"}</dd>
      </div>
    </dl>
  );
}

export function CertificateDashboardCard({
  projection,
}: {
  projection: MyCertificateProjection;
}) {
  const certificate = projection.certificate;

  return (
    <section className="asa-certificate-card" aria-labelledby="dashboard-certificate-title">
      <header className="asa-certificate-card__header">
        <div>
          <span className="asa-kicker">СЕРТИФИКАТ</span>
          <h2 id="dashboard-certificate-title">Сертификат о завершении курса</h2>
        </div>
        {projection.state === "issued" ? (
          <StatusMark status="complete" label="Выпущен" />
        ) : projection.state === "revoked" ? (
          <StatusMark status="locked" label="Отозван" />
        ) : projection.state === "eligible" ? (
          <StatusMark status="available" label="Доступен" />
        ) : projection.state === "locked" ? (
          <StatusMark status="locked" label="Пока недоступен" />
        ) : (
          <StatusMark status="in-progress" label="Проверка недоступна" />
        )}
      </header>

      {projection.state === "unavailable" ? (
        <div className="asa-certificate-card__body">
          <p>Не удалось проверить доступность сертификата. Попробуйте ещё раз позднее.</p>
        </div>
      ) : projection.state === "locked" ? (
        <div className="asa-certificate-card__body">
          <CertificateMetrics projection={projection} />
          <p>Завершите все уроки и получите принятие по всем восьми проектам.</p>
          <div className="asa-certificate-actions">
            {!projection.profileNameReady ? <Button href="/profile">Заполнить профиль</Button> : null}
            <Button href="/course">Открыть весь курс</Button>
          </div>
        </div>
      ) : projection.state === "eligible" ? (
        <div className="asa-certificate-card__body">
          <CertificateMetrics projection={projection} />
          <p>Курс завершён. Сертификат будет выпущен на имя:</p>
          <strong className="asa-certificate-card__name">
            {projection.displayNamePreview ?? "Имя профиля не найдено"}
          </strong>
          <div className="asa-certificate-actions">
            <Button href="/profile">Изменить профиль</Button>
            <CertificateIssueControl />
          </div>
        </div>
      ) : certificate ? (
        <div className="asa-certificate-card__body">
          <dl className="asa-certificate-summary">
            <div><dt>Имя</dt><dd>{certificate.displayName}</dd></div>
            <div><dt>Дата выпуска</dt><dd>{formatCertificateDate(certificate.issuedAt)}</dd></div>
            <div><dt>Код</dt><dd><code>{certificate.certificateCode}</code></dd></div>
          </dl>
          {projection.state === "revoked" ? (
            <p>Публичная запись сохранена, но сертификат больше не является действительным.</p>
          ) : null}
          <div className="asa-certificate-actions">
            <Button href="/certificate" variant="dark">Открыть сертификат</Button>
            <Button href={publicCertificatePath(certificate.certificateCode)}>
              Проверить публичную запись
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
