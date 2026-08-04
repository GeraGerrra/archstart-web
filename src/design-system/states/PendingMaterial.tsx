import type { MaterialState } from "../types";
import { joinClassNames } from "../primitives/classNames";

export interface PendingMaterialProps {
  className?: string;
  message: string;
  state?: MaterialState;
}

/** Truthful quiet state for approved material that is pending or unavailable. */
export function PendingMaterial({ className, message, state = "pending" }: PendingMaterialProps) {
  return (
    <div
      className={joinClassNames("asa-material-pending", className)}
      data-material-state={state}
      role="status"
    >
      <p>{message}</p>
    </div>
  );
}
