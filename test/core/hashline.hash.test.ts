import { describe, expect, it } from "vitest";
import { applyHashlineEdits, computeLineHash, hashlineParseText } from "../../src/hashline";

describe("computeLineHash", () => {
  it("returns a 2-character hex string", () => {
    const hash = computeLineHash(1, "hello");
    expect(hash).toHaveLength(2);
    expect(hash).toMatch(/^[0-9A-F]{2}$/);
  });

  it("trims trailing whitespace without collapsing internal spaces", () => {
    expect(computeLineHash(1, "a\t")).toBe(computeLineHash(1, "a"));
    expect(computeLineHash(1, "a  b")).not.toBe(computeLineHash(1, "a b"));
  });

  it("strips trailing CR", () => {
    expect(computeLineHash(1, "hello\r")).toBe(computeLineHash(1, "hello"));
  });

  it("always incorporates line index", () => {
    const h1 = computeLineHash(1, "}");
    const h10 = computeLineHash(10, "}");
    expect(h1).toMatch(/^[0-9A-F]{2}$/);
    expect(h10).toMatch(/^[0-9A-F]{2}$/);
  });

  it("produces different hashes for same content at different indices", () => {
    // lineIndex is always incorporated — same content, different position = different hash
    expect(computeLineHash(1, "function foo()")).not.toBe(
      computeLineHash(99, "function foo()"),
    );
  });
});

describe("strict hashline contract", () => {
  it("preserves internal spaces when hashing", () => {
    expect(computeLineHash(1, "a b")).not.toBe(computeLineHash(1, "ab"));
  });

  it("trims trailing spaces when hashing", () => {
    expect(computeLineHash(1, "value  ")).toBe(computeLineHash(1, "value"));
  });

  it("preserves explicit blank trailing line in array input", () => {
    expect(hashlineParseText(["alpha", ""])).toEqual(["alpha", ""]);
  });

  it("rejects stale anchors instead of relocating by hash", () => {
    const content = ["a", "INSERTED", "b", "target", "c"].join("\n");
    const stale = {
      op: "replace",
      pos: { line: 3, hash: computeLineHash(3, "target") },
      lines: ["updated"],
    };

    expect(() => applyHashlineEdits(content, [stale as any])).toThrow(
      /1 stale anchor\./,
    );
  });
});
