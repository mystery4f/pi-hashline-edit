import sys

with open("src/edit.ts", "r", encoding="utf-8") as f:
    content = f.read()

old_exec = """async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    assertEditRequest(params);

    const normalizedParams = params as EditRequestParams;
    const path = normalizedParams.path;
    const absolutePath = resolveToCwd(path, ctx.cwd);
    const returnMode = normalizedParams.returnMode ?? "changed";
    const requestedReturnRanges = normalizedParams.returnRanges;
    const toolEdits = Array.isArray(normalizedParams.edits)
      ? (normalizedParams.edits as HashlineToolEdit[])
      : [];
    const legacy = extractLegacyTopLevelReplace(
      normalizedParams as Record<string, unknown>,
    );

    if (toolEdits.length === 0 && !legacy) {
      return {
        content: [{ type: "text", text: "No edits provided." }],
        isError: true,
        details: { diff: "", firstChangedLine: undefined },
      };
    }

    const mutationTargetPath = await resolveMutationTargetPath(absolutePath);
    return withFileMutationQueue(mutationTargetPath, async () => {
      throwIfAborted(signal);
      try {
        await fsAccess(absolutePath, constants.R_OK | constants.W_OK);
      } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          throw new Error(`File not found: ${path}`);
        }
        if (code === "EACCES" || code === "EPERM") {
          throw new Error(`File is not writable: ${path}`);
        }
        throw new Error(`Cannot access file: ${path}`);
      }

      throwIfAborted(signal);
      const file = await loadFileKindAndText(absolutePath);
      if (file.kind === "directory") {
        throw new Error(`Path is a directory: ${path}. Use ls to inspect directories.`);
      }
      if (file.kind === "image") {
        throw new Error(
          `Path is an image file: ${path}. Hashline edit only supports UTF-8 text files.`,
        );
      }
      if (file.kind === "binary") {
        throw new Error(
          `Path is a binary file: ${path} (${file.description}). Hashline edit only supports UTF-8 text files.`,
        );
      }

      throwIfAborted(signal);
      const { bom, text: content } = stripBom(file.text);
      const originalEnding = detectLineEnding(content);
      const originalNormalized = normalizeToLF(content);

      let result: string;
      let warnings: string[] | undefined;
      let noopEdits:
        | Array<{
            editIndex: number;
            loc: string;
            currentContent: string;
          }>
        | undefined;
      let firstChangedLine: number | undefined;
      let lastChangedLine: number | undefined;
      let compatibilityDetails: CompatibilityDetails | undefined;

      if (toolEdits.length > 0) {
        const resolved = resolveEditAnchors(toolEdits);
        const anchorResult = applyHashlineEdits(originalNormalized, resolved, signal);
        result = anchorResult.content;
        warnings = anchorResult.warnings;
        noopEdits = anchorResult.noopEdits;
        firstChangedLine = anchorResult.firstChangedLine;
        lastChangedLine = anchorResult.lastChangedLine;
      } else {
        const normalizedOldText = normalizeToLF(legacy!.oldText);
        const normalizedNewText = normalizeToLF(legacy!.newText);
        const replaced = applyExactUniqueLegacyReplace(
          originalNormalized,
          normalizedOldText,
          normalizedNewText,
        );
        result = replaced.content;
        compatibilityDetails = {
          used: true,
          strategy: legacy!.strategy,
          matchCount: replaced.matchCount,
          ...(replaced.usedFuzzyMatch ? { fuzzyMatch: true } : {}),
        };
        const legacyRange = computeLegacyEditLineRange(
          originalNormalized,
          result,
        );
        firstChangedLine = legacyRange?.firstChangedLine;
        lastChangedLine = legacyRange?.lastChangedLine;
      }

      const editsAttempted = toolEdits.length > 0 ? toolEdits.length : 1;
      const legacyReplace = toolEdits.length === 0;

      if (originalNormalized === result) {
        const noopSnapshotId = (await getFileSnapshot(absolutePath)).snapshotId;
        return buildNoopResponse({
          path,
          returnMode: returnMode as ReturnMode,
          requestedReturnRanges,
          noopEdits,
          originalNormalized,
          snapshotId: noopSnapshotId,
          editsAttempted,
          warnings,
          legacyReplace,
          formatHashlineReadPreview: (text) =>
            formatHashlineReadPreview(text, { offset: 1 }),
          formatRequestedRangePreviews,
          buildStructureOutline,
        });
      }

      throwIfAborted(signal);
      await writeFileAtomically(
        absolutePath,
        bom + restoreLineEndings(result, originalEnding),
      );
      const updatedSnapshotId = (await getFileSnapshot(absolutePath)).snapshotId;

      const successInput = {
        path,
        returnMode: returnMode as ReturnMode,
        requestedReturnRanges,
        originalNormalized,
        result,
        warnings,
        firstChangedLine,
        lastChangedLine,
        snapshotId: updatedSnapshotId,
        compatibilityDetails: compatibilityDetails as
          | ResponseCompatibilityDetails
          | undefined,
        editsAttempted,
        noopEditsCount: noopEdits?.length ?? 0,
        legacyReplace,
        formatHashlineReadPreview: (text: string) =>
          formatHashlineReadPreview(text, { offset: 1 }),
        formatRequestedRangePreviews,
        buildStructureOutline,
      };

      if (returnMode === "full") return buildFullResponse(successInput);
      if (returnMode === "ranges") return buildRangesResponse(successInput);
      return buildChangedResponse(successInput);
    });
  }"""

