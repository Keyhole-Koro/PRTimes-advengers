import type { JSONContent } from "@tiptap/core";

import type { MarkType } from "./types";

export const QUERY_KEY = ["fetch-press-release"];
export const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || "http://localhost:8080";
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8080";
export const PRESS_RELEASE_LIST_QUERY_KEY = ["fetch-press-release-list"];
export const buildPressReleaseQueryKey = (pressReleaseId: number) => [...QUERY_KEY, pressReleaseId] as const;
export const buildPressReleaseRevisionsQueryKey = (pressReleaseId: number) =>
  ["fetch-press-release-revisions", pressReleaseId] as const;
export const PRESENCE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"];

export const MARK_BUTTONS: Array<{ key: MarkType; label: string; tooltip: string }> = [
  { key: "bold", label: "B", tooltip: "太字" },
  { key: "italic", label: "/", tooltip: "斜体" },
  { key: "underline", label: "U", tooltip: "下線" },
];

export const EMPTY_CONTENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
