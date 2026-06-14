/**
 * Fuzzy anchor relocation.
 *
 * When anchors are stale against the live file, we search ±N lines for the
 * original range content and shift both endpoints together. Only accepts a
 * single unique match; rejects on zero or multiple matches.
 */

import {
  type HashlineFile,
  type HashlineEdit,
  computeLineHash,
} from "./hashline";

const OFFSET_SINGLE = 1;
const OFFSET_MULTI = 2;

/**
 * Result shape shared by all matchers (exact, fuzzy, snapshot).
 */
export interface MatchResult {
  matched: HashlineEdit[];
  unmatched: HashlineEdit[];
  warnings: string[];
}

/**
 * Partition edits by hash validity against a file. Edits whose anchor hashes
 * match the file go into `matched`; the rest go into `unmatched`.
 */
export function partitionExact(
  edits: HashlineEdit[],
  file: HashlineFile,
): MatchResult {
  const matched: HashlineEdit[] = [];
  const unmatched: HashlineEdit[] = [];

  for (const edit of edits) {
    const refs = edit.end ? [edit.pos, edit.end] : [edit.pos];
    let ok = true;
    for (const ref of refs) {
      if (ref.line < 1 || ref.line > file.lines.length) {
        ok = false;
        break;
      }
      if (file.lineHashes[ref.line - 1] !== ref.hash) {
        ok = false;
        break;
      }
    }
    if (ok) {
      matched.push(edit);
    } else {
      unmatched.push(edit);
    }
  }

  return { matched, unmatched, warnings: [] };
}

/**
 * Try to relocate stale edits by searching ±MAX_OFFSET lines in the live
 * file for the original range content (obtained from the snapshot). Both
 * endpoints shift by the same offset. Only accepts a single unique match.
 *
 * Relocated anchors receive new hashes computed from the current file's
 * context at the new position.
 */
export function fuzzyMatch(
  edits: HashlineEdit[],
  currentFile: HashlineFile,
  snapshotFile: HashlineFile,
): MatchResult {
  const matched: HashlineEdit[] = [];
  const unmatched: HashlineEdit[] = [];
  const warnings: string[] = [];
  let relocationCount = 0;

  for (const edit of edits) {
    const startLine = edit.pos.line;
    const endLine = edit.end?.line ?? startLine;

    // Original content this edit expects (from snapshot)
    if (
      startLine < 1 ||
      startLine > snapshotFile.lines.length ||
      endLine > snapshotFile.lines.length
    ) {
      unmatched.push(edit);
      continue;
    }
    const originalContent = snapshotFile.lines.slice(startLine - 1, endLine);

    const isSingle = edit.end === undefined || edit.end.line === edit.pos.line;
    const maxOffset = isSingle ? OFFSET_SINGLE : OFFSET_MULTI;

    // Search current file for the exact same content within ±maxOffset
    let bestOffset: number | null = null;

    for (let offset = -maxOffset; offset <= maxOffset; offset++) {
      const newStart = startLine + offset;
      const newEnd = endLine + offset;

      if (newStart < 1 || newEnd > currentFile.lines.length) continue;

      const candidate = currentFile.lines.slice(newStart - 1, newEnd);
      if (originalContent.length !== candidate.length) continue;

      let match = true;
      for (let i = 0; i < originalContent.length; i++) {
        if (originalContent[i] !== candidate[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        if (bestOffset !== null) {
          // Multiple matches — reject
          bestOffset = null;
          break;
        }
        bestOffset = offset;
      }
    }

    if (bestOffset === null) {
      unmatched.push(edit);
      continue;
    }

    // Relocate: shift both anchors by the offset and recompute hashes
    const newStart = startLine + bestOffset;
    const newEnd = endLine + bestOffset;

    const relocated: HashlineEdit = {
      op: edit.op,
      pos: {
        line: newStart,
        hash: computeLineHash(currentFile.lines, newStart - 1),
      },
      end: edit.end
        ? {
            line: newEnd,
            hash: computeLineHash(currentFile.lines, newEnd - 1),
          }
        : undefined,
      lines: edit.lines,
    };

    matched.push(relocated);
    relocationCount++;
  }

  if (relocationCount > 0) {
    warnings.push(
      `[RELOCATED] ${relocationCount} range(s) relocated via fuzzy matching. Please review the diff carefully.`,
    );
  }

  return { matched, unmatched, warnings };
}
