"use client";

import type { ReactNode } from "react";
import {
  Button,
  PendingMaterial,
  ProgressBar,
  SectionHeading,
  SkipLink,
  StatusMark,
  TextLink,
  VisuallyHidden,
} from "@/src/design-system";
import {
  CourseContentsDrawer,
  Header,
  ModuleMenuPanel,
  ModuleStrip,
  PrimaryNavigation,
} from "@/src/app-shell";
import {
  CourseOverviewPage,
  CourseTree,
  LessonHeader,
  LessonPager,
  ModuleOverviewPage,
  OverviewItem,
  PracticeItem,
  ResourcesItem,
} from "@/src/learning";
import {
  ImageZoom,
  LectureMaterialsViewer,
  RevealExample,
  VideoItem,
  VocabularyViewer,
} from "@/src/media";
import { QuizShell } from "@/src/quiz";
import { CutoutCompletionButton } from "@/src/completion";
import {
  showcaseBrand,
  showcaseCourseOverview,
  showcaseCourseTree,
  showcaseHeaderLabels,
  showcaseLectureAvailable,
  showcaseLecturePending,
  showcaseLessonCompletionComplete,
  showcaseLessonCompletionLocked,
  showcaseLessonCompletionReady,
  showcaseLessonHeader,
  showcaseLessonPager,
  showcaseLongLessonHeader,
  showcaseModuleCompletionComplete,
  showcaseModuleCompletionLocked,
  showcaseModuleCompletionReady,
  showcaseModuleLabels,
  showcaseModuleOverview,
  showcaseModules,
  showcaseNavigationItems,
  showcaseOverview,
  showcasePractice,
  showcaseQuiz,
  showcaseResources,
  showcaseRevealExample,
  showcaseVideoPending,
  showcaseVocabularyAvailable,
  showcaseVocabularyPending,
} from "@/src/prototype-fixtures";

export interface DesignSystemShowcaseProps {
  className?: string;
}

interface ShowcaseSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}

function ShowcaseSection({ id, eyebrow, title, children }: ShowcaseSectionProps) {
  return (
    <section id={id} data-showcase-section aria-labelledby={`${id}-title`}>
      <header data-showcase-section-heading>
        <span>{eyebrow}</span>
        <h2 id={`${id}-title`}>{title}</h2>
      </header>
      <div data-showcase-grid>{children}</div>
    </section>
  );
}

function ShowcaseCard({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <article data-showcase-card data-showcase-wide={wide || undefined}>
      <h3>{title}</h3>
      <div data-showcase-preview>{children}</div>
    </article>
  );
}

