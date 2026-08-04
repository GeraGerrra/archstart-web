"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  forgotPasswordAction,
  onboardingAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
  updateProfileAction,
} from "../actions";
import { AUTH_LIMITS } from "../config";
import { PASSWORD_POLICY_COPY_RU } from "../password-policy";
import { INITIAL_AUTH_ACTION_STATE, type AuthActionState, type AuthFieldName } from "../types";

interface InitialProfileValues {
  firstName: string;
  lastName: string;
  discoverySource: string;
  email?: string;
}

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <button className="asa-button asa-button--dark" type="submit" disabled={pending}>{pending ? "Сохраняем…" : children}</button>;
}

function FormMessage({ state }: { state: AuthActionState }) {
  return state.message ? <p id="form-message" className="asa-auth__message" role="alert">{state.message}</p> : null;
}

function describedBy(state: AuthActionState, field: AuthFieldName): string | undefined {
  return state.fieldErrors?.[field] ? `${field}-error` : state.message ? "form-message" : undefined;
}

function FieldError({ state, field }: { state: AuthActionState; field: AuthFieldName }) {
  const message = state.fieldErrors?.[field];
  return message ? <span id={`${field}-error`} className="asa-auth__field-error">{message}</span> : null;
}

function passwordDescribedBy(state: AuthActionState, field: "password" | "passwordConfirm"): string {
  return [describedBy(state, field), "password-policy-help"].filter(Boolean).join(" ");
}

export function SignInForm({ next, routeError }: { next: string; routeError?: string }) {
  const [state, action] = useActionState(signInAction, INITIAL_AUTH_ACTION_STATE);
  return (
    <form className="asa-auth-form" action={action} noValidate>
      <input type="hidden" name="next" value={next} />
      {routeError ? <p className="asa-auth__message" role="alert">{routeError}</p> : null}
      <FormMessage state={state} />
      <label><span>Электронная почта</span><input name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby={describedBy(state, "email")} /><FieldError state={state} field="email" /></label>
      <label><span>Пароль</span><input name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(state.fieldErrors?.password)} aria-describedby={describedBy(state, "password")} /><FieldError state={state} field="password" /></label>
      <SubmitButton>Войти</SubmitButton>
      <Link className="asa-text-link" href="/auth/forgot-password">Забыли пароль?</Link>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, INITIAL_AUTH_ACTION_STATE);
  return (
    <form className="asa-auth-form" action={action} noValidate>
      <FormMessage state={state} />
      <div className="asa-auth-form__split">
        <label><span>Имя</span><input name="firstName" autoComplete="given-name" maxLength={AUTH_LIMITS.nameMax} required aria-invalid={Boolean(state.fieldErrors?.firstName)} aria-describedby={describedBy(state, "firstName")} /><FieldError state={state} field="firstName" /></label>
        <label><span>Фамилия</span><input name="lastName" autoComplete="family-name" maxLength={AUTH_LIMITS.nameMax} required aria-invalid={Boolean(state.fieldErrors?.lastName)} aria-describedby={describedBy(state, "lastName")} /><FieldError state={state} field="lastName" /></label>
      </div>
      <label><span>Электронная почта</span><input name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby={describedBy(state, "email")} /><FieldError state={state} field="email" /></label>
      <label><span>Пароль</span><input name="password" type="password" autoComplete="new-password" minLength={AUTH_LIMITS.passwordMin} required aria-invalid={Boolean(state.fieldErrors?.password)} aria-describedby={passwordDescribedBy(state, "password")} /><FieldError state={state} field="password" /><small id="password-policy-help">{PASSWORD_POLICY_COPY_RU}</small></label>
      <label><span>Повторите пароль</span><input name="passwordConfirm" type="password" autoComplete="new-password" minLength={AUTH_LIMITS.passwordMin} required aria-invalid={Boolean(state.fieldErrors?.passwordConfirm)} aria-describedby={passwordDescribedBy(state, "passwordConfirm")} /><FieldError state={state} field="passwordConfirm" /></label>
      <SubmitButton>Создать аккаунт</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, INITIAL_AUTH_ACTION_STATE);
  return <form className="asa-auth-form" action={action} noValidate><FormMessage state={state} /><label><span>Электронная почта</span><input name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby={describedBy(state, "email")} /><FieldError state={state} field="email" /></label><SubmitButton>Отправить ссылку</SubmitButton></form>;
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, INITIAL_AUTH_ACTION_STATE);
  return <form className="asa-auth-form" action={action} noValidate><FormMessage state={state} /><label><span>Новый пароль</span><input name="password" type="password" autoComplete="new-password" minLength={AUTH_LIMITS.passwordMin} required aria-invalid={Boolean(state.fieldErrors?.password)} aria-describedby={passwordDescribedBy(state, "password")} /><FieldError state={state} field="password" /><small id="password-policy-help">{PASSWORD_POLICY_COPY_RU}</small></label><label><span>Повторите новый пароль</span><input name="passwordConfirm" type="password" autoComplete="new-password" minLength={AUTH_LIMITS.passwordMin} required aria-invalid={Boolean(state.fieldErrors?.passwordConfirm)} aria-describedby={passwordDescribedBy(state, "passwordConfirm")} /><FieldError state={state} field="passwordConfirm" /></label><SubmitButton>Обновить пароль</SubmitButton></form>;
}

function ProfileFields({ state, initial, includeEmail = false }: { state: AuthActionState; initial: InitialProfileValues; includeEmail?: boolean }) {
  return <>{includeEmail ? <label><span>Электронная почта</span><input value={initial.email ?? ""} type="email" autoComplete="email" readOnly aria-readonly="true" /></label> : null}<div className="asa-auth-form__split"><label><span>Имя</span><input name="firstName" defaultValue={initial.firstName} autoComplete="given-name" maxLength={AUTH_LIMITS.nameMax} required aria-invalid={Boolean(state.fieldErrors?.firstName)} aria-describedby={describedBy(state, "firstName")} /><FieldError state={state} field="firstName" /></label><label><span>Фамилия</span><input name="lastName" defaultValue={initial.lastName} autoComplete="family-name" maxLength={AUTH_LIMITS.nameMax} required aria-invalid={Boolean(state.fieldErrors?.lastName)} aria-describedby={describedBy(state, "lastName")} /><FieldError state={state} field="lastName" /></label></div><label><span>Как вы узнали об ARCH.START?</span><textarea name="discoverySource" defaultValue={initial.discoverySource} maxLength={AUTH_LIMITS.discoverySourceMax} rows={5} required aria-invalid={Boolean(state.fieldErrors?.discoverySource)} aria-describedby={describedBy(state, "discoverySource")} /><FieldError state={state} field="discoverySource" /><small>До {AUTH_LIMITS.discoverySourceMax} символов.</small></label></>;
}

export function OnboardingForm({ initial }: { initial: InitialProfileValues }) {
  const [state, action] = useActionState(onboardingAction, INITIAL_AUTH_ACTION_STATE);
  return <form className="asa-auth-form" action={action} noValidate><FormMessage state={state} /><ProfileFields state={state} initial={initial} /><SubmitButton>Завершить настройку</SubmitButton></form>;
}

export function ProfileForm({ initial }: { initial: InitialProfileValues }) {
  const [state, action] = useActionState(updateProfileAction, INITIAL_AUTH_ACTION_STATE);
  return <form className="asa-auth-form" action={action} noValidate><FormMessage state={state} /><ProfileFields state={state} initial={initial} includeEmail /><SubmitButton>Сохранить профиль</SubmitButton></form>;
}
