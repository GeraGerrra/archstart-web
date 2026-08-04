import Link from "next/link";
import { courseIndex, m01Lesson } from "../content";
import type { DirectionId } from "../directions";
import { prototypePath } from "../directions";
import { PrototypeShell } from "./PrototypeShell";

interface DashboardScreenProps {
  direction: DirectionId;
}

export function DashboardScreen({ direction }: DashboardScreenProps) {
  return (
    <PrototypeShell direction={direction} activeSurface="dashboard">
      <section className="dashboard-hero prototype-container">
        <div>
          <span className="prototype-kicker">DEMO LEARNING STATE / NOT SAVED</span>
          <h1>Продолжить архитектурное мышление</h1>
          <p className="prototype-lead">
            Демонстрационный прогресс нужен только для сравнения интерфейсов A, B и C.
          </p>
        </div>
        <div className="dashboard-progress" aria-label="Демонстрационный прогресс курса: 1 урок из 40">
          <div className="dashboard-progress__number">01<span>/40</span></div>
          <p>урок в демонстрационном состоянии</p>
          <progress value={1} max={40}>1 из 40</progress>
        </div>
      </section>

      <section className="continue-panel prototype-container" aria-labelledby="continue-title">
        <div className="continue-panel__code">M01 · L01</div>
        <div className="continue-panel__copy">
          <span className="prototype-kicker">CONTINUE LEARNING</span>
          <h2 id="continue-title">{m01Lesson.titleRu}</h2>
          <p className="prototype-subtitle">{m01Lesson.titleEn}</p>
          <p>{m01Lesson.objective}</p>
        </div>
        <Link className="prototype-button prototype-button--dark" href={prototypePath(direction, "lesson")}>
          Открыть урок
        </Link>
      </section>

      <section className="dashboard-grid prototype-container">
        <div className="module-map" aria-labelledby="module-map-title">
          <div className="section-heading section-heading--inline">
            <div>
              <span className="prototype-kicker">MODULE MAP</span>
              <h2 id="module-map-title">8 модулей курса</h2>
            </div>
            <span>DEMO / M01 ACTIVE</span>
          </div>
          <ol>
            {courseIndex.modules.map((module) => (
              <li key={module.code} className={module.code === "M01" ? "is-active" : ""}>
                <div className="module-map__code">{module.code}</div>
                <div className="module-map__title">
                  <strong>{module.titleRu}</strong>
                  <span>{module.titleEn}</span>
                </div>
                <div className="module-map__status">
                  {module.code === "M01" ? "1 / 5 · DEMO" : "0 / 5 · DEMO"}
                </div>
                {module.code === "M01" ? (
                  <Link href={prototypePath(direction, "module")} aria-label="Открыть модуль M01">Открыть</Link>
                ) : (
                  <span aria-label="Маршрут модуля не создан в Phase 02">Структура</span>
                )}
              </li>
            ))}
          </ol>
        </div>

        <aside className="recent-placeholder" aria-labelledby="recent-title">
          <span className="prototype-kicker">RECENT LEARNING</span>
          <h2 id="recent-title">Истории пока нет</h2>
          <p>
            Вход, сохранённый прогресс и реальная недавняя активность не реализованы. Здесь показан только
            нейтральный структурный placeholder.
          </p>
          <dl>
            <div><dt>Аккаунт</dt><dd>не подключён</dd></div>
            <div><dt>Синхронизация</dt><dd>не подключена</dd></div>
            <div><dt>Сертификат</dt><dd>не реализован</dd></div>
          </dl>
        </aside>
      </section>
    </PrototypeShell>
  );
}
