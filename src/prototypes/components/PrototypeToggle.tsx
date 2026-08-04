"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";

interface PrototypeToggleProps {
  label: string;
  description: string;
}

export function PrototypeToggle({ label, description }: PrototypeToggleProps) {
  const [checked, setChecked] = useState(false);

  return (
    <label className={`prototype-toggle${checked ? " is-checked" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setChecked(event.target.checked)}
      />
      <span className="prototype-toggle__indicator" aria-hidden="true">✓</span>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}
