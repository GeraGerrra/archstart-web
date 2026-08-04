"use client";

import Image from "next/image";
import { useId, useRef } from "react";

interface ImageZoomProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: string;
  rotateToLandscape?: boolean;
  priority?: boolean;
}

export function ImageZoom({
  src,
  alt,
  width,
  height,
  caption,
  rotateToLandscape = false,
  priority = false,
}: ImageZoomProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const captionId = useId();

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  const orientationClass = rotateToLandscape ? " image-zoom__image--rotated" : "";

  return (
    <figure className={`image-zoom${rotateToLandscape ? " image-zoom--rotated" : ""}`}>
      <button
        type="button"
        className="image-zoom__trigger"
        onClick={openDialog}
        aria-label={`Увеличить изображение: ${caption}`}
        aria-describedby={captionId}
      >
        <span className="image-zoom__canvas">
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            className={`image-zoom__image${orientationClass}`}
          />
        </span>
        <span className="image-zoom__action" aria-hidden="true">ОТКРЫТЬ / ZOOM</span>
      </button>
      <figcaption id={captionId}>{caption}</figcaption>

      <dialog ref={dialogRef} className="image-zoom__dialog" aria-label={caption}>
        <div className="image-zoom__dialog-bar">
          <p>{caption}</p>
          <button type="button" className="prototype-button prototype-button--line" onClick={closeDialog}>
            Закрыть
          </button>
        </div>
        <div className={`image-zoom__dialog-canvas${rotateToLandscape ? " is-rotated" : ""}`}>
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            className={`image-zoom__dialog-image${orientationClass}`}
          />
        </div>
      </dialog>
    </figure>
  );
}
