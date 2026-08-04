export interface AuthStaticField {
  label: string;
  name: string;
  type?: "email" | "password" | "text" | "textarea";
  readOnly?: boolean;
}

export interface AuthStaticScreen {
  route: string;
  eyebrow: string;
  title: string;
  description: string;
  fields?: readonly AuthStaticField[];
  action?: string;
  notice?: string;
  passwordPolicyHelp?: string;
  accountShell?: boolean;
}

const PASSWORD_POLICY_HELP = "Не менее 12 символов: строчная и заглавная буквы, цифра и специальный символ.";

export const AUTH_STATIC_SCREENS: readonly AuthStaticScreen[] = [
  { route: "/auth/sign-in", eyebrow: "АККАУНТ", title: "Войти в ARCH.START", description: "Вход открывает профиль и персональную оболочку «Мой курс». Сам курс остаётся публичным.", fields: [{ label: "Электронная почта", name: "email", type: "email" }, { label: "Пароль", name: "password", type: "password" }], action: "Войти" },
  { route: "/auth/sign-up", eyebrow: "АККАУНТ", title: "Создать аккаунт", description: "Используйте email и пароль. Перед первым входом потребуется подтвердить почту.", fields: [{ label: "Имя", name: "firstName" }, { label: "Фамилия", name: "lastName" }, { label: "Электронная почта", name: "email", type: "email" }, { label: "Пароль", name: "password", type: "password" }, { label: "Повторите пароль", name: "passwordConfirm", type: "password" }], action: "Создать аккаунт", passwordPolicyHelp: PASSWORD_POLICY_HELP },
  { route: "/auth/check-email", eyebrow: "EMAIL", title: "Проверьте почту", description: "Мы отправили письмо для подтверждения аккаунта.", notice: "Статическая характеристика состояния; письмо не отправлялось." },
  { route: "/auth/forgot-password", eyebrow: "ВОССТАНОВЛЕНИЕ", title: "Сбросить пароль", description: "Ответ страницы не раскрывает, зарегистрирован ли адрес.", fields: [{ label: "Электронная почта", name: "email", type: "email" }], action: "Отправить ссылку" },
  { route: "/auth/update-password", eyebrow: "БЕЗОПАСНОСТЬ", title: "Новый пароль", description: PASSWORD_POLICY_HELP, fields: [{ label: "Новый пароль", name: "password", type: "password" }, { label: "Повторите новый пароль", name: "passwordConfirm", type: "password" }], action: "Обновить пароль", passwordPolicyHelp: PASSWORD_POLICY_HELP },
  { route: "/onboarding", eyebrow: "ПЕРВЫЙ ВХОД", title: "Настроим профиль", description: "Ответьте на один вопрос.", fields: [{ label: "Имя", name: "firstName" }, { label: "Фамилия", name: "lastName" }, { label: "Как вы узнали об ARCH.START?", name: "discoverySource", type: "textarea" }], action: "Завершить настройку" },
  { route: "/profile", eyebrow: "ПРОФИЛЬ", title: "Ваши данные", description: "Email хранится в Auth и показан только для чтения.", fields: [{ label: "Электронная почта", name: "email", type: "email", readOnly: true }, { label: "Имя", name: "firstName" }, { label: "Фамилия", name: "lastName" }, { label: "Как вы узнали об ARCH.START?", name: "discoverySource", type: "textarea" }], action: "Сохранить профиль" },
  { route: "/prototype/a/dashboard", eyebrow: "МОЙ КУРС", title: "Здравствуйте, участник.", description: "Аккаунт подключён. Все восемь модулей курса по-прежнему доступны публично.", notice: "Сохранение прогресса, Quiz и отправка проектов появятся только в Phase 07.", accountShell: true },
];
