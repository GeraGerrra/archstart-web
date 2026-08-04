import Link from "next/link";
import { SelectedAShell } from "@/src/prototypes/selected-a/shell-adapter";
import { signOutAction } from "../actions";

export function AccountDashboard({ firstName, email }: { firstName: string; email: string }) {
  return (
    <SelectedAShell active="dashboard" currentModule="M01">
      <section className="asa-account-dashboard asa-container">
        <header className="asa-account-dashboard__hero">
          <span className="asa-kicker">МОЙ КУРС</span>
          <h1>Здравствуйте, {firstName}.</h1>
          <p>Аккаунт подключён. Все восемь модулей курса по-прежнему доступны публично.</p>
          <div className="asa-actions"><Link className="asa-button asa-button--dark" href="/prototype/a/course">Открыть весь курс</Link><Link className="asa-button asa-button--line" href="/profile">Редактировать профиль</Link></div>
        </header>
        <div className="asa-account-dashboard__grid">
          <section><span className="asa-kicker">ТЕКУЩИЙ ЭТАП</span><h2>Профиль готов</h2><p>Вы вошли как <strong>{email}</strong>. Сохранение прогресса, попыток Quiz и отправка проектов появятся только в Phase 07.</p></section>
          <aside><h2>Честная граница</h2><ul><li>Проценты и серии не вычисляются.</li><li>Результаты Quiz не сохраняются.</li><li>Проекты пока нельзя отправлять на проверку.</li></ul><form action={signOutAction}><button className="asa-button asa-button--line" type="submit">Выйти</button></form></aside>
        </div>
      </section>
    </SelectedAShell>
  );
}
