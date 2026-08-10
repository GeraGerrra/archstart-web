import type { CompletionDemoState, CutoutCompletionViewModel } from "@/src/completion";
import type { LearningImage } from "@/src/learning";
import {
  lessonCompletionMessage,
  pathCourse,
  pathModule,
} from "./data";

interface CutoutDimensions {
  width: number;
  height: number;
}

const CANONICAL_CUTOUT_DIMENSIONS: Readonly<CutoutDimensions> = {
  width: 2816,
  height: 1536,
};

interface SelectedACompletionInput {
  kind: "lesson" | "module";
  moduleCode: string;
  state: CompletionDemoState;
  nextAction?: {
    href: string;
    label: string;
  };
}

export function selectedACutout(code: string, priority = false): LearningImage {
  const normalizedCode = code.toUpperCase();
  return {
    src: `/prototype-assets/module-${normalizedCode.toLowerCase()}-cutout.png`,
    alt: "",
    width: CANONICAL_CUTOUT_DIMENSIONS.width,
    height: CANONICAL_CUTOUT_DIMENSIONS.height,
    priority,
  };
}

export function selectedACompletionViewModel({
  kind,
  moduleCode,
  state,
  nextAction,
}: SelectedACompletionInput): CutoutCompletionViewModel {
  const normalizedModuleCode = moduleCode.toUpperCase();
  if (kind === "lesson") {
    return {
      kind,
      segmentCode: normalizedModuleCode,
      cutout: selectedACutout(normalizedModuleCode),
      initialState: state,
      lockedTitle: "Завершение урока",
      lockedMessage: "Завершите обязательные пункты урока. После этого эскиз станет активным.",
      lockedLabel: "Завершение урока пока недоступно",
      beforeTitle: "Вы дошли до конца урока",
      beforeMessage: "Нажмите на эскиз, чтобы отметить урок завершённым.",
      completedTitle: "Урок завершён",
      completedMessage: lessonCompletionMessage,
      actionLabel: "Отметить урок завершённым",
      undoLabel: "Снять отметку",
      nextAction,
    };
  }

  return {
    kind,
    segmentCode: normalizedModuleCode,
    cutout: selectedACutout(normalizedModuleCode),
    initialState: state,
    lockedTitle: "Завершение уроков модуля",
    lockedMessage: "Завершите все пять уроков. Статус проекта учитывается отдельно.",
    lockedLabel: "Отметка уроков модуля пока недоступна",
    beforeTitle: "Все уроки модуля готовы к отметке",
    beforeMessage: `Нажмите на эскиз, чтобы подтвердить завершение уроков ${normalizedModuleCode}.`,
    completedTitle: `Все уроки ${normalizedModuleCode} завершены`,
    completedMessage: "Отметка уроков сохранена. Модуль станет полностью завершённым после принятия проекта.",
    actionLabel: `Подтвердить уроки ${normalizedModuleCode}`,
    undoLabel: "Снять отметку уроков",
    nextAction: normalizedModuleCode === "M08" ? {
      href: pathCourse,
      label: "Вернуться ко всему курсу",
    } : {
      href: pathModule(`M${String(Number.parseInt(normalizedModuleCode.slice(1), 10) + 1).padStart(2, "0")}`),
      label: `Перейти к M${String(Number.parseInt(normalizedModuleCode.slice(1), 10) + 1).padStart(2, "0")}`,
    },
  };
}
