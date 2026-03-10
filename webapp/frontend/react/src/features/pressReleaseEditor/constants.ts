import type { JSONContent } from "@tiptap/core";

import type { MarkType } from "./types";



export const QUERY_KEY = ["fetch-press-release"];
export const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || "http://localhost:8080";
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8080";
export const PRESS_RELEASE_ID = 1;
export const REVISIONS_QUERY_KEY = ["fetch-press-release-revisions", PRESS_RELEASE_ID];
export const PRESENCE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"];

export const MARK_BUTTONS: Array<{ key: MarkType; label: string }> = [
  { key: "bold", label: "太字" },
  { key: "italic", label: "斜体" },
  { key: "underline", label: "下線" },
];

export const EMPTY_CONTENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

