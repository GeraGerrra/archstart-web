"use client";

import Image from "next/image";
import { type MouseEvent, useRef } from "react";
import type { ImageZoomProps } from "./types";

export function ImageZoom({
  src,
  alt,
  width,
  height,
  caption,
  triggerLabel,
  triggerText,
  closeLabel,
  actions,
  triggerClassName = "asa-example-image",
  dialogClassName = "asa-image-dialog",
}: ImageZoomProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => dialogRef.current?.showModal()} aria-label={triggerLabel}><Image src={src} alt={alt} width={width} height={height} priority /><span>{triggerText}</span></button>
      {actions}
      <dialog className={dialogClassName} ref={dialogRef} onClick={(event: MouseEvent<HTMLDialogElement>) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label={closeLabel}>×</button>
        <Image src={src} alt={alt} width={width} height={height} />
        {caption ? <p>{caption}</p> : null}
      </dialog>
    </>
  );
}
