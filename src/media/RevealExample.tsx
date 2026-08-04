"use client";

import Image from "next/image";
import { type CSSProperties, useId, useState } from "react";
import { Button, VisuallyHidden } from "@/src/design-system";
import { ImageZoom } from "./ImageZoom";
import type { RevealExampleProps } from "./types";

export function RevealExample({ src, alt, width, height, caption }: RevealExampleProps) {
  const [revealed, setRevealed] = useState(false);
  const contentId = useId();
  const liveId = useId();
  const revealStyle = { "--reveal-aspect": `${width} / ${height}` } as CSSProperties;

  return (
    <div className={`asa-reveal-example${revealed ? " is-revealed" : ""}`} style={revealStyle}>
      {!revealed ? (
        <div className="asa-reveal-example__veil" id={contentId}>
          <div className="asa-reveal-example__blur" aria-hidden="true">
            <Image src={src} alt="" width={width} height={height} />
          </div>
          <div className="asa-reveal-example__gate">
            <p>Сначала попробуйте выполнить задание самостоятельно. Затем откройте пример для сравнения.</p>
            <Button
              type="button"
              variant="line"
              aria-expanded={revealed}
              aria-controls={contentId}
              onClick={() => setRevealed(true)}
            >
              Посмотреть пример
            </Button>
          </div>
        </div>
      ) : (
        <div className="asa-reveal-example__revealed" id={contentId}>
          <ImageZoom
            src={src}
            alt={alt}
            width={width}
            height={height}
            caption={caption}
            triggerLabel="Увеличить пример"
            triggerText="Открыть крупнее ↗"
            closeLabel="Закрыть увеличенное изображение"
            actions={(
              <div className="asa-reveal-example__actions">
                <Button
                  type="button"
                  variant="line"
                  aria-expanded={revealed}
                  aria-controls={contentId}
                  onClick={() => setRevealed(false)}
                >
                  Скрыть пример
                </Button>
              </div>
            )}
          />
        </div>
      )}
      <VisuallyHidden as="p" id={liveId} aria-live="polite">
        {revealed ? "Пример открыт для сравнения." : "Пример скрыт."}
      </VisuallyHidden>
    </div>
  );
}