export function DesignSystemShowcase({ className }: DesignSystemShowcaseProps) {
  return (
    <div
      className={className ? `asa ${className}` : "asa"}
      data-direction="a"
      data-selected-direction="studio-precision"
      data-design-system-showcase
    >
      <SkipLink href="#design-system-main">Перейти к компонентам</SkipLink>
      <header data-showcase-hero id="overview">
        <p>DEVELOPMENT ONLY · PHASE 03 SOURCE CHECKPOINT</p>
        <h1>ARCH.START Design System</h1>
        <p>Проверочная витрина публичных browser-safe API. Здесь нет аккаунтов, сохранённого прогресса, ключей ответов или production-данных.</p>
      </header>

      <main id="design-system-main">
        <ShowcaseSection id="primitives" eyebrow="01" title="Design-system primitives">
          <ShowcaseCard title="Buttons and links">
            <div data-showcase-row>
              <Button variant="dark">Основное действие</Button>
              <Button variant="line">Линейное действие</Button>
              <Button variant="line" disabled>Недоступно</Button>
              <TextLink href="#states">Текстовая ссылка</TextLink>
            </div>
          </ShowcaseCard>
          <ShowcaseCard title="Status marks">
            <div data-showcase-stack>
              <StatusMark status="complete" />
              <StatusMark status="in-progress" />
              <StatusMark status="available" />
              <StatusMark status="locked" />
            </div>
          </ShowcaseCard>
          <ShowcaseCard title="Progress">
            <ProgressBar label="Демонстрация прогресса" value={2} max={5} />
          </ShowcaseCard>
          <ShowcaseCard title="Section heading">
            <SectionHeading title="Структура раздела" action={<TextLink href="#components">Открыть</TextLink>} />
          </ShowcaseCard>
          <ShowcaseCard title="Pending material">
            <PendingMaterial message="Материал будет добавлен после публикации утверждённого файла." />
          </ShowcaseCard>
          <ShowcaseCard title="Skip and visually hidden">
            <a href="#primitives">Обычная фокусируемая ссылка</a>
            <VisuallyHidden>Скрытая подпись доступна вспомогательным технологиям.</VisuallyHidden>
            <p>SkipLink становится видимым при клавиатурном фокусе.</p>
          </ShowcaseCard>
        </ShowcaseSection>

        <ShowcaseSection id="components" eyebrow="02" title="Application shell and navigation">
          <ShowcaseCard title="Desktop primary navigation" wide>
            <PrimaryNavigation items={showcaseNavigationItems} activeItemId="components" ariaLabel="Демонстрационная основная навигация" />
          </ShowcaseCard>
          <ShowcaseCard title="Header and mobile navigation control" wide>
            <div data-showcase-shell-frame>
              <Header
                brand={showcaseBrand}
                navigationItems={showcaseNavigationItems}
                activeNavigationItemId="components"
                labels={showcaseHeaderLabels}
              />
            </div>
          </ShowcaseCard>
          <ShowcaseCard title="Module strip and open panel" wide>
            <div data-showcase-module-strip>
              <ModuleStrip
                modules={showcaseModules}
                labels={showcaseModuleLabels}
                currentModule="M01"
                forceOpen="M01"
                defaultExpandedMobileModuleCode="M01"
              />
            </div>
          </ShowcaseCard>
          <ShowcaseCard title="Module panel" wide>
            <ModuleMenuPanel
              module={showcaseModules[0]!}
              panelAriaLabelPrefix={showcaseModuleLabels.modulePanelAriaLabelPrefix}
              lessonCountSuffix={showcaseModuleLabels.lessonCountSuffix}
              openLessonLabel={showcaseModuleLabels.openLessonLabel}
              openModuleLabel={showcaseModuleLabels.openModuleLabel}
            />
          </ShowcaseCard>
          <ShowcaseCard title="Mobile navigation and module controls" wide>
            <div data-showcase-mobile-controls>
              <Header
                brand={showcaseBrand}
                navigationItems={showcaseNavigationItems}
                activeNavigationItemId="components"
                labels={showcaseHeaderLabels}
              />
              <ModuleStrip
                modules={showcaseModules}
                labels={showcaseModuleLabels}
                currentModule="M01"
                defaultExpandedMobileModuleCode="M01"
              />
            </div>
          </ShowcaseCard>
          <ShowcaseCard title="Generic Course Contents drawer frame" wide>
            <div data-showcase-drawer-frame>
              <CourseContentsDrawer
                open
                eyebrow="M01 · L01"
                title="Содержание курса"
                ariaLabel="Демонстрационное содержание курса"
                closeLabel="Закрыть содержание курса"
                onClose={() => undefined}
              >
                <CourseTree model={showcaseCourseTree} />
              </CourseContentsDrawer>
            </div>
          </ShowcaseCard>
        </ShowcaseSection>

        <ShowcaseSection id="learning" eyebrow="03" title="Learning surfaces">
          <ShowcaseCard title="Course overview header" wide>
            <CourseOverviewPage model={showcaseCourseOverview} />
          </ShowcaseCard>
          <ShowcaseCard title="Module overview header" wide>
            <ModuleOverviewPage model={showcaseModuleOverview} initialExpandedLessonCode="M01_L01" />
          </ShowcaseCard>
          <ShowcaseCard title="Course tree" wide>
            <CourseTree model={showcaseCourseTree} />
          </ShowcaseCard>
          <ShowcaseCard title="Lesson header" wide>
            <LessonHeader model={showcaseLessonHeader} />
          </ShowcaseCard>
          <ShowcaseCard title="Lesson pager" wide>
            <LessonPager model={showcaseLessonPager} />
          </ShowcaseCard>
          <ShowcaseCard title="Long Russian heading stress case" wide>
            <LessonHeader model={showcaseLongLessonHeader} />
          </ShowcaseCard>
          <ShowcaseCard title="Overview" wide>
            <OverviewItem model={showcaseOverview} />
          </ShowcaseCard>
          <ShowcaseCard title="Practice" wide>
            <PracticeItem model={showcasePractice} />
          </ShowcaseCard>
          <ShowcaseCard title="Resources">
            <ResourcesItem model={showcaseResources} />
          </ShowcaseCard>
        </ShowcaseSection>

        <ShowcaseSection id="media" eyebrow="04" title="Media and reveal">
          <ShowcaseCard title="Vocabulary available" wide>
            <VocabularyViewer model={showcaseVocabularyAvailable} />
          </ShowcaseCard>
          <ShowcaseCard title="Vocabulary pending" wide>
            <VocabularyViewer model={showcaseVocabularyPending} />
          </ShowcaseCard>
          <ShowcaseCard title="Video pending" wide>
            <VideoItem model={showcaseVideoPending} />
          </ShowcaseCard>
          <ShowcaseCard title="Slides and transcript available" wide>
            <LectureMaterialsViewer model={showcaseLectureAvailable} />
          </ShowcaseCard>
          <ShowcaseCard title="Slides and transcript pending" wide>
            <LectureMaterialsViewer model={showcaseLecturePending} />
          </ShowcaseCard>
          <ShowcaseCard title="RevealExample" wide>
            <RevealExample {...showcaseRevealExample} />
          </ShowcaseCard>
          <ShowcaseCard title="ImageZoom" wide>
            <ImageZoom
              {...showcaseRevealExample}
              triggerLabel="Увеличить демонстрационное изображение"
              triggerText="Открыть увеличение"
              closeLabel="Закрыть увеличение"
            />
          </ShowcaseCard>
        </ShowcaseSection>

        <ShowcaseSection id="quiz" eyebrow="05" title="Quiz">
          <ShowcaseCard title="Unanswered public quiz shell" wide>
            <QuizShell model={showcaseQuiz} />
          </ShowcaseCard>
        </ShowcaseSection>

        <ShowcaseSection id="completion" eyebrow="06" title="Completion and deterministic paper fragments">
          <ShowcaseCard title="Lesson locked" wide>
            <CutoutCompletionButton model={showcaseLessonCompletionLocked} />
          </ShowcaseCard>
          <ShowcaseCard title="Lesson ready" wide>
            <CutoutCompletionButton model={showcaseLessonCompletionReady} />
          </ShowcaseCard>
          <ShowcaseCard title="Lesson completed" wide>
            <CutoutCompletionButton model={showcaseLessonCompletionComplete} />
          </ShowcaseCard>
          <ShowcaseCard title="Module locked" wide>
            <CutoutCompletionButton model={showcaseModuleCompletionLocked} />
          </ShowcaseCard>
          <ShowcaseCard title="Module ready" wide>
            <CutoutCompletionButton model={showcaseModuleCompletionReady} />
          </ShowcaseCard>
          <ShowcaseCard title="Module completed" wide>
            <CutoutCompletionButton model={showcaseModuleCompletionComplete} />
          </ShowcaseCard>
          <ShowcaseCard title="Reduced motion contract">
            <p>Анимация фрагментов отключается существующим <code>prefers-reduced-motion</code> media query. JavaScript-переключатель не добавляется.</p>
          </ShowcaseCard>
        </ShowcaseSection>

        <ShowcaseSection id="states" eyebrow="07" title="Empty, pending and unavailable states">
          <ShowcaseCard title="Empty">
            <div role="status" data-showcase-empty><strong>Пока нет элементов</strong><p>Пустое состояние не имитирует сохранённую историю.</p></div>
          </ShowcaseCard>
          <ShowcaseCard title="Pending">
            <PendingMaterial state="pending" message="Компонент ожидает утверждённый публичный материал." />
          </ShowcaseCard>
          <ShowcaseCard title="Unavailable">
            <PendingMaterial state="unavailable" message="Материал недоступен в этом демонстрационном состоянии." />
          </ShowcaseCard>
        </ShowcaseSection>
      </main>
    </div>
  );
}
