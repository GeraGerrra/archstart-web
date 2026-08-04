import Link from "next/link";
import { courseIndex, m01Module, primaryAudience } from "../content";
import type { DirectionId } from "../directions";
import { prototypePath } from "../directions";
import { ImageZoom } from "./ImageZoom";
import { PrototypeShell } from "./PrototypeShell";

interface HomeScreenProps {
  direction: DirectionId;
}

export function HomeScreen({ direction }: HomeScreenProps) {
  const course = courseIndex.course;

  return (
    <PrototypeShell direction={direction} activeSurface="home">
      <section className="home-hero prototype-container">
        <div className="home-hero__copy">
          <span className="prototype-kicker">NONPROFIT EDUCATION / RUSSIAN FIRST</span>
          <h1>Учиться видеть архитектуру как систему решений.</h1>
          <p className="prototype-lead">
            ARCH.START — русскоязычный вводный курс, где пространство читают через пользователя,
            функцию, движение, масштаб, климат, конструкцию и проектное решение.
          </p>
          <p className="home-hero__audience">Для кого: {primaryAudience}</p>
          <div className="prototype-actions">
            <Link className="prototype-button prototype-button--dark" href={prototypePath(direction, "dashboard")}>
              Начать курс
            </Link>
            <Link className="prototype-button prototype-button--line" href={prototypePath(direction, "module")}>
              Открыть M01
            </Link>
          </div>
          <Link className="future-link" href="#future-section" aria-describedby="future-section-note">
            RESEARCH &amp; DEVELOPMENT / EN
            <span id="future-section-note">Будущая секция, ещё не создана</span>
          </Link>
        </div>

        <div className="home-hero__visual">
          <span className="home-hero__visual-code" aria-hidden="true">M01 / P01</span>
          <ImageZoom
            src="/prototype-assets/m01-project-01-preview.png"
            alt="Реальный пример планшета Space Reading Board для проекта M01"
            width={2001}
            height={1125}
            caption="M01 Project 01 / Space Reading Board / sanitized preview"
            priority
          />
        </div>
      </section>

      <section className="course-facts prototype-container" aria-labelledby="course-facts-title">
        <div className="section-heading">
          <span className="prototype-kicker">COURSE SYSTEM</span>
          <h2 id="course-facts-title">Один последовательный архитектурный курс</h2>
        </div>
        <dl className="course-facts__grid">
          <div><dt>{course.moduleCount}</dt><dd>модулей</dd></div>
          <div><dt>{course.lessonCount}</dt><dd>уроков</dd></div>
          <div><dt>{course.projectCount}</dt><dd>модульных проектов</dd></div>
        </dl>
      </section>

      <section className="home-module-preview prototype-container" aria-labelledby="home-module-title">
        <div className="home-module-preview__intro">
          <span className="prototype-kicker">FIRST MODULE / M01</span>
          <h2 id="home-module-title">{m01Module.titleRu}</h2>
          <p className="prototype-subtitle">{m01Module.titleEn}</p>
          <p>{m01Module.goal}</p>
          <Link className="text-link" href={prototypePath(direction, "module")}>Смотреть структуру M01</Link>
        </div>
        <ol className="home-module-preview__outcomes">
          {m01Module.outcomes.map((outcome) => (
            <li key={outcome.order}>
              <span>{String(outcome.order).padStart(2, "0")}</span>
              <div><strong>{outcome.label}</strong><p>{outcome.text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section id="future-section" className="future-section prototype-container" aria-labelledby="future-section-title">
        <span className="prototype-kicker">FUTURE SECTION CONCEPT</span>
        <h2 id="future-section-title">RESEARCH &amp; DEVELOPMENT / EN</h2>
        <p>
          Ссылка показывает будущую архитектуру раздела. Английская секция и исследовательские страницы
          в Phase 02 не реализованы.
        </p>
      </section>
    </PrototypeShell>
  );
}