new_exec = """async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    assertEditRequest(params);

    const path = (params as EditRequestParams).path;
    const absolutePath = resolveToCwd(path, ctx.cwd);
    const toolEdits = normalizeEditItems(
      (params as EditRequestParams).edits,
    );

    const mutationTargetPath = await resolveMutationTargetPath(absolutePath);
    return withFileMutationQueue(mutationTargetPath, async () => {
      throwIfAborted(signal);
      try {
        await fsAccess(absolutePath, constants.R_OK | constants.W_OK);
      } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          throw new Error(`File not found: ${path}`);
        }
        if (code === "EACCES" || code === "EPERM") {
          throw new Error(`File is not writable: ${path}`);
        }
        throw new Error(`Cannot access file: ${path}`);
      }

      throwIfAborted(signal);
      const file = await loadFileKindAndText(absolutePath);
      if (file.kind === "directory") {
        throw new Error(`Path is a directory: ${path}. Use ls to inspect directories.`);
      }
      if (file.kind === "image") {
        throw new Error(
          `Path is an image file: ${path}. Hashline edit only supports UTF-8 text files.`,
        );
      }
      if (file.kind === "binary") {
        throw new Error(
          `Path is a binary file: ${path} (${file.description}). Hashline edit only supports UTF-8 text files.`,
        );
      }

      throwIfAborted(signal);
      const { bom, text: content } = stripBom(file.text);
      const originalEnding = detectLineEnding(content);
      const originalNormalized = normalizeToLF(content);

      const resolved = resolveEditAnchors(toolEdits);
      const anchorResult = applyHashlineEdits(originalNormalized, resolved, signal);
      const result = anchorResult.content;
      const warnings = anchorResult.warnings;
      const noopEdits = anchorResult.noopEdits;
      const firstChangedLine = anchorResult.firstChangedLine;
      const lastChangedLine = anchorResult.lastChangedLine;

      const editsAttempted = toolEdits.length;
      const legacyReplace = toolEdits.some((e) => e.op === "replace_text");

      if (originalNormalized === result) {
        const noopSnapshotId = (await getFileSnapshot(absolutePath)).snapshotId;
        return buildNoopResponse({
          path,
          returnMode: "changed",
          requestedReturnRanges: undefined,
          noopEdits,
          originalNormalized,
          snapshotId: noopSnapshotId,
          editsAttempted,
          warnings,
          legacyReplace,
          formatHashlineReadPreview: (text) =>
            formatHashlineReadPreview(text, { offset: 1 }),
          formatRequestedRangePreviews,
          buildStructureOutline,
        });
      }

      throwIfAborted(signal);
      await writeFileAtomically(
        absolutePath,
        bom + restoreLineEndings(result, originalEnding),
      );
      const updatedSnapshotId = (await getFileSnapshot(absolutePath)).snapshotId;

      return buildChangedResponse({
        path,
        returnMode: "changed",
        requestedReturnRanges: undefined,
        originalNormalized,
        result,
        warnings,
        firstChangedLine,
        lastChangedLine,
        snapshotId: updatedSnapshotId,
        compatibilityDetails: undefined,
        editsAttempted,
        noopEditsCount: noopEdits?.length ?? 0,
        legacyReplace,
        formatHashlineReadPreview: (text: string) =>
          formatHashlineReadPreview(text, { offset: 1 }),
        formatRequestedRangePreviews,
        buildStructureOutline,
      });
    });
  }"""

if old_exec in content:
    content = content.replace(old_exec, new_exec)
    with open("src/edit.ts", "w", encoding="utf-8") as f:
        f.write(content)
    print("Done")
else:
    print("Old execute not found!")
    sys.exit(1)
