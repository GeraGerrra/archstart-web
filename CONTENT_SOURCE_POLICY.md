# CONTENT SOURCE POLICY

## Immutable source rule

The Phase 01 source package is evidence, not a working directory. The generator may read and hash source files, but it must never edit, rename, overwrite, sanitize in place, or copy unreviewed source binaries into application-connected public storage.

Generated records and reports are written only under a separate target directory.

## Authoritative global metadata

Only these exact root-level filenames are authoritative:

- `Course Structure.txt`
- `Lessons Obj.txt`
- `Modules Obj.txt`
- `Projects Obj.txt`
- `Questions Lessons.txt`

The lookup is exact and case-sensitive at the source root. No recursive fallback, fuzzy matching, duplicate selection, or similarly named substitute is allowed.

`Course Structure.txt` alone controls official codes, order, Russian titles, and English titles. The remaining files supply only their approved objective, outcome, or quiz roles.

## Lesson allowlist

Only these filename roles are recognized:

- `Mxx_Lxx_PRES.pptx`
- `Mxx_Lxx_SRPT.txt`
- `Mxx_Lxx_VOCB.pdf`
- `Mxx_Lxx_MNOT.txt`
- optional `Mxx_Lxx_PICE.png`

INFO is intentionally excluded and is never reported as missing. A missing PICE remains `PICE_PENDING`; PRES, combined PDFs, generated graphics, CSS, SVG, and canvas cannot replace it.

## Project allowlist

Only these core roles are recognized:

- `ARCH.START_Mxx_Projectxx_Student_Page.docx`
- `Mxx_Pxx_PPTX.pptx`
- an explicitly approved preview PNG/JPG registration

M01–M07 retain `SINGLE_BOARD`; M08 retains `MULTI_PAGE_PACK`.

Internal Packages, OEXA, unspecified project documents, old board versions, and production evidence are excluded from public records and app-connected storage.

## Exact aliases

Aliases are static registrations in `source-policy.ts`; no suffix guessing or edit-distance matching exists.

Approved Phase 01 registrations include:

- `ARCH.START_M01_Project01_Student_Page_V2.docx` to canonical M01_P01 Student Page;
- `ARCH.START_M03_Project03_Student_Page (1).docx` to canonical M03_P03 Student Page;
- `M03_P03_PPTX (1).pptx` to canonical M03_P03 example PPTX.

Reports preserve the source filename for audit traceability, while public records use only the canonical filename. The two M03 files remain validation-only and do not import M03 or alter official order.

## Default deny

Every unregistered file becomes `IGNORED_BY_POLICY`. It is not treated as missing, reconstructed, requested, or published automatically.

Ignored files are recorded only in development audit and sanitation reports. They are excluded from `generated/public/content-manifest.json`, normalized public records, route data, application storage registrations, and public asset directories.

Explicit exclusions include INFO, Internal Package, OEXA, MP4, combined `mxxfull` files, audit archives, and unknown filenames.

## Combined PDFs

A combined module PDF may become an optional booklet only through an explicit future manifest registration. It cannot determine lesson order, supply lesson text, or replace PICE.

## Public MNOT boundary

Only approved public sections are normalized. Image-generation prompts, Chinese generation instructions, canvas/font/composition rules, negative prompts, and internal production notes are excluded through reviewed heading aliases, section boundaries, and forbidden-marker validation.

## Status semantics

The engine distinguishes:

- `PENDING_NOT_SUPPLIED_IN_THIS_PHASE`;
- unexpectedly absent content inside a declared complete package;
- `PICE_PENDING`, `VIDEO_PENDING`, and `CAPTIONS_PENDING`;
- `ALIAS_RESOLVED`;
- `IGNORED_BY_POLICY`;
- `INVALID`;
- `DUPLICATE`;
- `SANITIZATION_REQUIRED`.

M02–M08 lesson assets are not called missing merely because Phase 01 intentionally supplied only M01 as the complete lesson sample.
