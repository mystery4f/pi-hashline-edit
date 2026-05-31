with open("src/edit.ts", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove imports
content = content.replace('import { applyExactUniqueLegacyReplace } from "./edit-compat";\n', '')
content = content.replace('  computeLegacyEditLineRange,\n', '')

# 2. ITEM_KEYS: remove oldText/newText
content = content.replace(
    'const ITEM_KEYS = new Set(["range", "lines", "oldText", "newText"]);',
    'const ITEM_KEYS = new Set(["range", "lines"]);'
)

# 3. Remove assertEditRequest legacy fallback block
old_block = """    const hasRange = hasOwn(edit, "range");
    const hasOldText = hasOwn(edit, "oldText");
    const hasNewText = hasOwn(edit, "newText");

    // Legacy hidden fallback: { oldText, newText } (substring replace)
    if (hasOldText || hasNewText) {
      if (typeof edit.oldText !== "string") {
        throw new Error(`Edit ${index} requires string "oldText".`);
      }
      if (edit.newText !== null && typeof edit.newText !== "string") {
        throw new Error(`Edit ${index} field "newText" must be a string or null (for deletion).`);
      }
      if (hasRange || hasOwn(edit, "lines")) {
        throw new Error(`Edit ${index} mixes legacy oldText/newText with hashline fields.`);
      }
      continue;
    }

    if (typeof edit.lines === "undefined") {"""

new_block = """    const hasRange = hasOwn(edit, "range");

    if (typeof edit.lines === "undefined") {"""

content = content.replace(old_block, new_block)

# 4. Simplify normalizeEditItems - remove oldText/newText branch
old_norm = """export function normalizeEditItems(edits: Record<string, unknown>[]): HashlineToolEdit[] {
  return edits.map((edit) => {
    if (hasOwn(edit, "oldText") || hasOwn(edit, "newText")) {
      return {
        op: "replace_text",
        oldText: edit.oldText as string,
        newText: (edit.newText ?? "") as string,
      };
    }

    let lines: string[] | string | null = edit.lines as string[] | string | null;"""

new_norm = """export function normalizeEditItems(edits: Record<string, unknown>[]): HashlineToolEdit[] {
  return edits.map((edit) => {
    let lines: string[] | string | null = edit.lines as string[] | string | null;"""

content = content.replace(old_norm, new_norm)

# 5. Remove the pre-check loop in execute
old_precheck = """
      // Pre-validate legacy text replace: oldText must have exactly 1 match
      for (const edit of resolved) {
        if (edit.op === "replace_text") {
          const needle = edit.oldText!;
          let count = 0;
          let idx = 0;
          while ((idx = originalNormalized.indexOf(needle, idx)) !== -1) {
            count++;
            idx += needle.length;
          }
          if (count !== 1) {
            throw new Error(
              `Cannot apply this text replacement. The oldText has ${count} match${count !== 1 ? "es" : ""} in the file (expected exactly 1). Use the hashline format instead: read the file to get LINE#HASH anchors around the lines you want to change, then use { "range": [startAnchor, endAnchor], "lines": [...] }.`,
            );
          }
        }
      }"""

content = content.replace(old_precheck, "")

# 6. Simplify legacyReplace in execute (no more replace_text)
content = content.replace(
    '      const legacyReplace = toolEdits.some((e) => e.op === "replace_text");',
    '      const legacyReplace = false;'
)

# 7. Remove TODO comment about legacy
content = content.replace(
    '//   not express cleanly, such as rejecting mixed camelCase/snake_case legacy keys.\n',
    '//   not express cleanly.\n'
)

with open("src/edit.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
