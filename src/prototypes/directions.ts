export const DIRECTION_IDS = ["a", "b", "c"] as const;

export type DirectionId = (typeof DIRECTION_IDS)[number];

export type PrototypeSurface = "home" | "dashboard" | "module" | "lesson";

export interface DirectionDefinition {
  id: DirectionId;
  label: "A" | "B" | "C";
  name: string;
  purpose: string;
  balance: string;
  summary: string;
  strengths: readonly string[];
}

export const DIRECTIONS: Record<DirectionId, DirectionDefinition> = {
  a: {
    id: "a",
    label: "A",
    name: "STUDIO PRECISION",
    purpose: "Максимум спокойствия для длинной учебной сессии.",
    balance: "92% workspace / 6% editorial / 2% paper",
    summary: "Самая тихая, компактная и предсказуемая система с минимальным бумажным акцентом.",
    strengths: ["стабильная навигация", "компактные контролы", "минимальная визуальная усталость"],
  },
  b: {
    id: "b",
    label: "B",
    name: "CALM ARCHITECTURAL WORKSPACE",
    purpose: "Баланс эргономики обучения и характера ARCH.START.",
    balance: "82% workspace / 13% editorial / 5% paper",
    summary: "Рекомендуемая середина: сильнее модульная типографика, архитектурные правила и осмысленные эскизы.",
    strengths: ["ясная иерархия", "архитектурная идентичность", "сдержанная бумажная подпись"],
  },
  c: {
    id: "c",
    label: "C",
    name: "ARCHITECTURAL EDITORIAL WORKSPACE",
    purpose: "Максимум award-facing характера без потери читаемости урока.",
    balance: "70% workspace / 20% editorial / 10% paper",
    summary: "Самая выразительная система: крупный масштаб, асимметрия и процессный слой при сохранении учебной структуры.",
    strengths: ["сильная публичная подача", "драматичный масштаб", "видимый процесс проектирования"],
  },
};

export function isDirectionId(value: string): value is DirectionId {
  return DIRECTION_IDS.includes(value as DirectionId);
}

export function prototypePath(
  direction: DirectionId,
  surface: PrototypeSurface,
): string {
  if (surface === "module") {
    return `/prototypes/${direction}/module/m01`;
  }
  if (surface === "lesson") {
    return `/prototypes/${direction}/lesson/m01-l01`;
  }
  return `/prototypes/${direction}/${surface}`;
}
