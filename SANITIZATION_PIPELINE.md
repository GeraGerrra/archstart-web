# SANITIZATION PIPELINE

## Implemented inspection

`src/content-engine/sanitization.ts` performs non-destructive inspection against immutable source assets. It never edits a source file.

Supported inspection paths:

- DOCX and PPTX: in-repository OOXML ZIP inspection;
- PDF: binary safety scan plus Poppler `pdfinfo` metadata inspection;
- PNG: dimensions and metadata-chunk inspection;
- JPEG: dimensions and EXIF/XMP marker inspection.

Where technically available, the report detects:

- author, last-editor, company, manager, and template metadata;
- comments;
- speaker notes;
- hidden slides or hidden content markers;
- local file-system and OneDrive paths;
- external Office relationships and PDF links;
- Canva identifiers;
- embedded production-prompt markers;
- macros, OLE, ActiveX, JavaScript, launch actions, or other active content;
- image metadata requiring review.

Every record includes source provenance, `NON_DESTRUCTIVE` inspection mode, details, warning severity, and publication status.

## Publication rule

Inspection does not make a source binary public. A warning-free scan also does not bypass the manifest and human-review gates.

When a public derivative is needed in a later phase:

1. Read the immutable source.
2. Create the derivative only under `workbench/sanitized/<asset-id>/` or another explicitly isolated work area.
3. Remove only approved metadata, notes, comments, hidden content, path references, identifiers, prompts, or active content.
4. Re-open and re-scan the derivative.
5. Compare visible content against the approved source; sanitation must not rewrite educational text or reconstruct visuals.
6. Record source and derivative hashes.
7. Require human approval before registering the derivative in app-connected storage.

Source files are never overwritten. Internal assets never enter public storage, application manifests, or route trees.
