with open("src/edit.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Fix import: remove extractLegacyTopLevelReplace, add normalizeEditItems
old_import = """import {
  applyExactUniqueLegacyReplace,
  extractLegacyTopLevelReplace,
} from "./edit-compat";"""
new_import = """import { applyExactUniqueLegacyReplace } from "./edit-compat";"""
content = content.replace(old_import, new_import)

# Fix computeEditPreview
old_preview = """export async function computeEditPreview(
  request: unknown,
  cwd: string,
): Promise<EditPreview> {
  try {
    assertEditRequest(request);
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  const params = request as EditRequestParams;
  const path = params.path;
  const absolutePath = resolveToCwd(path, cwd);
  const toolEdits = Array.isArray(params.edits) ? params.edits : [];
  const legacy = extractLegacyTopLevelReplace(params as Record<string, unknown>);

  if (toolEdits.length === 0 && !legacy) {
    return { error: "No edits provided." };
  }

  try {
    await fsAccess(absolutePath, constants.R_OK);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { error: `File not found: ${path}` };
    }
    if (code === "EACCES" || code === "EPERM") {
      return { error: `File is not readable: ${path}` };
    }
    return { error: `Cannot access file: ${path}` };
  }

  try {
    const file = await loadFileKindAndText(absolutePath);
    if (file.kind === "directory") {
      return { error: `Path is a directory: ${path}. Use ls to inspect directories.` };
    }
    if (file.kind === "image") {
      return {
        error: `Path is an image file: ${path}. Hashline edit only supports UTF-8 text files.`,
      };
    }
    if (file.kind === "binary") {
      return {
        error: `Path is a binary file: ${path} (${file.description}). Hashline edit only supports UTF-8 text files.`,
      };
    }

    const originalNormalized = normalizeToLF(stripBom(file.text).text);

    let result: string;
    if (toolEdits.length > 0) {
      const resolved = resolveEditAnchors(toolEdits);
      result = applyHashlineEdits(originalNormalized, resolved).content;
    } else {
      result = applyExactUniqueLegacyReplace(
        originalNormalized,
        normalizeToLF(legacy!.oldText),
        normalizeToLF(legacy!.newText),
      ).content;
    }

    if (originalNormalized === result) {
      return {
        error: `No changes made to ${path}. The edits produced identical content.`,
      };
    }

    return { diff: generateDiffString(originalNormalized, result).diff };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}"""

new_preview = """export async function computeEditPreview(
  request: unknown,
  cwd: string,
): Promise<EditPreview> {
  try {
    assertEditRequest(request);
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  const params = request as EditRequestParams;
  const path = params.path;
  const absolutePath = resolveToCwd(path, cwd);
  const toolEdits = normalizeEditItems(params.edits);

  try {
    await fsAccess(absolutePath, constants.R_OK);
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { error: `File not found: ${path}` };
    }
    if (code === "EACCES" || code === "EPERM") {
      return { error: `File is not readable: ${path}` };
    }
    return { error: `Cannot access file: ${path}` };
  }

  try {
    const file = await loadFileKindAndText(absolutePath);
    if (file.kind === "directory") {
      return { error: `Path is a directory: ${path}. Use ls to inspect directories.` };
    }
    if (file.kind === "image") {
      return {
        error: `Path is an image file: ${path}. Hashline edit only supports UTF-8 text files.`,
      };
    }
    if (file.kind === "binary") {
      return {
        error: `Path is a binary file: ${path} (${file.description}). Hashline edit only supports UTF-8 text files.`,
      };
    }

    const originalNormalized = normalizeToLF(stripBom(file.text).text);
    const resolved = resolveEditAnchors(toolEdits);
    const result = applyHashlineEdits(originalNormalized, resolved).content;

    if (originalNormalized === result) {
      return {
        error: `No changes made to ${path}. The edits produced identical content.`,
      };
    }

    return { diff: generateDiffString(originalNormalized, result).diff };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}"""

assert old_preview in content, "Old preview not found"
content = content.replace(old_preview, new_preview)

# Fix getRenderablePreviewInput
old_rpi = """function getRenderablePreviewInput(args: unknown): EditRequestParams | null {
  if (!isRecord(args) || typeof args.path !== "string") {
    return null;
  }

  const request: EditRequestParams = { path: args.path };
  if (Array.isArray(args.edits)) {
    request.edits = args.edits as HashlineToolEdit[];
  }
  if (typeof args.oldText === "string") {
    request.oldText = args.oldText;
  }
  if (typeof args.newText === "string") {
    request.newText = args.newText;
  }
  if (typeof args.old_text === "string") {
    request.old_text = args.old_text;
  }
  if (typeof args.new_text === "string") {
    request.new_text = args.new_text;
  }

  const hasAnyEditPayload =
    request.edits !== undefined ||
    request.oldText !== undefined ||
    request.newText !== undefined ||
    request.old_text !== undefined ||
    request.new_text !== undefined;
  return hasAnyEditPayload ? request : null;
}"""

new_rpi = """function getRenderablePreviewInput(args: unknown): EditRequestParams | null {
  if (!isRecord(args) || typeof args.path !== "string") {
    return null;
  }

  const request: EditRequestParams = {
    path: args.path,
    edits: Array.isArray(args.edits) ? args.edits : [],
  };
  return request.edits.length > 0 ? request : null;
}"""

assert old_rpi in content, "Old renderable preview input not found"
content = content.replace(old_rpi, new_rpi)

with open("src/edit.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
