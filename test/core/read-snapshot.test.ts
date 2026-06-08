import { describe, expect, it } from "vitest";
import {
  setReadSnapshot,
  getReadSnapshot,
  clearReadSnapshot,
  _setReadSnapshotState,
} from "../../src/read-snapshot";
import { buildHashlineFile } from "../../src/hashline";

describe("read-snapshot", () => {
  it("stores and retrieves a snapshot", () => {
    setReadSnapshot("foo.ts", buildHashlineFile("hello\n"));
    const snap = getReadSnapshot("foo.ts");
    expect(snap).toBeDefined();
    expect(snap!.file.content).toBe("hello\n");
  });

  it("returns undefined for a different path", () => {
    setReadSnapshot("foo.ts", buildHashlineFile("hello\n"));
    expect(getReadSnapshot("bar.ts")).toBeUndefined();
  });

  it("overwrites the previous snapshot", () => {
    setReadSnapshot("foo.ts", buildHashlineFile("hello\n"));
    setReadSnapshot("foo.ts", buildHashlineFile("world\n"));
    const snap = getReadSnapshot("foo.ts");
    expect(snap!.file.content).toBe("world\n");
  });

  it("clears the snapshot", () => {
    setReadSnapshot("foo.ts", buildHashlineFile("hello\n"));
    clearReadSnapshot();
    expect(getReadSnapshot("foo.ts")).toBeUndefined();
  });

  it("returns undefined when no snapshot exists", () => {
    clearReadSnapshot();
    expect(getReadSnapshot("foo.ts")).toBeUndefined();
  });

  it("validates path in getter", () => {
    _setReadSnapshotState({ path: "a.ts", file: buildHashlineFile("a\n") });
    const snapA = getReadSnapshot("a.ts");
    expect(snapA).toBeDefined();
    expect(snapA!.file.content).toBe("a\n");
    expect(getReadSnapshot("b.ts")).toBeUndefined();
  });
});
