with open("src/edit.ts", "r", encoding="utf-8") as f:
    content = f.read()

# 1. ITEM_KEYS: remove after/before
content = content.replace(
    'const ITEM_KEYS = new Set(["range", "after", "before", "lines", "oldText", "newText"]);',
    'const ITEM_KEYS = new Set(["range", "lines", "oldText", "newText"]);'
)

# 2. Remove hasAfter/hasBefore declarations
content = content.replace(
    '    const hasRange = hasOwn(edit, "range");\n    const hasAfter = hasOwn(edit, "after");\n    const hasBefore = hasOwn(edit, "before");\n    const hasOldText = hasOwn(edit, "oldText");',
    '    const hasRange = hasOwn(edit, "range");\n    const hasOldText = hasOwn(edit, "oldText");'
)

# 3. Remove after/before from mixing check
content = content.replace(
    '      if (hasRange || hasAfter || hasBefore || hasOwn(edit, "lines")) {',
    '      if (hasRange || hasOwn(edit, "lines")) {'
)

# 4. Remove fieldCount check
old_fc = '''    const fieldCount = (hasRange ? 1 : 0) + (hasAfter ? 1 : 0) + (hasBefore ? 1 : 0);
    if (fieldCount > 1) {
      throw new Error(
        `Edit ${index} must specify exactly one of "range", "after", or "before".`,
      );
    }

    if (hasRange) {'''
new_fc = '''    if (hasRange) {'''
content = content.replace(old_fc, new_fc)

# 5. Remove after/before type checks
old_ab = '''    if (hasAfter && edit.after !== undefined && typeof edit.after !== "string") {
      throw new Error(`Edit ${index} field "after" must be an anchor string when provided.`);
    }

    if (hasBefore && edit.before !== undefined && typeof edit.before !== "string") {
      throw new Error(`Edit ${index} field "before" must be an anchor string when provided.`);
    }
  }
}'''
new_ab = '''  }
}'''
content = content.replace(old_ab, new_ab)

# 6. Simplify normalizeEditItems
old_norm = '''    if (hasOwn(edit, "range")) {
      const [pos, end] = edit.range as [string, string];
      return { op: "replace", pos, end, lines };
    }

    if (hasOwn(edit, "after")) {
      const after = edit.after as string;
      return { op: "append", pos: after, lines };
    }

    const before = edit.before as string | undefined;
    return { op: "prepend", pos: before, lines };'''
new_norm = '''    const [pos, end] = edit.range as [string, string];
    return { op: "replace", pos, end, lines };'''
content = content.replace(old_norm, new_norm)

with open("src/edit.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
