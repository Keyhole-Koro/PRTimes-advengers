import type { JSONContent } from "@tiptap/core";

import type { DiffSegment, PressReleaseRevisionResponse } from "../types";

export function extractTextContent(content: JSONContent | undefined): string {
  if (!content) {
    return "";
  }

  const chunks: string[] = [];
  const visit = (node: JSONContent) => {
    if (typeof node.text === "string") {
      chunks.push(node.text);
    }

    node.content?.forEach(visit);
  };

  visit(content);
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function tokenizeDiffText(text: string): string[] {
  return text
    .split(/(?<=[。！？\n])|(\s+)/)
    .map((token) => token?.trim())
    .filter((token): token is string => Boolean(token));
}

export function buildDiffSegments(previousText: string, nextText: string): DiffSegment[] {
  const previousTokens = tokenizeDiffText(previousText);
  const nextTokens = tokenizeDiffText(nextText);
  const dp = Array.from({ length: previousTokens.length + 1 }, () =>
    Array<number>(nextTokens.length + 1).fill(0),
  );

  for (let i = previousTokens.length - 1; i >= 0; i -= 1) {
    for (let j = nextTokens.length - 1; j >= 0; j -= 1) {
      dp[i][j] =
        previousTokens[i] === nextTokens[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  const pushSegment = (type: DiffSegment["type"], value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }

    const last = segments.at(-1);
    if (last?.type === type) {
      last.value = `${last.value} ${normalized}`.trim();
      return;
    }

    segments.push({ type, value: normalized });
  };

  while (i < previousTokens.length && j < nextTokens.length) {
    if (previousTokens[i] === nextTokens[j]) {
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushSegment("removed", previousTokens[i]);
      i += 1;
      continue;
    }

    pushSegment("added", nextTokens[j]);
    j += 1;
  }

  while (i < previousTokens.length) {
    pushSegment("removed", previousTokens[i]);
    i += 1;
  }

  while (j < nextTokens.length) {
    pushSegment("added", nextTokens[j]);
    j += 1;
  }

  return segments;
}

export function buildRevisionDiffSummary(
  revisions: PressReleaseRevisionResponse[],
  revisionId: number,
) {
  const index = revisions.findIndex((revision) => revision.id === revisionId);
  const revision = index >= 0 ? revisions[index] : null;
  const previousRevision = index >= 0 && index < revisions.length - 1 ? revisions[index + 1] : null;

  const bodyDiff = revision
    ? buildDiffSegments(
        extractTextContent(previousRevision?.content),
        extractTextContent(revision.content),
      )
    : [];

  return {
    added: bodyDiff.filter((segment) => segment.type === "added").length,
    removed: bodyDiff.filter((segment) => segment.type === "removed").length,
  };
}

