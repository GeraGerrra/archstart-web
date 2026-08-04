import { AUTH_LIMITS } from "./config.ts";

export const PASSWORD_POLICY_COPY_RU = "Не менее 12 символов: строчная и заглавная буквы, цифра и специальный символ.";
export const SUPABASE_ALLOWED_PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\\":|<>?,./`~";

export function validatePasswordPolicy(password: string): string | null {
  const meetsPolicy = password.length >= AUTH_LIMITS.passwordMin
    && /[a-z]/u.test(password)
    && /[A-Z]/u.test(password)
    && /[0-9]/u.test(password)
    && Array.from(password).some((character) => SUPABASE_ALLOWED_PASSWORD_SYMBOLS.includes(character));
  return meetsPolicy ? null : PASSWORD_POLICY_COPY_RU;
}
