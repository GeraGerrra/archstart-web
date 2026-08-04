import type { ReactNode } from "react";

export interface MediaLinkAction {
  label: string;
  href: string;
}

export interface VocabularyEntryViewModel {
  number: number;
  termEn: string;
  termRu: string;
  sourcePage: number;
}

export interface VocabularyMaterialViewModel {
  pdfPath: string;
  pageImagePaths: readonly string[];
  pageWidth: number;
  pageHeight: number;
}

export interface VocabularyViewerViewModel {
  lessonCode: string;
  lessonDisplayCode: string;
  entries: readonly VocabularyEntryViewModel[];
  material?: VocabularyMaterialViewModel;
  pendingMaterialMessage: string;
}

export interface VocabularyViewerProps {
  model: VocabularyViewerViewModel;
}

export interface VideoItemViewModel {
  lessonDisplayCode: string;
  lessonTitleRu: string;
  lessonTitleEn: string;
  youtube?: {
    id: string;
    embedUrl: string;
    watchUrl: string;
  };
  pendingMediaMessage: string;
  lectureMaterialsAction: MediaLinkAction;
}

export interface VideoItemProps {
  model: VideoItemViewModel;
}

export interface TranscriptSectionViewModel {
  id: string;
  order: number;
  text: string;
}

export interface LectureSlidesViewModel {
  paths: readonly string[];
  width: number;
  height: number;
  presentationPdfPath?: string;
}

export interface LectureMaterialsViewerViewModel {
  lessonTitleRu: string;
  transcriptSections: readonly TranscriptSectionViewModel[];
  transcriptSectionCount: number;
  slides?: LectureSlidesViewModel;
  pendingMaterialMessage: string;
}

export interface LectureMaterialsViewerProps {
  model: LectureMaterialsViewerViewModel;
}

export interface RevealExampleProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
}

export interface ImageZoomProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  triggerLabel: string;
  triggerText: string;
  closeLabel: string;
  actions?: ReactNode;
  triggerClassName?: string;
  dialogClassName?: string;
}
