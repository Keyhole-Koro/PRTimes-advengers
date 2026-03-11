import type { JSONContent } from "@tiptap/core";

import type { PresenceUser } from "../../editor/remotePresence";

export type PressReleaseResponse = {
  id: number;
  title: string;
  content: JSONContent;
  version: number;
  created_at?: string;
  updated_at?: string;
};

export type PressRelease = {
  title: string;
  content: JSONContent;
  version: number;
};

export type FileWithRelativePath = File & {
  webkitRelativePath?: string;
};

export type PressReleaseRevisionResponse = {
  id: number;
  press_release_id: number;
  version: number;
  title: string;
  content: JSONContent;
  created_at: string;
};

export type LinkPreviewResponse = {
  url: string;
  title: string;
  description: string;
  image: string | null;
};

export type PressReleaseTemplateResponse = {
  id: number;
  name: string;
  title: string;
  content: JSONContent;
  created_at: string;
  updated_at: string;
};

export type MarkType = "bold" | "italic" | "underline";

export type CommentThreadResponse = {
  id: number;
  press_release_id: number;
  anchor_from: number;
  anchor_to: number;
  quote: string;
  is_resolved: boolean;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
  messages: CommentMessageResponse[];
};

export type CommentMessageResponse = {
  id: number;
  thread_id: number;
  body: string;
  created_by: string;
  created_at: string;
};

export type SidebarTab = "history" | "ai" | "ai-settings";

export type ToolbarButtonConfig =
  | {
      key: string;
      label: string;
      tooltip?: string;
      isActive: boolean;
      onClick: () => void;
      type?: "button";
    }
  | {
      key: string;
      label: string;
      tooltip?: string;
      type: "select";
      value: string;
      options: Array<{
        label: string;
        value: string;
      }>;
      onChange: (value: string) => void;
    };

export type ToolbarGroupConfig = {
  label: string;
  buttons: ToolbarButtonConfig[];
};

export type SaveStatus = "saved" | "dirty" | "saving" | "error";

export type SessionSnapshot = {
  title: string;
  content: JSONContent;
  version: number;
};

export type SessionState = {
  clientId: string;
  snapshot: SessionSnapshot;
  revision: number;
};

export type DiffSegment = {
  type: "added" | "removed";
  value: string;
};

export type AgentDocumentBlock = {
  id: string;
  type: "heading" | "paragraph" | "bullet_list" | "ordered_list" | "blockquote";
  text: string;
  attrs?: Record<string, unknown>;
};

export type AgentDocumentEditOperation =
  | {
      op: "add";
      after_block_id: string | null;
      block: AgentDocumentBlock;
      reason?: string;
    }
  | {
      op: "remove";
      block_id: string;
      removed_block?: AgentDocumentBlock;
      reason?: string;
    }
  | {
      op: "modify";
      block_id: string;
      before?: AgentDocumentBlock;
      after: AgentDocumentBlock;
      reason?: string;
    }
  | {
      op: "title_modify";
      before_title?: string;
      after_title: string;
      reason?: string;
    };

export type AgentDocumentSuggestionCategory =
  | "title"
  | "lede"
  | "structure"
  | "readability"
  | "keyword"
  | "tag"
  | "risk"
  | "body";

export type AgentDocumentEditSuggestion = {
  id: string;
  presentation?: "block" | "inline";
  category: AgentDocumentSuggestionCategory;
  summary: string;
  reason?: string;
  operations: AgentDocumentEditOperation[];
};

export type AgentDocumentEditResult = {
  summary: string;
  assistant_message: string;
  navigation_label: string;
  suggestions: AgentDocumentEditSuggestion[];
  notes?: string[];
};

export type AiTagSuggestion = {
  label: string;
  reason: string;
};

export type AiTagSuggestResult = {
  summary: string;
  tags: AiTagSuggestion[];
};

export type PendingAiSuggestion = {
  id: string;
  prompt: string;
  responseSummary: string;
  suggestion: AgentDocumentEditSuggestion;
};

export type RealtimeMessage =
  | {
      type: "session.ready";
      clientId: string;
      snapshot: SessionSnapshot;
      revision: number;
      presence: PresenceUser[];
    }
  | {
      type: "document.steps";
      sourceClientId: string;
      steps: unknown[];
      clientIds: string[];
      revision: number;
    }
  | {
      type: "title.sync";
      title: string;
    }
  | {
      type: "document.saved";
      title: string;
      content: JSONContent;
      version: number;
    }
  | {
      type: "document.resync";
      snapshot: SessionSnapshot;
      revision: number;
    }
  | {
      type: "presence.snapshot";
      users: PresenceUser[];
    };
