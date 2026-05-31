# Agent-Driven Edit Tool Test

Create a temporary test file and verify the edit tool's behavior end-to-end. Read the tool output carefully — anchors change after each edit.

**Do not use bash except where explicitly instructed.** All file modifications throughout these tests must go through the `edit` tool unless a scenario specifically tells you to use bash.

---

## Setup

Create `test-file.ts` with this content:

```
import { thing } from "./lib";

function hello() {
  console.log("hello");
}

function goodbye() {
  console.log("goodbye");
}

export { hello, goodbye };
```

---

## Happy Path

### 1. Change one line

Read `test-file.ts`. Find the anchor for `  console.log("hello");` and replace that one line with `  console.log("hi");`.
Afterward, the file should contain `hi` instead of `hello` on that line, and nothing else should have changed.

### 2. Replace several lines

Replace the entire `goodbye` function body (the three lines including the empty line before `export`) with:

```
  console.log("farewell");
  console.log("adios");
}
```

Afterward, the file should contain these three lines where the old `goodbye` function used to be.

### 3. Delete lines

Remove the blank line and the `export` line at the bottom of the file, in one edit.
Afterward, the file should end right after the closing `}` of whichever function is last.

---

## Error Handling

### 4. Stale anchor

Read `test-file.ts`. Then use the bash tool to prepend a comment like `// modified` to the top of the file.
Now attempt an edit using the anchors from your earlier read.

Expected: the edit fails with `[E_STALE_ANCHOR]`. The error includes current anchors for the affected lines. Copy them and retry — the retry should succeed.

### 5. Backwards range

Attempt an edit where the range endpoint anchor comes from an earlier line than the start anchor.
Expected: `[E_BAD_RANGE]` with an explanation.

### 6. Missing fields

Send an edit request with no `path`, or with `edits` omitted.
Expected: a clear error, not a crash.

### 7. LINE#HASH prefix in lines

Read `test-file.ts`, then send an edit where `lines` contains content copied directly from the read output — with `LINE#HASH:` prefixes.
Expected: `[E_INVALID_PATCH]`. The model must strip the prefixes before sending.

### 8. Rendered output in lines

Read `test-file.ts`, then send an edit where `lines` contains content copied directly from the read or diff output — with `LINE#HASH:` prefixes, `+12#A4:` diff-added hashline lines, or `-12    old` diff-context headers.
Expected: `[E_INVALID_PATCH]`. The model must strip display prefixes before sending.

### 9. Overlapping ranges

Send two edits in one request whose ranges overlap. For example, one targeting lines 2–5 and another targeting 4–7.
Expected: rejected with an error about overlapping or conflicting ranges.

---

## Edge Cases

### 6. Insert at start of file

Add new content before the existing first line. For example, prepend a `// Copyright ...` comment.
The original line 1 should still be in the file, just pushed down.

### 7. Insert at end of file

Add new content after the last line. For example, append a blank line and a trailing comment.
The original last line should still be in the file, directly before the new content.

### 8. Read raw then edit

Read `test-file.ts` in raw mode. Then attempt an edit on it.
What happens? (Think about where your anchors come from.)

### 9. Multi-element lines array

Edit a range, placing at least three distinct lines into the `lines` array (not one string with `\n`).
Afterward, all three lines should appear in the file as separate lines.

### 10. Delete one line

Pick any line and remove it from the file in a single edit. Do not replace it with a blank line — the line should be gone.

---

## Cleanup

Delete `test-file.ts` when done.
