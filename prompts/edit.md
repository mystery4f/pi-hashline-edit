Patch a UTF-8 text file using `LINE#HASH` anchors copied verbatim from `read`.

Submit one `edit` call per file. All operations go in a single `edits` array; anchors must all come from the same pre-edit read.

Each edit entry replaces an inclusive anchor range:
```json
{ "range": [startAnchor, endAnchor], "lines": [...] }
```
- `range` — `[start, end]` pair of LINE#HASH anchors from the most recent `read`.
  Use the same anchor twice for single-line: `["42#A4", "42#A4"]`.
- `lines` — new content replacing the range (string array). Use `[]` to delete.
  Must be literal file content, not LINE#HASH-prefixed output. Match indentation exactly.

Example:
```json
{ "path": "src/main.ts", "edits": [
  { "range": ["12#3F", "12#3F"], "lines": ["const x = 1;"] },
  { "range": ["20#B2", "25#C7"], "lines": ["function foo() {", "  return 42;", "}"] }
] }

Rules:
- Do not guess, shift, or construct anchors. Copy them from the most recent `read` of this file.
- Do not emit overlapping or adjacent edits — merge them into one.
