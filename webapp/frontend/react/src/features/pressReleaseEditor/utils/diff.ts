import type { JSONContent } from "@tiptap/core";
import { diffWords } from "diff";

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

export function buildDiffSegments(previousText: string, nextText: string): DiffSegment[] {
  const segments: DiffSegment[] = [];

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

  for (const part of diffWords(previousText, nextText, { ignoreCase: false })) {
    if (part.added) {
      pushSegment("added", part.value);
      continue;
    }

    if (part.removed) {
      pushSegment("removed", part.value);
    }
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
