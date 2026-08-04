"use client";

import Image from "next/image";
import Link from "next/link";
import { type FocusEvent, useState } from "react";
import type { HomePageViewModel } from "../types";

export interface HomePageProps {
  model: HomePageViewModel;
}

export function HomePage({ model }: HomePageProps) {
  const [activeModuleCode, setActiveModuleCode] = useState<string | null>(null);
  const activeModule = activeModuleCode
    ? model.cutouts.find((module) => module.code === activeModuleCode)
    : undefined;

  return (
    <>
      <section className="asa-home-hero asa-container">
        <div className="asa-home-hero__copy">
          <h1>{model.hero.title}</h1>
          <p className="asa-lead">{model.hero.lead}</p>
          <p className="asa-home-hero__audience">{model.hero.audienceLabel}: {model.hero.audience}</p>
          <div className="asa-actions">
            <Link className="asa-button asa-button--dark" href={model.primaryAction.href}>{model.primaryAction.label}</Link>
            <Link className="asa-button asa-button--line" href={model.secondaryAction.href}>{model.secondaryAction.label}</Link>
          </div>
        </div>
        <div
          className="asa-cutout-field"
          data-home-cutout-stage
          aria-label={model.cutoutStageLabel}
          onPointerLeave={() => setActiveModuleCode(null)}
          onBlur={(event: FocusEvent<HTMLDivElement>) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveModuleCode(null);
          }}
        >
          {model.cutouts.map((module, index) => (
            <Link
              href={module.href}
              key={module.code}
              className={`asa-cutout asa-cutout--${index + 1}`}
              data-module-code={module.code}
              aria-label={`${module.code}: ${module.titleRu}`}
              onPointerEnter={() => setActiveModuleCode(module.code)}
              onFocus={() => setActiveModuleCode(module.code)}
            >
              <Image
                src={module.image.src}
                alt={module.image.alt}
                width={module.image.width}
                height={module.image.height}
                priority={module.image.priority}
              />
              <span className="asa-cutout__mobile-caption">
                <strong>{module.code}</strong>
                <small>{module.mobileTitle}</small>
              </span>
            </Link>
          ))}
          <div className="asa-cutout-field__caption" aria-live="polite">
            {activeModule
              ? `${activeModule.code} — ${activeModule.titleRu}`
              : model.defaultCaption}
          </div>
        </div>
      </section>

      <section className="asa-proof asa-container" aria-label={model.metricsLabel}>
        {model.metrics.map((metric) => (
          <div key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>
        ))}
      </section>

      <section className="asa-home-modules asa-container" aria-labelledby="asa-home-modules-title">
        <header className="asa-section-head">
          <div><h2 id="asa-home-modules-title">{model.moduleListTitle}</h2></div>
          <Link className="asa-text-link" href={model.moduleListAction.href}>{model.moduleListAction.label}</Link>
        </header>
        <ol>
          {model.modules.map((module) => (
            <li key={module.code}>
              <Link href={module.href}>
                <span className="asa-home-modules__code">{module.code}</span>
                <div><strong>{module.titleRu}</strong><small>{module.titleEn}</small></div>
                <span aria-hidden="true">↗</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="asa-output asa-container" aria-labelledby="asa-output-title">
        <div className="asa-output__copy">
          <h2 id="asa-output-title">{model.output.sectionTitle}</h2>
          <h3>{model.output.title}</h3>
          <p>{model.output.description}</p>
          <Link className="asa-text-link" href={model.output.action.href}>{model.output.action.label}</Link>
        </div>
        <button type="button" className="asa-output__image" aria-label={model.output.imageButtonLabel}>
          <Image
            src={model.output.image.src}
            alt={model.output.image.alt}
            width={model.output.image.width}
            height={model.output.image.height}
          />
        </button>
      </section>
    </>
  );
}
