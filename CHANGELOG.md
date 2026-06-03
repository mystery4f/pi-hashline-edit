# Changelog

## 0.7.4 (unreleased)

- **Accept non-UTF-8 text files.** Legacy encodings (CP1251, ANSI, GBK) are no longer rejected as binary. Invalid bytes decode to U+FFFD, matching vanilla pi's built-in read tool. This prevents the model from falling back to raw `sed` edits that bypass hashline's anchor safety.
- **Warn on non-UTF-8 bytes in read.** If the decoded text contains U+FFFD, a warning is appended: `[Non-UTF-8 bytes shown as U+FFFD; editing rewrites the file as UTF-8.]`. Detected on the full file, not just the visible slice, so out-of-view bad bytes still surface.
- **Renamed `prompts/` → `tool-descriptions/`.** Pi discovers `.md` files in `prompts/` as user-invokable templates (`/edit`, `/read`), which was confusing. The new name makes it clear these are internal runtime tool descriptions.
## 0.7.3

- **Content separator changed from `:` to `│` (U+2502).** The `│` character almost never appears in source code or documentation, making accidental inclusion in edit payloads far less likely.
- **Configurable separators.** `ANCHOR_SEP` (`#`) and `CONTENT_SEP` (`│`) are now exported constants from `hashline.ts`, making future changes trivial.
- **Validator catches `HH│` prefix bugs.** The `assertNoDisplayPrefixes` regex now detects `HH│` without requiring a full `LINE#HASH│` prefix, closing the gap where agents were including only the hash+separator.
- **Updated all prompts, docs, and tests** to use the new separator.

## 0.7.2

- **Unified diff output.** Agent and user see identical diff content generated from `structuredPatch` hunks.
- Format: ` NN#HH│context`, `-NN   │removed`, `+NN#HH│added` with aligned separators.
- Removed `--- Anchors ---` blocks; anchors are extracted directly from diff lines.
- Removed `computeAffectedLineRange`, `formatHashlineRegion`, anchor-block Markdown formatting.
- Removed `changed_lines` from metrics (no longer computed).
- **Stale anchor de-duplication.** Single-line range `[4#6B, 4#6B]` now reports "1 stale anchor" instead of "2 stale anchors: 4#6B, 4#6B".
- **Full-file deletion guardrail.** `[E_WOULD_EMPTY]` rejects edits that would delete the entire file, but only for files with more than 50 lines. Small files show the diff normally.

## 0.7.1

- Directory reads include the directory listing in the error, saving a follow-up `ls`.
- Clarify anchors can come from `--- Anchors ---` edit result blocks, not just `read`.
- Fix install command to scoped package name.
- Exclude profiling tests from vitest.

## 0.7.0

### Breaking
- **Single edit shape.** One entry type: `{ range: [start, end], lines: [...] }`. No `op`, `after`, `before`, `append`, `prepend`, `replace_text`.
- **Hex hash alphabet.** `0-9 A-F` replaces `ZPMQVRWSNKTXJBYH`.
- **Inline FNV-1a.** Replaces `xxhashjs` dependency. Always incorporates line index.
- **No legacy compatibility.** `{ oldText, newText }` substring replace format not accepted.
- **Dropped `returnMode`/`returnRanges`.** Only `changed` mode; response format is always anchors block.

### Added
- `read` `raw: true` mode — returns plain text without LINE#HASH anchors.
- `[E_BAD_RANGE]` for backwards `range` tuples.
- Symmetric boundary-duplication detection (both Variant A and B).

### Changed
- `@jerryan/pi-hashline-edit` package name (forked from RimuruW/pi-hashline-edit).
- Minimal prompt surface — removed return-format docs and error catalogues.
- Validation delegated to AJV; runtime guard only prevents crashes from missing required fields.

### Removed
- `op` field, `after`/`before` fields, `replace_text` op.
- `xxhashjs` and `@types/xxhashjs` dependencies.
- Legacy compatibility (`edit-compat.ts`, `compatibility-notify.ts`).
- `returnMode` options `full` and `ranges`.

## 0.6.1

Previous upstream release.
