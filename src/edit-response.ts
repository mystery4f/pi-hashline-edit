/**
 * Edit response builders.
 *
 * Pulled out of `src/edit.ts` execute() so the noop and changed branches
 * are independently testable and the top-level execute path stays narrative.
 *
 * No behaviour change: outputs are byte-identical to the previous inline
 * implementation. The only additive surface is `details.metrics` (Phase 2 C
 * — observability for hosts; the LLM-visible text is unchanged).
 */

import { generateDiffString } from "./edit-diff";
import {
  computeAffectedLineRange,
  formatHashlineRegion,
} from "./hashline";

const CHANGED_ANCHOR_TEXT_BUDGET_BYTES = 50 * 1024;

// ─── Public types ───────────────────────────────────────────────────────

export type EditMetrics = {
  edits_attempted: number;
  edits_noop: number;
  warnings: number;
  classification: "applied" | "noop";
  changed_lines?: { first: number; last: number };
  added_lines?: number;
  removed_lines?: number;
};

// ─── Builder inputs ─────────────────────────────────────────────────────

type NoopEditEntry = {
  editIndex: number;
  loc: string;
  currentContent: string;
};

export interface NoopResponseInput {
  path: string;
  noopEdits: NoopEditEntry[] | undefined;
  originalNormalized: string;
  snapshotId: string;
  editsAttempted: number;
  warnings: string[] | undefined;
}

export interface SuccessResponseInput {
  path: string;
  originalNormalized: string;
  result: string;
  warnings: string[] | undefined;
  firstChangedLine: number | undefined;
  lastChangedLine: number | undefined;
  snapshotId: string;
  editsAttempted: number;
  noopEditsCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getVisibleLines(text: string): string[] {
  if (text.length === 0) return [];
  const lines = text.split("\n");
  return text.endsWith("\n") ? lines.slice(0, -1) : lines;
}

function countDiffLines(diff: string, marker: "+" | "-"): number {
  if (!diff) return 0;
  let count = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith(marker) && !line.startsWith(`${marker}${marker}${marker}`)) {
      count += 1;
    }
  }
  return count;
}

function buildMetrics(args: {
  classification: "applied" | "noop";
  editsAttempted: number;
  noopEditsCount: number;
  warningsCount: number;
  firstChangedLine?: number;
  lastChangedLine?: number;
  addedLines?: number;
  removedLines?: number;
}): EditMetrics {
  const metrics: EditMetrics = {
    edits_attempted: args.editsAttempted,
    edits_noop: args.noopEditsCount,
    warnings: args.warningsCount,
    classification: args.classification,
  };
  if (
    args.classification === "applied" &&
    args.firstChangedLine !== undefined &&
    args.lastChangedLine !== undefined
  ) {
    metrics.changed_lines = {
      first: args.firstChangedLine,
      last: args.lastChangedLine,
    };
  }
  if (args.addedLines !== undefined) metrics.added_lines = args.addedLines;
  if (args.removedLines !== undefined) metrics.removed_lines = args.removedLines;
  return metrics;
}

function warningsBlockOf(warnings: string[] | undefined): string {
  return warnings?.length ? `\n\nWarnings:\n${warnings.join("\n")}` : "";
}

// ─── Builders ───────────────────────────────────────────────────────────

export function buildNoopResponse(input: NoopResponseInput): ToolResult {
  const {
    path,
    noopEdits,
    snapshotId,
    editsAttempted,
    warnings,
  } = input;

  const noopDetailsText = noopEdits?.length
    ? noopEdits
        .map(
          (edit) =>
            `Edit ${edit.editIndex}: replacement for ${edit.loc} is identical to current content:\n  ${edit.loc}: ${edit.currentContent}`,
        )
        .join("\n")
    : "The edits produced identical content.";

  const text = `No changes made to ${path}\nClassification: noop\n${noopDetailsText}`;

  const metrics = buildMetrics({
    classification: "noop",
    editsAttempted,
    noopEditsCount: noopEdits?.length ?? 0,
    warningsCount: warnings?.length ?? 0,
  });

  return {
    content: [{ type: "text", text }],
    details: {
      diff: "",
      firstChangedLine: undefined,
      snapshotId,
      classification: "noop" as const,
      metrics,
    },
  };
}

export function buildChangedResponse(input: SuccessResponseInput): ToolResult {
  const {
    result,
    warnings,
    firstChangedLine,
    lastChangedLine,
    snapshotId,
    originalNormalized,
    editsAttempted,
    noopEditsCount,
  } = input;

  const diffResult = generateDiffString(originalNormalized, result);
  const addedLines = countDiffLines(diffResult.diff, "+");
  const removedLines = countDiffLines(diffResult.diff, "-");
  const warningsBlock = warningsBlockOf(warnings);

  const resultLines = getVisibleLines(result);
  const anchorRange = computeAffectedLineRange({
    firstChangedLine,
    lastChangedLine,
    resultLineCount: resultLines.length,
  });
  const anchorsBlock = anchorRange
    ? (() => {
        const region = resultLines.slice(anchorRange.start - 1, anchorRange.end);
        const formatted = formatHashlineRegion(region, anchorRange.start);
        const block = `--- Anchors ${anchorRange.start}-${anchorRange.end} ---\n${formatted}`;
        return Buffer.byteLength(block, "utf8") <= CHANGED_ANCHOR_TEXT_BUDGET_BYTES
          ? block
          : "Anchors omitted; use read for subsequent edits.";
      })()
    : resultLines.length === 0
      ? "File is empty. Use edit with prepend or append and omit pos to insert content."
      : "Anchors omitted; use read for subsequent edits.";

  const text = [anchorsBlock, warningsBlock.trimStart()]
    .filter((section) => section.length > 0)
    .join("\n\n");

  const metrics = buildMetrics({
    classification: "applied",
    editsAttempted,
    noopEditsCount,
    warningsCount: warnings?.length ?? 0,
    firstChangedLine,
    lastChangedLine,
    addedLines,
    removedLines,
  });

  return {
    content: [{ type: "text", text }],
    details: {
      diff: diffResult.diff,
      firstChangedLine: firstChangedLine ?? diffResult.firstChangedLine,
      snapshotId,
      metrics,
    },
  };
}

// Local shape — pi-coding-agent does not export a public `ToolResult`. The
// builders return `details` as `any` so callers can keep their own per-tool
// details type without re-asserting it here. This file intentionally does
// not import the agent's tool-result type to stay decoupled from internals.
type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  details: any;
};
