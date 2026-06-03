import { describe, expect, it } from "vitest";
import { hashlineParseText, parseLineRef, computeLineHash } from "../../src/hashline";

describe("parseLineRef", () => {
  it("parses standard LINE#HASH format", () => {
    const hash = computeLineHash(["hello"], 0);
    const ref = parseLineRef(`5#${hash}`);
    expect(ref).toEqual({ line: 5, hash });
  });

  it("parses with trailing content", () => {
    const ref = parseLineRef("10#A4│  const x = 1;");
    expect(ref).toEqual({ line: 10, hash: "A4" });
  });

  it("tolerates leading >>> markers", () => {
    const ref = parseLineRef(">>> 5#3F│content");
    expect(ref).toEqual({ line: 5, hash: "3F" });
  });

  it("tolerates leading +/- diff markers", () => {
    const hash = computeLineHash(["content"], 0);
    expect(parseLineRef(`+5#${hash}`)).toEqual({ line: 5, hash });
    expect(parseLineRef(`-5#${hash}`)).toEqual({ line: 5, hash });
  });

  it("throws on invalid format", () => {
    expect(() => parseLineRef("invalid")).toThrow(/Invalid line reference/);
  });

  it("diagnoses missing hash", () => {
    expect(() => parseLineRef("12")).toThrow(/missing hash/i);
  });

  it("diagnoses wrong separator", () => {
    expect(() => parseLineRef("5:AB")).toThrow(/Expected "LINE#HASH"/);
  });

  it("diagnoses invalid hash alphabet", () => {
    expect(() => parseLineRef("12#ab")).toThrow(/alphabet 0-9 A-F only/i);
  });

  it("diagnoses invalid hash length", () => {
    expect(() => parseLineRef("12#ABC")).toThrow(/hash must be exactly 2 characters/i);
  });

  it("throws on line 0", () => {
    expect(() => parseLineRef("0#MQ")).toThrow(/must be >= 1/);
  });

  it("prefixes structured errors with [E_BAD_REF]", () => {
    expect(() => parseLineRef("invalid")).toThrow(/^\[E_BAD_REF\]/);
  });
});

describe("hashlineParseText", () => {
  it("returns [] for null", () => {
    expect(hashlineParseText(null)).toEqual([]);
  });

  it("splits string on newline", () => {
    expect(hashlineParseText("a\nb")).toEqual(["a", "b"]);
  });

  it("removes trailing blank line from string input", () => {
    expect(hashlineParseText("a\nb\n")).toEqual(["a", "b"]);
  });

  it("preserves a trailing whitespace-only content line in string input", () => {
    expect(hashlineParseText("a\nb\n  ")).toEqual(["a", "b", "  "]);
  });

  it("passes through array input verbatim", () => {
    const input = ["a", "b"];
    expect(hashlineParseText(input)).toEqual(["a", "b"]);
  });

  it("preserves '# Note:' comment lines (no autocorrection)", () => {
    expect(hashlineParseText(["# Note: important"])).toEqual(["# Note: important"]);
  });

  it("preserves literal '+' prefixed content (no autocorrection)", () => {
    expect(hashlineParseText(["+added"])).toEqual(["+added"]);
  });

  it("returns empty string as a single empty line for blank content", () => {
    expect(hashlineParseText("")).toEqual([""]);
  });

  it("rejects array input that contains LINE#HASH: prefixes", () => {
    expect(() => hashlineParseText(["1#D8│foo", "2#3F│bar"])).toThrow(/^\[E_INVALID_PATCH\]/);
  });

  it("rejects diff-preview hunks with + and context hash prefixes", () => {
    expect(() =>
      hashlineParseText([" 9#3F│keep", "+10#B2│new", " 11#C7│after"]),
    ).toThrow(/^\[E_INVALID_PATCH\]/);
  });

  it("rejects diff-preview deletion rows", () => {
    expect(() =>
      hashlineParseText([" 9#3F│keep", "-10    old", " 11#C7│after"]),
    ).toThrow(/^\[E_INVALID_PATCH\]/);
  });

  it("rejects string-form rendered diff hunks", () => {
    const input = " 9#3F│keep\n-10    old\n+10#B2│new\n 11#C7│after";
    expect(() => hashlineParseText(input)).toThrow(/^\[E_INVALID_PATCH\]/);
  });
});
