import { joinClassNames } from "./classNames";

export interface ProgressBarProps {
  className?: string;
  label: string;
  max: number;
  value: number;
}

/** Native progress element wrapped in the accepted selected-A copy layout. */
export function ProgressBar({ className, label, max, value }: ProgressBarProps) {
  return (
    <div className={joinClassNames("asa-progress", className)} aria-label={label}>
      <div>
        <span>{label}</span>
        <strong>{value} / {max}</strong>
      </div>
      <progress aria-label={label} value={value} max={max}>{value} из {max}</progress>
    </div>
  );
}
