# CONTENT ENGINE

## Phase 01 V2 status

Phase 01 Repair A places the complete deterministic parser, normalizer, runtime validators, report writers, and atomic generation entry point inside this portable repository. The reviewed `generated/` tree is no longer dependent on an undocumented external extraction workbench.

The immutable source package remains outside the repository. The engine reads it but never edits, renames, or republishes source binaries.

## Source and output boundaries

- Input: one immutable source root supplied with `--source`.
- Authoritative metadata: exactly five root-level GEN files with exact names.
- Course assets: allowlist and exact aliases only; default deny for every other filename.
- Work output: a sibling temporary directory created by `generateContentAtomic`.
- Commit: `generated/` is replaced only after generation and post-generation validation succeed.
- Public records: `generated/public/`.
- Server-only quiz keys: `generated/server/`.
- Source provenance: `generated/provenance/`.
- Audits and comparisons: `generated/reports/`.

The public manifest contains only authoritative metadata and importable allowlisted or explicitly aliased assets. Files classified `IGNORED_BY_POLICY` remain visible only in development audit reports and never enter the public manifest.

No generated public record stores the absolute source root, a container path, a Windows path, or a OneDrive path.

## Implemented architecture

| Module | Responsibility |
|---|---|
| `scripts/content/generate.ts` | CLI argument handling and atomic generator entry point |
| `scripts/content/validate.ts` | Independent validation of an existing generated tree |
| `src/content-engine/generator.ts` | Deterministic orchestration, normalized entities, reports, snapshot comparison, and atomic replacement |
| `src/content-engine/gen-parsers.ts` | Course Structure, objectives, outcomes, and quiz parsing |
| `src/content-engine/source-policy.ts` | Clean allowlists, default deny, and explicit aliases |
| `src/content-engine/transcript.ts` | Canonical SRPT parsing into ordered `Sxx` sections |
| `src/content-engine/mnot.ts` | Positive public-section parsing and internal prompt exclusion |
| `src/content-engine/vocabulary.ts` | VOCB extraction with page provenance and validation warnings |
| `src/content-engine/docx.ts` | Approved Student Page DOCX public-content parsing |
| `src/content-engine/sanitization.ts` | Non-destructive Office, PDF, PNG, and JPEG publication-risk inspection |
| `src/content-engine/zip.ts` / `xml.ts` | In-repository OOXML ZIP and XML utilities |
| `src/content-engine/types.ts` | Complete normalized TypeScript contracts |
| `src/content-engine/schema.ts` | Runtime validation with actionable field paths |
| `src/content-engine/io.ts` | Stable JSON/CSV writing, hashes, relative provenance, and atomic directory replacement |

## Deterministic generation sequence

1. Require the five GEN files at the exact source-root filenames.
2. Discover source files in deterministic relative-path order.
3. Hash every source file without modifying it.
4. Parse official codes, sequence, and titles from `Course Structure.txt` only.
5. Attach module, lesson, and project objectives/outcomes from their approved GEN files.
6. Parse all 200 quiz questions from `Questions Lessons.txt`.
7. Validate the 8-module, 40-lesson, 8-project, 200-question invariants and five questions per lesson.
8. Classify assets through the clean allowlist or an exact explicit alias; reject duplicate role claims.
9. Normalize supplied M01 SRPT, MNOT, VOCB, and Student Page content.
10. Validate the supplied M03 project aliases as a validation-only sample.
11. Create physically separate public quiz payloads and server-only answer sets.
12. Inspect publication risks non-destructively.
13. Create all required public records, private records, provenance, and reports.
14. Remove ignored/internal evidence from every public-manifest boundary while retaining its audit classification.
15. Run runtime schema checks and public-boundary leak checks.
16. Compare M01 against the accepted pre-repair snapshot when one is supplied.
17. Atomically replace the target `generated/` directory only after every validation passes.

Ordering is explicit at every file-system, entity, report, and serialization boundary. A controlled `generatedAt` value may be supplied for reproducibility tests.

## Commands

Standard repository command:

```bash
pnpm content:generate -- --source /absolute/path/to/ARCHSTART_PHASE_01_INPUT
```

