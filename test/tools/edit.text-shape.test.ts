import { describe, expect, it } from "vitest";
import register from "../../index";
import { computeLineHash } from "../../src/hashline";
import { makeFakePiRegistry, withTempFile } from "../support/fixtures";

function getText(result: { content: Array<{ text?: string }> }): string {
  return result.content[0]?.text ?? "";
}

describe("edit tool text shape (token budget)", () => {
  it("returns unified diff in LLM-visible text with line counts in details", async () => {
    await withTempFile("sample.ts", "aaa\nbbb\nccc\n", async ({ cwd }) => {
      const { pi, getTool } = makeFakePiRegistry();
      register(pi);
      const editTool = getTool("edit");
      const bRef = `2#${computeLineHash(2, "bbb")}`;

      const result = await editTool.execute(
        "e1",
        {
          path: "sample.ts",
          edits: [
            {
              range: [bRef, bRef],
              lines: ["BBB"],
            },
          ],
        },
        undefined,
        undefined,
        { cwd } as any,
      );

      const text = getText(result);
      expect(text).toContain(" 1#");
      expect(text).toContain("+2#");
      expect(text).toContain(":BBB");
      expect(text).not.toContain("Updated sample.ts");
      expect(text).not.toContain("Changes: +1 -1");
      expect(text).not.toContain("Diff preview");
      expect(text).not.toContain("Updated anchors");
      expect(result.details?.diff).toContain("+2");
      expect(result.details?.diff).toContain(":BBB");
      expect(result.details?.metrics).toMatchObject({
        added_lines: 1,
        removed_lines: 1,
      });
    });
  });

  it("diff format uses aligned colons", async () => {
    await withTempFile("sample.ts", "aaa\nbbb\nccc\n", async ({ cwd }) => {
      const { pi, getTool } = makeFakePiRegistry();
      register(pi);
      const editTool = getTool("edit");
      const bRef = `2#${computeLineHash(2, "bbb")}`;

      const result = await editTool.execute(
        "e1",
        {
          path: "sample.ts",
          edits: [
            {
              range: [bRef, bRef],
              lines: ["BBB"],
            },
          ],
        },
        undefined,
        undefined,
        { cwd } as any,
      );

      const text = getText(result);
      expect(text).toMatch(/^ 1#\w{2}:aaa$/m);
      expect(text).toMatch(/^\+2#\w{2}:BBB$/m);
      expect(text).toMatch(/^-2   :bbb$/m);
    });
  });

  it("full content details are omitted", async () => {
    await withTempFile("sample.txt", "aaa\nbbb\nccc\n", async ({ cwd }) => {
      const { pi, getTool } = makeFakePiRegistry();
      register(pi);
      const editTool = getTool("edit");
      const bRef = `2#${computeLineHash(2, "bbb")}`;

      const result = await editTool.execute(
        "e1",
        {
          path: "sample.txt",
          edits: [
            {
              range: [bRef, bRef],
              lines: ["BBB"],
            },
          ],
        },
        undefined,
        undefined,
        { cwd } as any,
      );

      const text = getText(result);
      expect(text).not.toContain("Structure outline:");
      expect(result.details?.fullContent).toBeUndefined();
      expect(result.details?.structureOutline).toBeUndefined();
    });
  });

  it("noop returns classification noop", async () => {
    await withTempFile("sample.txt", "aaa\nbbb\nccc\n", async ({ cwd }) => {
      const { pi, getTool } = makeFakePiRegistry();
      register(pi);
      const editTool = getTool("edit");
      const bRef = `2#${computeLineHash(2, "bbb")}`;

      const result = await editTool.execute(
        "e1",
        {
          path: "sample.txt",
          edits: [
            {
              range: [bRef, bRef],
              lines: ["bbb"],
            },
          ],
        },
        undefined,
        undefined,
        { cwd } as any,
      );

      const text = getText(result);
      expect(text).toContain("Classification: noop");
      expect(text).not.toContain("Structure outline:");
    });
  });

  it("returns empty-file hint after deleting all content", async () => {
    await withTempFile("sample.txt", "only\n", async ({ cwd }) => {
      const { pi, getTool } = makeFakePiRegistry();
      register(pi);
      const editTool = getTool("edit");
      const oRef = `1#${computeLineHash(1, "only")}`;

      const result = await editTool.execute(
        "e1",
        {
          path: "sample.txt",
          edits: [
            {
              range: [oRef, oRef],
              lines: [],
            },
          ],
        },
        undefined,
        undefined,
        { cwd } as any,
      );

      const text = getText(result);
      expect(text).toBe(
        "File is empty. Use edit with prepend or append and omit pos to insert content.",
      );
      expect(text).not.toContain("use read");
    });
  });

  it("shows diff even for very long lines", async () => {
    const longLine = "a".repeat(60_000);
    await withTempFile("sample.txt", `before\n${longLine}\nafter\n`, async ({ cwd }) => {
      const { pi, getTool } = makeFakePiRegistry();
      register(pi);
      const editTool = getTool("edit");
      const lRef = `2#${computeLineHash(2, longLine)}`;

      const result = await editTool.execute(
        "e1",
        {
          path: "sample.txt",
          edits: [
            {
              range: [lRef, lRef],
              lines: [`b${longLine.slice(1)}`],
            },
          ],
        },
        undefined,
        undefined,
        { cwd } as any,
      );

      const text = getText(result);
      // Diff always shown; no byte-budget omission
      expect(text).toContain("-2   :");
      expect(text).toContain("+2#");
      expect(text).not.toContain("Anchors omitted");
    });
  });
});
