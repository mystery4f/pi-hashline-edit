import { describe, expect, it } from "vitest";
import { buildHashlineFile } from "../../src/hashline";
import {
  partitionExact,
  fuzzyMatch,
} from "../../src/fuzzy-match";

function makeEdit(
  startLine: number,
  startHash: string,
  endLine?: number,
  endHash?: string,
) {
  return {
    op: "replace" as const,
    pos: { line: startLine, hash: startHash },
    end: endLine !== undefined
      ? { line: endLine, hash: endHash ?? "" }
      : undefined,
    lines: ["REPLACED"],
  };
}

describe("partitionExact", () => {
  it("splits edits by hash match", () => {
    const file = buildHashlineFile("a\nb\nc\n");
    const h1 = file.lineHashes[0]!; // hash of line 1 (a)
    const h2 = file.lineHashes[1]!; // hash of line 2 (b)

    const edit1 = makeEdit(1, h1);
    const edit2 = makeEdit(2, "XX"); // wrong hash
    const edit3 = makeEdit(2, h2);

    const result = partitionExact([edit1, edit2, edit3], file);

    expect(result.matched).toHaveLength(2);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0]!.pos.hash).toBe("XX");
    expect(result.warnings).toEqual([]);
  });

  it("detects OOB as unmatched", () => {
    const file = buildHashlineFile("a\nb\n");
    const edit = makeEdit(5, "XX");
    const result = partitionExact([edit], file);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it("checks both anchors for range edits", () => {
    const file = buildHashlineFile("a\nb\nc\n");
    const h1 = file.lineHashes[0]!;
    const h3 = file.lineHashes[2]!;

    // start ok, end wrong → unmatched
    const badEnd = makeEdit(1, h1, 3, "XX");
    const result = partitionExact([badEnd], file);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });
});

