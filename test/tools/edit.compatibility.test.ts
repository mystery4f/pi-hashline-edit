import { describe, expect, it } from "vitest";
import { readFile } from "fs/promises";
import register from "../../index";
import {
  applyExactUniqueLegacyReplace,
  extractLegacyTopLevelReplace,
} from "../../src/edit-compat";
import { makeFakePiRegistry, withTempFile } from "../support/fixtures";

function getText(result: { content: Array<{ text?: string }> }): string {
  return result.content[0]?.text ?? "";
}

describe("extractLegacyTopLevelReplace", () => {
  it("accepts camelCase top-level legacy payload", () => {
    expect(
      extractLegacyTopLevelReplace({
        path: "a.ts",
        oldText: "before",
        newText: "after",
      }),
    ).toEqual({
      oldText: "before",
      newText: "after",
      strategy: "legacy-top-level-replace",
    });
  });

  it("accepts snake_case top-level legacy payload", () => {
    expect(
      extractLegacyTopLevelReplace({
        path: "a.ts",
        old_text: "before",
        new_text: "after",
      }),
    ).toEqual({
      oldText: "before",
      newText: "after",
      strategy: "legacy-top-level-replace",
    });
  });

  it("accepts legacy payload when edits[] is present but empty", () => {
    expect(
      extractLegacyTopLevelReplace({
        path: "a.ts",
        edits: [],
        oldText: "before",
        newText: "after",
      }),
    ).toEqual({
      oldText: "before",
      newText: "after",
      strategy: "legacy-top-level-replace",
    });
  });

  it("returns null when edits[] contains hashline edits", () => {
    expect(
      extractLegacyTopLevelReplace({
        path: "a.ts",
        edits: [{ range: ["1#abc", "1#abc"], lines: ["after"] }],
        oldText: "before",
        newText: "after",
      }),
    ).toBeNull();
  });

  it("rejects mixed-case legacy payloads", () => {
    expect(
      extractLegacyTopLevelReplace({
        path: "a.ts",
        oldText: "before",
        new_text: "after",
      }),
    ).toBeNull();
  });
});

describe("applyExactUniqueLegacyReplace", () => {
  it("replaces one exact unique occurrence", () => {
    expect(applyExactUniqueLegacyReplace("a\nb\nc", "b", "B")).toEqual({
      content: "a\nB\nc",
      matchCount: 1,
      usedFuzzyMatch: false,
    });
  });

  it("throws when the old text is missing", () => {
    expect(() => applyExactUniqueLegacyReplace("a\nb\nc", "z", "Z")).toThrow(
      /exact or fuzzy match/i,
    );
  });

  it("throws when the old text matches multiple times", () => {
    expect(() =>
      applyExactUniqueLegacyReplace("dup\nmid\ndup", "dup", "X"),
    ).toThrow(/multiple exact matches/i);
  });

  it("falls back to a unique fuzzy match when exact text differs only by Unicode punctuation or trailing space", () => {
    expect(
      applyExactUniqueLegacyReplace("alpha\nhe said \u201Chi\u201D  \nomega", 'he said "hi"', "HELLO"),
    ).toEqual({
      content: "alpha\nHELLO  \nomega",
      matchCount: 1,
      usedFuzzyMatch: true,
    });
  });

  it("throws when fuzzy matching finds multiple candidates", () => {
    expect(() =>
      applyExactUniqueLegacyReplace(
        "he said \u201Chi\u201D\nhe said \u201Chi\u201D",
        'he said "hi"',
        "HELLO",
      ),
    ).toThrow(/multiple fuzzy matches/i);
  });
});

