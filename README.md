![pi-hashline-edit](assets/banner.jpeg)

# pi-hashline-edit

A [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) extension that replaces the built-in `read` and `edit` tools with a hash-anchored line-editing workflow.

Every line returned by `read` carries a short content hash. Edits reference these hashes instead of raw text, so the tool can detect stale context and reject outdated changes before they reach the file.

Inspired by [oh-my-pi](https://github.com/can1357/oh-my-pi).

## Differences from upstream

This is a fork of the original [pi-hashline-edit](https://github.com/earendil-works/pi-hashline-edit). The core protocol (hash-anchored reads, stale-anchor rejection, atomic writes) is unchanged from upstream. Key differences:

- **Single edit shape.** One entry type: `{ range: [start, end], lines: [...] }`. No `op` field, no `append`/`prepend`/`replace_text` ops, no `after`/`before`. The tuple enforces explicit endpoint anchors, eliminating the common "forgot `end`" failure mode.
- **Standard hex hash alphabet.** `0-9 A-F` instead of `ZPMQVRWSNKTXJBYH`. Hex pairs are more likely to be single tokens.
- **Symmetric boundary-duplication detection.** Runtime warnings catch duplicated boundary lines on both sides of a replacement, not just trailing.
- **`read` raw mode.** `raw: true` returns plain text without `LINE#HASH:` anchors, for reads that don't plan to edit.
- **Inline FNV-1a hashing.** Replaces `xxhashjs` dependency. Always incorporates line index.
- **Minimal prompt surface.** Prompt text describes what the model needs to use the tool; return-format documentation and error catalogues are omitted.
- **No legacy compatibility.** The `{ oldText, newText }` substring-replace format is not accepted. The schema is hashline-only.

## Installation

```bash
# From npm
pi install npm:@jerryan/pi-hashline-edit

# From a local checkout
pi install /path/to/pi-hashline-edit
```

## How It Works

### `read` — tagged line output

Text files are returned with a `LINE#HASH:` prefix on every line. Line numbers may be left-padded within each returned block so the `#HASH:` columns align:

```text
 8#A4:function hello() {
 9#3F:  console.log("world");
10#B2:}
```

- `LINE` — 1-indexed line number.
- `HASH` — 2-character content hash (hex digits `0-9 A-F`).

Optional parameters:
- `offset` — start reading from this line number (1-indexed).
- `limit` — maximum number of lines to return.
- `raw` — when `true`, returns plain text without LINE#HASH anchors. Saves tokens when you don't plan to edit this file.

Images (JPEG, PNG, GIF, WebP) are passed through as attachments and do not participate in the hashline protocol. Binary and directory paths are rejected with a descriptive error.

### `edit` — hash-anchored modifications

Each edit entry replaces an inclusive anchor range:

```json
{
  "path": "src/main.ts",
  "edits": [
    { "range": ["11#3F", "11#3F"], "lines": ["  console.log('hashline');"] },
    { "range": ["42#B2", "45#C7"], "lines": ["function foo() {", "  return 42;", "}"] }
  ]
}
```

- `range` — `[start, end]` pair of LINE#HASH anchors. Use the same anchor twice for single-line.
- `lines` — new content replacing the range (string array). Use `[]` to delete.

All edits in a single call validate against the same pre-edit snapshot and apply bottom-up, so line numbers stay consistent across operations.

### Chained edits

After a successful edit, the response contains a unified diff where context and added lines carry fresh `LINE#HASH` anchors. These can be used directly in the next `edit` call on the same file without a full re-read, provided the next edit targets the same or nearby lines. For distant changes, use `read` first.

### Diff output

Each edit result shows a unified diff with hashline-formatted lines:

```text
 8#A4:function hello() {
-9   :  console.log("world");
+9#B1:  console.log("hashline");
10#B2:}
```

- Context lines: ` NN#HH:content` (space prefix)
- Removed lines: `-NN   :content` (no hash, aligned colon)
- Added lines: `+NN#HH:content` (hash for new anchors)
- Multiple hunks are shown when edits are far apart.

## Design Decisions

- **Stale anchors fail.** A hash mismatch means the file has changed since the last `read`. The error includes a snippet with fresh `LINE#HASH` references for the affected lines for immediate retry.
- **No fallback relocation.** Mismatched anchors are never silently relocated to a "close enough" line. This trades convenience for correctness.
- **Strict patch content.** If `lines` contains `LINE#HASH:` display prefixes or diff `+`/`-` markers, the edit is rejected with `[E_INVALID_PATCH]`. The model must send literal file content; the runtime does not silently strip accidental prefixes.
- **Full-file deletion guardrail.** Edits that would empty a file with more than 50 lines are rejected with `[E_WOULD_EMPTY]`. Small files show the full diff normally; large deletions are almost always mistakes.
- **Atomic writes.** Files are written via temp-file-then-rename to avoid corruption from interrupted writes. Symlink chains are resolved so the target file is updated without replacing the symlink. Hard-linked files are updated in place to preserve the shared inode. File permissions are preserved across atomic renames.
- **Per-file mutation queue.** Edits queue by the canonical write target, so concurrent edits through different symlink paths still serialize onto the same underlying file.
- **Schema-delegated validation.** Field-type and schema validation are the responsibility of pi's AJV layer. The extension's runtime guard only prevents crashes from missing required top-level fields.

## Hashing

Hashes are computed with inline FNV-1a (32-bit, mask-reduced to 8 bits), then mapped to a 2-character hex string from `0-9 A-F`.

The line index is always incorporated into the hash, so identical content on different lines produces different hashes.

## Development

Requires [Node.js](https://nodejs.org) and npm.

```bash
npm install
npm test
```

Set `PI_HASHLINE_DEBUG=1` to show an "active" notification at session start.

## Credits

Thanks to [can1357](https://github.com/can1357) for the original [oh-my-pi](https://github.com/can1357/oh-my-pi) implementation and the hashline concept.

## License

[MIT](LICENSE)