describe("fuzzyMatch", () => {
  it("relocates content shifted down by external insertion", () => {
    // Snapshot (agent's read): a b c d e
    // External inserts X at line 1
    // Current: X a b c d e
    // Agent edit for "c" (line 3 in snapshot, now line 4 in current)
    const snapshot = buildHashlineFile("a\nb\nc\nd\ne\n");
    const current = buildHashlineFile("X\na\nb\nc\nd\ne\n");

    // Create edit for line 3 (c) of the snapshot
    const edit = {
      op: "replace" as const,
      pos: { line: 3, hash: snapshot.lineHashes[2]! },
      lines: ["C"],
    };

    const result = fuzzyMatch([edit], current, snapshot);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]!.pos.line).toBe(4); // c is now at line 4
    expect(result.matched[0]!.pos.hash).toBe(current.lineHashes[3]); // hash from current
    expect(result.unmatched).toHaveLength(0);
    expect(result.warnings).toContain("[RELOCATED] 1 range(s) relocated via fuzzy matching. Please review the diff carefully.");
  });

  it("relocates content shifted up by external deletion", () => {
    // Snapshot: a b c d e
    // External deletes "a"
    // Current: b c d e
    const snapshot = buildHashlineFile("a\nb\nc\nd\ne\n");
    const current = buildHashlineFile("b\nc\nd\ne\n");

    // Edit for line 3 (c) of the snapshot → now line 2 in current
    const edit = {
      op: "replace" as const,
      pos: { line: 3, hash: snapshot.lineHashes[2]! },
      lines: ["C"],
    };

    const result = fuzzyMatch([edit], current, snapshot);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]!.pos.line).toBe(2);
    expect(result.matched[0]!.pos.hash).toBe(current.lineHashes[1]);
    expect(result.unmatched).toHaveLength(0);
  });

  it("rejects when content not found within offset", () => {
    // Snapshot: a b c d e
    // External deletes "c" entirely
    // Current: a b d e
    const snapshot = buildHashlineFile("a\nb\nc\nd\ne\n");
    const current = buildHashlineFile("a\nb\nd\ne\n");

    // Edit for "c" — nowhere to be found
    const edit = {
      op: "replace" as const,
      pos: { line: 3, hash: snapshot.lineHashes[2]! },
      lines: ["C"],
    };

    const result = fuzzyMatch([edit], current, snapshot);

    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it("rejects on multiple matches", () => {
    // Two identical adjacent lines within the single-line search window
    const snapshot = buildHashlineFile("a\nx\nx\nc\n");
    const current = buildHashlineFile("a\nx\nx\nc\n");

    // Edit for line 2 (first x)
    const edit = {
      op: "replace" as const,
      pos: { line: 2, hash: snapshot.lineHashes[1]! },
      lines: ["X"],
    };

    const result = fuzzyMatch([edit], current, snapshot);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it("handles multi-line ranges", () => {
    // Snapshot: a b c d e f
    // External inserts X at top
    // Current: X a b c d e f
    // Agent edits range [b, c, d] (lines 2-4 in snapshot)
    const snapshot = buildHashlineFile("a\nb\nc\nd\ne\nf\n");
    const current = buildHashlineFile("X\na\nb\nc\nd\ne\nf\n");

    const edit = {
      op: "replace" as const,
      pos: { line: 2, hash: snapshot.lineHashes[1]! },
      end: { line: 4, hash: snapshot.lineHashes[3]! },
      lines: ["B", "C", "D"],
    };

    const result = fuzzyMatch([edit], current, snapshot);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]!.pos.line).toBe(3);
    expect(result.matched[0]!.pos.hash).toBe(current.lineHashes[2]);
    expect(result.matched[0]!.end!.line).toBe(5);
    expect(result.matched[0]!.end!.hash).toBe(current.lineHashes[4]);
  });

  it("rejects multi-line when only part matches", () => {
    // Snapshot: a b c d e
    // Current: a b c X e (d replaced by X, so range [b,c,d] can't fully match)
    const snapshot = buildHashlineFile("a\nb\nc\nd\ne\n");
    const current = buildHashlineFile("a\nb\nc\nX\ne\n");

    const edit = {
      op: "replace" as const,
      pos: { line: 2, hash: snapshot.lineHashes[1]! },
      end: { line: 4, hash: snapshot.lineHashes[3]! },
      lines: ["B", "C", "D"],
    };

    const result = fuzzyMatch([edit], current, snapshot);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it("respects file boundaries (won't shift past start)", () => {
    // Snapshot: a b c
    // External deletes "a"
    // Current: b c
    // Edit for "a" (line 1) — can't shift to line 0
    const snapshot = buildHashlineFile("a\nb\nc\n");
    const current = buildHashlineFile("b\nc\n");

    const edit = {
      op: "replace" as const,
      pos: { line: 1, hash: snapshot.lineHashes[0]! },
      lines: ["A"],
    };

    const result = fuzzyMatch([edit], current, snapshot);
    // "a" doesn't exist in current, and can't shift to line 0
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it("respects file boundaries (won't shift past end)", () => {
    // Snapshot: a b c
    // External deletes "c"
    // Current: a b
    // Edit for "c" (line 3) — can't shift past end
    const snapshot = buildHashlineFile("a\nb\nc\n");
    const current = buildHashlineFile("a\nb\n");

    const edit = {
      op: "replace" as const,
      pos: { line: 3, hash: snapshot.lineHashes[2]! },
      lines: ["C"],
    };

    const result = fuzzyMatch([edit], current, snapshot);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it("recomputes correct context hashes at new position", () => {
    // Snapshot: a b c d e
    // External inserts X between b and c → c's prev changes from b to X
    // Current: a b X c d e
    const snapshot = buildHashlineFile("a\nb\nc\nd\ne\n");
    const current = buildHashlineFile("a\nb\nX\nc\nd\ne\n");

    const edit = {
      op: "replace" as const,
      pos: { line: 3, hash: snapshot.lineHashes[2]! },
      lines: ["C"],
    };

    const result = fuzzyMatch([edit], current, snapshot);

    expect(result.matched[0]!.pos.hash).toBe(current.lineHashes[3]);
    expect(result.matched[0]!.pos.hash).not.toBe(snapshot.lineHashes[2]);
  });

  it("relocates at offset 0 when hash changed but content is same", () => {
    // Snapshot: a b c d e
    // External deletes d → b's hash changes (next was c, now d)
    // But line 2 is still 'b' — fuzzy relocates to same line with corrected hash
    const snapshot = buildHashlineFile("a\nb\nc\nd\ne\n");
    const current = buildHashlineFile("a\nb\nd\ne\n");  // c deleted

    const edit = {
      op: "replace" as const,
      pos: { line: 2, hash: snapshot.lineHashes[1]! },
      lines: ["B"],
    };

    const result = fuzzyMatch([edit], current, snapshot);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]!.pos.line).toBe(2);  // same position
    expect(result.matched[0]!.pos.hash).toBe(current.lineHashes[1]);
    expect(result.matched[0]!.pos.hash).not.toBe(snapshot.lineHashes[1]);
  });

  it("relocates at exactly the search boundary (±1 for single-line)", () => {
    // Snapshot: a b c d e f
    // External deletes 'a' → 'b' shifts from line 2 to line 1
    // Edit for 'b' at line 2 → fuzzy finds at offset -1 (exactly ±1 boundary)
    const snapshot = buildHashlineFile("a\nb\nc\nd\ne\nf\n");
    const current = buildHashlineFile("b\nc\nd\ne\nf\n");

    const edit = {
      op: "replace" as const,
      pos: { line: 2, hash: snapshot.lineHashes[1]! },
      lines: ["B"],
    };

    const result = fuzzyMatch([edit], current, snapshot);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]!.pos.line).toBe(1);
    expect(result.unmatched).toHaveLength(0);
  });

  it("resolves multiple stale edits in one batch", () => {
    // Snapshot: a b c d e f g
    // External inserts X at top → lines shift by +1
    // Edits for b, d, f — all stale, all fuzzy-resolved
    const snapshot = buildHashlineFile("a\nb\nc\nd\ne\nf\ng\n");
    const current = buildHashlineFile("X\na\nb\nc\nd\ne\nf\ng\n");

    const editB = {
      op: "replace" as const,
      pos: { line: 2, hash: snapshot.lineHashes[1]! },
      lines: ["B"],
    };
    const editD = {
      op: "replace" as const,
      pos: { line: 4, hash: snapshot.lineHashes[3]! },
      lines: ["D"],
    };
    const editF = {
      op: "replace" as const,
      pos: { line: 6, hash: snapshot.lineHashes[5]! },
      lines: ["F"],
    };

    const result = fuzzyMatch([editB, editD, editF], current, snapshot);

    expect(result.matched).toHaveLength(3);
    expect(result.matched[0]!.pos.line).toBe(3);  // b → line 3
    expect(result.matched[1]!.pos.line).toBe(5);  // d → line 5
    expect(result.matched[2]!.pos.line).toBe(7);  // f → line 7
    expect(result.unmatched).toHaveLength(0);
    expect(result.warnings).toContain("[RELOCATED] 3 range(s) relocated via fuzzy matching. Please review the diff carefully.");
  });

});