Deterministic comparison run:

```bash
pnpm content:generate -- \
  --source /absolute/path/to/ARCHSTART_PHASE_01_INPUT \
  --generated-at 2026-07-27T00:00:00Z \
  --accepted-snapshot tests/fixtures/accepted-m01-phase01-before-repair-a.json
```

Independent validation:

```bash
pnpm content:validate
```

Useful options:

- `--output <directory>` writes to a different generated-tree target.
- `--accepted-snapshot <file>` selects an explicit M01 comparison baseline.
- `--no-snapshot-compare` disables only the historical snapshot comparison, not schema or security validation.
- `ARCHSTART_SOURCE_ROOT` and `ARCHSTART_GENERATED_AT` are supported for controlled automation.

## Runtime schema boundary

`schema.ts` validates all requested Phase 01 records, including course, module, lesson, project, asset, provenance, transcript, vocabulary, MNOT, Deep Dive, public quiz, server answer set, manifest, pending asset, alias, sanitation, and route-language records.

Validation failures throw `SchemaValidationError` with a concrete path, for example `lesson.assets.PRES.source.sha256`. Malformed normalized data therefore stops generation before the atomic replacement.

## MNOT public boundary

The parser recognizes reviewed English and Russian aliases and numeric section prefixes. It serializes only approved student-facing sections. Internal image-production sections form a hard boundary and are omitted before serialization. A second forbidden-marker scan rejects leakage.

The M01_L01 long internal PNG prompt is exercised during fresh-source automated generation, not only against a committed snapshot.

## Vocabulary extraction

The VOCB PDF remains canonical. `vocabulary.ts` invokes Poppler `pdftotext -tsv`, reconstructs entries from the document geometry, preserves canonical wording, and records `sourcePage` for every accepted entry.

Extraction uncertainty is a validation warning; the engine never invents or paraphrases an entry. The development environment must provide `pdftotext` and `pdfinfo` on `PATH`.

## Quiz security boundary

Public files contain question text, option IDs, option text, and quiz version only. Correct option IDs and explanations are written only to `generated/server/quiz-answer-keys.json`.

Generation and validation scan public quiz payloads for forbidden key names and known answer explanations. The approved source answer-position bias is reported without rewriting the questions.

## Accepted snapshot comparison

The fixture `tests/fixtures/accepted-m01-phase01-before-repair-a.json` is the exact pre-repair accepted M01 snapshot. It is retained only to prove reproducibility and identify semantic differences; it is not a replacement source and is never used to construct normalized records.

The fresh rebuild found two source-grounded vocabulary parser defects in the old snapshot and no unexpected differences. Details are in `generated/reports/m01-snapshot-comparison.json`.

## Generated report set

The generator creates all Phase 01 outputs, including content and size audits, pending/ignored/duplicate assets, exact aliases, sanitation, M01 normalization, M03 alias validation, quiz security, vocabulary extraction, MNOT exclusion, generator run metadata, and the Repair A snapshot comparison.

Generated JSON and CSV files are never manually rewritten.

## Phase 01 Repair B security boundary

The accepted Phase 01 V2 repository preserves the explicit client-safe inspector allowlist, server-only answer-key loader, browser leak scanner and delivery-manifest tooling. The complete dependency-backed acceptance gate passed under the verified official runtime.

## Repair B checkpoint security additions

The development inspector no longer exposes arbitrary files below `generated/`. It uses a default-deny data policy with explicit client-safe roots and selected safe reports only. `generated/server/**` is not an allowed inspector root.

The inspector request pipeline validates decoded pathnames, rejects traversal and backslash paths, checks lexical containment, resolves realpaths, rejects symlink escapes, binds only to `127.0.0.1`, and refuses production startup.

Server-only quiz answer data is loaded through `src/server/quiz-answer-key-loader.ts`, which begins with the `server-only` sentinel. Client-safe barrels intentionally avoid exports from that module or from `generated/server/**`.

The final post-build proof passed in the Phase 01 V2 acceptance run. The browser-facing scan covered `.next/static` and found zero answer-field or canonical-explanation matches.

