import Link from "next/link";
import type { ReactNode } from "react";
import { DIRECTIONS, prototypePath } from "../directions";
import type { DirectionId, PrototypeSurface } from "../directions";

interface PrototypeShellProps {
  direction: DirectionId;
  activeSurface: PrototypeSurface;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ surface: PrototypeSurface; label: string }> = [
  { surface: "home", label: "Главная" },
  { surface: "dashboard", label: "Курс" },
  { surface: "module", label: "M01" },
  { surface: "lesson", label: "Урок 01" },
];

export function PrototypeShell({ direction, activeSurface, children }: PrototypeShellProps) {
  const definition = DIRECTIONS[direction];

  return (
    <div className={`prototype prototype--${direction}`} data-direction={direction}>
      <a className="skip-link" href="#prototype-main">Перейти к содержанию</a>
      <header className="prototype-header">
        <div className="prototype-header__inner">
          <Link href={prototypePath(direction, "home")} className="prototype-wordmark" aria-label="ARCH.START, главная прототипа">
            <span className="prototype-wordmark__image" aria-hidden="true" />
          </Link>

          <nav className="prototype-header__nav" aria-label="Навигация прототипа">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.surface}
                href={prototypePath(direction, item.surface)}
                aria-current={activeSurface === item.surface ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="prototype-header__meta">
            <span className="prototype-demo-label">PROTOTYPE ONLY</span>
            <span className="prototype-direction-label">
              {definition.label} / {definition.name}
            </span>
            <Link className="prototype-header__review" href="/prototype-review">
              A · B · C
            </Link>
          </div>
        </div>
      </header>

      <main id="prototype-main">{children}</main>

      <footer className="prototype-footer">
        <div>
          <span>ARCH.START</span>
          <p>Некоммерческий русскоязычный курс архитектуры.</p>
        </div>
        <div>
          <p>Визуальный прототип Phase 02. Прогресс не сохраняется.</p>
          <Link href="/prototype-review">Сравнить направления</Link>
        </div>
      </footer>
    </div>
  );
}
