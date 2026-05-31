# Changelog

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
