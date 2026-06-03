import { describe, expect, it } from "vitest";
import { applyHashlineEdits, computeLineHash, hashlineParseText } from "../../src/hashline";

describe("computeLineHash", () => {
  it("returns a 2-character hex string", () => {
    const hash = computeLineHash(["hello"], 0);
    expect(hash).toHaveLength(2);
    expect(hash).toMatch(/^[0-9A-F]{2}$/);
  });

  it("trims trailing whitespace without collapsing internal spaces", () => {
    expect(computeLineHash(["a\t"], 0)).toBe(computeLineHash(["a"], 0));
    expect(computeLineHash(["a  b"], 0)).not.toBe(computeLineHash(["a b"], 0));
  });

  it("strips trailing CR", () => {
    expect(computeLineHash(["hello\r"], 0)).toBe(computeLineHash(["hello"], 0));
  });

  it("produces same hash for same content with same neighbors", () => {
    const h1 = computeLineHash(["prev", "}", "next"], 1);
    const h2 = computeLineHash(["prev", "}", "next"], 1);
    expect(h1).toBe(h2);
  });
});

describe("strict hashline contract", () => {
  it("preserves internal spaces when hashing", () => {
    expect(computeLineHash(["a b"], 0)).not.toBe(computeLineHash(["ab"], 0));
  });

  it("trims trailing spaces when hashing", () => {
    expect(computeLineHash(["value  "], 0)).toBe(computeLineHash(["value"], 0));
  });

  it("preserves explicit blank trailing line in array input", () => {
    expect(hashlineParseText(["alpha", ""])).toEqual(["alpha", ""]);
  });

  it("rejects stale anchors instead of relocating by hash", () => {
    const fileLines = ["a", "INSERTED", "b", "target", "c"];
    const content = fileLines.join("\n");
    const stale = {
      op: "replace",
      pos: { line: 3, hash: computeLineHash(fileLines, 3) },
      lines: ["updated"],
    };

    expect(() => applyHashlineEdits(content, [stale as any])).toThrow(
      /1 stale anchor: 3#[0-9A-F]+\./,
    );
  });
});
