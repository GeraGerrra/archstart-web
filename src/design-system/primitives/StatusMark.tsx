import type { VisualStatus } from "../types";
import { joinClassNames } from "./classNames";

export const VISUAL_STATUS_LABELS: Readonly<Record<VisualStatus, string>> = {
  complete: "Завершён",
  "in-progress": "В процессе",
  available: "Доступен",
  locked: "Закрыт",
};

export interface StatusMarkProps {
  className?: string;
  compact?: boolean;
  label?: string;
  status: VisualStatus;
}

/** Monochrome status dot and optional visible Russian label. */
export function StatusMark({ className, compact = false, label, status }: StatusMarkProps) {
  const resolvedLabel = label ?? VISUAL_STATUS_LABELS[status];
  return (
    <span
      className={joinClassNames(
        "asa-status",
        `asa-status--${status}`,
        compact && "asa-status--compact",
        className,
      )}
      aria-label={resolvedLabel}
    >
      <span aria-hidden="true" className="asa-status__dot" />
      {!compact ? resolvedLabel : null}
    </span>
  );
}
