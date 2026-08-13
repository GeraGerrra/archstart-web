#!/usr/bin/env node

import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildSelfContainedStaticCss, staticReviewCompilerOptions } from "../prototypes/static-review-support.mjs";

const require = createRequire(import.meta.url);
const globalRoot = process.env.ARCHSTART_GLOBAL_NODE_MODULES;
const ts = globalRoot ? require(path.join(globalRoot, "typescript")) : require("typescript");
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "../..");
const outputRoot = path.resolve(process.argv[2] ?? path.join(repositoryRoot, "delivery/phase-06-pass-1-auth-profile-onboarding/static-review"));
const compiledRoot = path.join(outputRoot, ".compiled");

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function routeOutput(route) {
  return path.join(outputRoot, route.replace(/^\//u, ""), "index.html");
}

function formHtml(screen) {
  if (!screen.fields?.length) return screen.notice ? `<div class="asa-auth__notice"><p>${escapeHtml(screen.notice)}</p></div>` : "";
  const fields = screen.fields.map((field) => {
    const passwordDescription = field.type === "password" && screen.passwordPolicyHelp ? " aria-describedby=\"password-policy-help\"" : "";
    const control = field.type === "textarea"
      ? `<textarea name="${field.name}" rows="5"></textarea>`
      : `<input name="${field.name}" type="${field.type ?? "text"}"${field.readOnly ? " readonly aria-readonly=\"true\"" : ""}${passwordDescription} />`;
    return `<label><span>${escapeHtml(field.label)}</span>${control}</label>`;
  }).join("");
  const helper = screen.passwordPolicyHelp ? `<small id="password-policy-help">${escapeHtml(screen.passwordPolicyHelp)}</small>` : "";
  return `<form class="asa-auth-form" data-static-only="true">${fields}${helper}<button type="button" class="asa-button asa-button--dark">${escapeHtml(screen.action ?? "Продолжить")}</button></form>`;
}

function screenHtml(screen) {
  const body = screen.accountShell
    ? `<section class="asa-account-dashboard asa-container"><header class="asa-account-dashboard__hero"><span class="asa-kicker">${screen.eyebrow}</span><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.description)}</p><div class="asa-actions"><a class="asa-button asa-button--dark" href="/course">Открыть весь курс</a><a class="asa-button asa-button--line" href="/profile">Редактировать профиль</a></div></header><div class="asa-account-dashboard__grid"><section><h2>Профиль готов</h2><p>${escapeHtml(screen.notice ?? "")}</p></section><aside><h2>Честная граница</h2><p>Проценты, серии, результаты Quiz и статусы проектов не моделируются.</p></aside></div></section>`
    : `<section class="asa-auth asa-container"><div class="asa-auth__intro"><span class="asa-kicker">${screen.eyebrow}</span><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.description)}</p></div><div class="asa-auth__panel">${formHtml(screen)}</div></section>`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(screen.title)} — ARCH.START</title><link rel="stylesheet" href="/styles.css"></head><body><div class="asa" data-renderer-characterization="true"><header class="asa-header"><div class="asa-header__inner"><a class="asa-header__brand asa-wordmark" href="/"><strong>ARCH.START</strong></a><nav class="asa-header__nav" aria-label="Основная навигация"><a href="/">Главная</a><a href="/course">Весь курс</a><a href="/dashboard">Мой курс</a></nav></div></header><main>${body}</main><p class="asa-sr-only">Renderer characterization only; no Supabase session exists.</p></div></body></html>`;
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(compiledRoot, { recursive: true });
const fixtureSource = await readFile(path.join(repositoryRoot, "src/auth/static-fixtures.ts"), "utf8");
const transpiled = ts.transpileModule(fixtureSource, { compilerOptions: staticReviewCompilerOptions(ts), fileName: "src/auth/static-fixtures.ts", reportDiagnostics: true });
const errors = (transpiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
if (errors.length) throw new Error(ts.formatDiagnostics(errors, { getCanonicalFileName: (value) => value, getCurrentDirectory: () => repositoryRoot, getNewLine: () => "\n" }));
const fixtureModule = path.join(compiledRoot, "static-fixtures.cjs");
await writeFile(fixtureModule, transpiled.outputText, "utf8");
const { AUTH_STATIC_SCREENS } = require(fixtureModule);
const css = await buildSelfContainedStaticCss(repositoryRoot, "/* Phase 06 dependency-light renderer characterization only. */");
await writeFile(path.join(outputRoot, "styles.css"), css, "utf8");
for (const screen of AUTH_STATIC_SCREENS) {
  const destination = routeOutput(screen.route);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, screenHtml(screen), "utf8");
}
await rm(compiledRoot, { recursive: true, force: true });
console.log(JSON.stringify({ result: "PASS", typescript: ts.version, screens: AUTH_STATIC_SCREENS.length, outputRoot }, null, 2));
