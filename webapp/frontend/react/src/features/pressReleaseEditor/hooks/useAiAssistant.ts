import type { Editor } from "@tiptap/react";
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { diffChars } from "diff";
import { v4 as uuidv4 } from "uuid";
import { normalizeDocumentEditResult, requestDocumentEdit } from "../infrastructure/aiApi";
import type { AgentDocumentEditResult } from "../types";
export type AiAttachmentKind = "image" | "file";

export type AiAttachmentMeta = {
  id: string;
  kind: AiAttachmentKind;
  name: string;
  size: number;
  mimeType: string;
};

export type AiComposerAttachment = AiAttachmentMeta & {
  file: File;
  previewUrl?: string;
};

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  attachments?: AiAttachmentMeta[];
  documentEditResult?: AgentDocumentEditResult;
};

export type AiChatThread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: AiChatMessage[];
};

export type AiAgentSettings = {
  targetAudience: string;
  writingStyle: string;
  tone: string;
  brandVoice: string;
  consistencyPolicy: string;
  focusPoints: string[];
  priorityChecks: string[];
};

export type AiEditMemoryEntry = {
  id: string;
  decision: "accepted" | "dismissed";
  prompt: string;
  suggestionSummary: string;
  suggestionReason?: string;
  operationReasons: string[];
  targetHint?: string;
  createdAt: string;
};

export type AiSettingSuggestionField = "targetAudience" | "writingStyle" | "tone" | "brandVoice" | "focusPoints" | "priorityChecks";

export type AiSettingSuggestionOption = {
  label: string;
  value: string;
};

export type AiSettingSuggestion = {
  field: AiSettingSuggestionField;
  prompt: string;
  options: AiSettingSuggestionOption[];
};

export type AiAutoRecommendStatus = {
  diffSize: number;
  startedAt: string;
};

type UseAiAssistantOptions = {
  editor: Editor | null;
  aiEditMemory: AiEditMemoryEntry[];
  onCreateDocumentSuggestion: (suggestionId: string, prompt: string, result: AgentDocumentEditResult) => void;
  pressReleaseId: number;
  title: string;
};

export type ConversationHistoryEntry = {
  role: "user" | "assistant";
  text: string;
  created_at: string;
};

export type AiChatRequestPayload = {
  threadId: string;
  message: {
    text: string;
    attachments: AiAttachmentMeta[];
  };
};

const AI_CHAT_STORAGE_KEY = "press-release-editor-ai-chat";
const AI_DEFAULT_THREAD_TITLE = "新しいチャット";
const AI_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const AI_MAX_FILE_BYTES = 10 * 1024 * 1024;
const AI_MAX_ATTACHMENT_COUNT = 4;
const AI_MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const AI_AUTO_RECOMMEND_DIFF_THRESHOLD = 60;
const AI_AUTO_RECOMMEND_PROMPT =
  "直近の編集内容を確認して、文章品質を上げるための改善レコメンドを提示してください。";
const AI_ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const AI_ALLOWED_FILE_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const DEFAULT_AI_SETTINGS: AiAgentSettings = {
  targetAudience: "",
  writingStyle: "",
  tone: "",
  brandVoice: "",
  consistencyPolicy: "",
  focusPoints: [],
  priorityChecks: [],
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseStoredAiSettings(rawValue: string | null): AiAgentSettings {
  if (!rawValue) {
    return DEFAULT_AI_SETTINGS;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AiAgentSettings>;
    return {
      targetAudience: typeof parsed.targetAudience === "string" ? parsed.targetAudience : "",
      writingStyle: typeof parsed.writingStyle === "string" ? parsed.writingStyle : "",
      tone: typeof parsed.tone === "string" ? parsed.tone : "",
      brandVoice: typeof parsed.brandVoice === "string" ? parsed.brandVoice : "",
      consistencyPolicy: typeof parsed.consistencyPolicy === "string" ? parsed.consistencyPolicy : "",
      focusPoints: isStringArray(parsed.focusPoints) ? parsed.focusPoints : [],
      priorityChecks: isStringArray(parsed.priorityChecks) ? parsed.priorityChecks : [],
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

function createAiThread(title = AI_DEFAULT_THREAD_TITLE): AiChatThread {
  return {
    id: uuidv4(),
    title,
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function createAiMessage(role: AiChatMessage["role"], text: string): AiChatMessage {
  return {
    id: uuidv4(),
    role,
    text,
    createdAt: new Date().toISOString(),
  };
}

function createAttachmentMeta(attachment: AiComposerAttachment): AiAttachmentMeta {
  return {
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    size: attachment.size,
    mimeType: attachment.mimeType,
  };
}

async function requestAiAssistant(payload: AiChatRequestPayload): Promise<string> {
  // TODO: replace with backend API call
  await new Promise((resolve) => window.setTimeout(resolve, 350));
  const attachmentCount = payload.message.attachments.length;
  if (payload.message.text.trim() === "" && attachmentCount > 0) {
    return `${attachmentCount}件の添付を受け取りました。バックエンド接続後に解析結果を返せます。`;
  }
  if (attachmentCount > 0) {
    return `受信: ${payload.message.text}\n（添付 ${attachmentCount} 件）`;
  }
  return payload.message.text;
}

function buildThreadTitle(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return AI_DEFAULT_THREAD_TITLE;
  }
  return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized;
}

function isValidAiAttachmentMeta(value: unknown): value is AiAttachmentMeta {
  if (typeof value !== "object" || !value) {
    return false;
  }
  const attachment = value as Partial<AiAttachmentMeta>;
  return (
    typeof attachment.id === "string" &&
    (attachment.kind === "image" || attachment.kind === "file") &&
    typeof attachment.name === "string" &&
    typeof attachment.size === "number" &&
    typeof attachment.mimeType === "string"
  );
}

function isValidAiMessage(value: unknown): value is AiChatMessage {
  if (typeof value !== "object" || !value) {
    return false;
  }
  const message = value as Partial<AiChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.text === "string" &&
    typeof message.createdAt === "string" &&
    (message.documentEditResult === undefined || normalizeDocumentEditResult(message.documentEditResult) !== undefined) &&
    (message.attachments === undefined ||
      (Array.isArray(message.attachments) && message.attachments.every(isValidAiAttachmentMeta)))
  );
}

function isValidAiThread(value: unknown): value is AiChatThread {
  if (typeof value !== "object" || !value) {
    return false;
  }
  const thread = value as Partial<AiChatThread>;
  return (
    typeof thread.id === "string" &&
    typeof thread.title === "string" &&
    typeof thread.updatedAt === "string" &&
    Array.isArray(thread.messages) &&
    thread.messages.every(isValidAiMessage)
  );
}

function parseStoredAiThreads(rawValue: string | null): AiChatThread[] {
  if (!rawValue) {
    return [createAiThread()];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [createAiThread()];
    }

    if (parsed.length > 0 && parsed.every(isValidAiMessage)) {
      const legacyMessages = (parsed as AiChatMessage[]).map((message) => ({
        ...message,
        documentEditResult: normalizeDocumentEditResult(message.documentEditResult),
      }));
      return [
        {
          ...createAiThread(buildThreadTitle(legacyMessages[0]?.text ?? "")),
          updatedAt: legacyMessages[legacyMessages.length - 1]?.createdAt ?? new Date().toISOString(),
          messages: legacyMessages,
        },
      ];
    }

    const threads = parsed.filter(isValidAiThread).map((thread) => ({
      ...thread,
      messages: thread.messages.map((message) => ({
        ...message,
        documentEditResult: normalizeDocumentEditResult(message.documentEditResult),
      })),
    }));
    return threads.length > 0 ? threads : [createAiThread()];
  } catch {
    return [createAiThread()];
  }
}

function parseStoredAiScrollPositions(rawValue: string | null): Record<string, number> {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number"),
    );
  } catch {
    return {};
  }
}

function describeAttachments(attachments: AiAttachmentMeta[]): string {
  if (attachments.length === 0) {
    return "";
  }

  return attachments.map((attachment) => `${attachment.kind === "image" ? "画像" : "ファイル"}: ${attachment.name}`).join(", ");
}

function buildMessageText(text: string, attachments: AiAttachmentMeta[]): string {
  if (text.trim() !== "") {
    return text.trim();
  }

  if (attachments.length > 0) {
    return `添付を追加しました。${describeAttachments(attachments)}`;
  }

  return "";
}

function serializeMessageForHistory(message: AiChatMessage): ConversationHistoryEntry {
  const attachmentDescription =
    message.attachments && message.attachments.length > 0 ? `\n添付: ${describeAttachments(message.attachments)}` : "";

  return {
    role: message.role,
    text: `${message.text}${attachmentDescription}`.trim(),
    created_at: message.createdAt,
  };
}

function getDocumentSnapshotText(editor: Editor, title: string): string {
  const body = editor.getText({ blockSeparator: "\n" }).trim();
  return `${title.trim()}\n${body}`.trim();
}

function computeDocumentDiffSize(previousText: string, nextText: string): number {
  let diffSize = 0;
  for (const part of diffChars(previousText, nextText)) {
    if (part.added || part.removed) {
      diffSize += part.value.length;
    }
  }
  return diffSize;
}

function inferAiSettingSuggestions(documentSnapshotText: string, settings: AiAgentSettings): AiSettingSuggestion[] {
  const normalizedText = documentSnapshotText;
  const suggestions: AiSettingSuggestion[] = [];

  const hasMediaTerms = /(取材|報道|メディア|発表|お知らせ|公開)/.test(normalizedText);
  const hasRecruitingTerms = /(採用|募集|インターン|候補者|働く|キャリア)/.test(normalizedText);
  const hasProductTerms = /(提供開始|リリース|導入|利用|顧客|サービス|製品|機能)/.test(normalizedText);
  const hasDateOrNumbers = /(\d{4}年|\d{1,2}月|\d+名|\d+円|\d+%)/.test(normalizedText);
  const hasCallToAction = /(お問い合わせ|詳細|資料請求|お申し込み|こちら)/.test(normalizedText);
  const hasExclamation = /[!！]/.test(normalizedText);
  const politeCount = (normalizedText.match(/です|ます/g) ?? []).length;

  if (settings.targetAudience.trim() === "") {
    const audienceOptions = hasRecruitingTerms
      ? ["求職者", "採用候補者", "人事担当者"]
      : hasMediaTerms
        ? ["記者・メディア関係者", "業界関係者", "投資家・広報関係者"]
        : hasProductTerms
          ? ["見込み顧客", "既存顧客", "業界関係者"]
          : ["業界関係者", "見込み顧客", "記者・メディア関係者"];
    suggestions.push({
      field: "targetAudience",
      prompt: "ターゲット候補",
      options: audienceOptions.map((option) => ({ label: option, value: option })),
    });
  }

  if (settings.writingStyle.trim() === "") {
    const styleOptions = hasMediaTerms
      ? ["ニュースライク", "プレスリリース標準", "簡潔"]
      : hasRecruitingTerms
        ? ["やわらかめ", "採用向け", "プレスリリース標準"]
        : ["プレスリリース標準", "簡潔", "やわらかめ"];
    suggestions.push({
      field: "writingStyle",
      prompt: "文章スタイル候補",
      options: styleOptions.map((option) => ({ label: option, value: option })),
    });
  }

  if (settings.tone.trim() === "") {
    const toneOptions = hasExclamation ? ["力強い", "親しみやすい", "丁寧"] : politeCount >= 3 ? ["丁寧", "落ち着いた", "簡潔"] : ["簡潔", "丁寧", "落ち着いた"];
    suggestions.push({
      field: "tone",
      prompt: "トーン候補",
      options: toneOptions.map((option) => ({ label: option, value: option })),
    });
  }

  if (settings.focusPoints.length === 0) {
    const focusOptions = hasCallToAction
      ? ["導入文", "本文構成", "CTA"]
      : hasProductTerms
        ? ["タイトル", "導入文", "見出し"]
        : ["タイトル", "導入文", "本文構成"];
    suggestions.push({
      field: "focusPoints",
      prompt: "重視ポイント候補",
      options: focusOptions.map((option) => ({ label: option, value: option })),
    });
  }

  if (settings.priorityChecks.length === 0) {
    const checkOptions = hasDateOrNumbers
      ? ["数字・日付の整合性", "誤字脱字", "表記ゆれ"]
      : ["誤字脱字", "表記ゆれ", "読みやすさ"];
    suggestions.push({
      field: "priorityChecks",
      prompt: "チェック観点候補",
      options: checkOptions.map((option) => ({ label: option, value: option })),
    });
  }

  return suggestions.slice(0, 4);
}

export function formatAiMessageTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAiThreadTime(isoString: string): string {
  return new Date(isoString).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useAiAssistant({ editor, aiEditMemory, onCreateDocumentSuggestion, pressReleaseId, title }: UseAiAssistantOptions) {
  const aiSettingsStorageKey = `press-release-editor-ai-settings:${pressReleaseId}`;
  const aiScrollStorageKey = `press-release-editor-ai-scroll:${pressReleaseId}`;
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAttachmentError, setAiAttachmentError] = useState<string | null>(null);
  const [aiResponseError, setAiResponseError] = useState<string | null>(null);
  const [isAiAttachMenuOpen, setIsAiAttachMenuOpen] = useState(false);
  const [isAiDraggingFile, setIsAiDraggingFile] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<AiComposerAttachment[]>([]);
  const [aiThreads, setAiThreads] = useState<AiChatThread[]>(() => {
    if (typeof window === "undefined") {
      return [createAiThread()];
    }
    return parseStoredAiThreads(window.localStorage.getItem(AI_CHAT_STORAGE_KEY));
  });
  const [activeAiThreadId, setActiveAiThreadId] = useState<string>(() => aiThreads[0]?.id ?? createAiThread().id);
  const [respondingAiThreadId, setRespondingAiThreadId] = useState<string | null>(null);
  const [aiThreadMenuOpenId, setAiThreadMenuOpenId] = useState<string | null>(null);
  const [isAiHistoryOpen, setIsAiHistoryOpen] = useState(false);
  const [autoRecommendStatus, setAutoRecommendStatus] = useState<AiAutoRecommendStatus | null>(null);
  const [aiSettings, setAiSettings] = useState<AiAgentSettings>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_AI_SETTINGS;
    }
    return parseStoredAiSettings(window.localStorage.getItem(aiSettingsStorageKey));
  });
  const aiMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const aiMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const autoRecommendBaselineTextRef = useRef<string | null>(null);
  const [editorSnapshotText, setEditorSnapshotText] = useState("");
  const pendingAutoRecommendRef = useRef(false);
  const shouldStickToBottomRef = useRef(true);
  const hasRestoredScrollRef = useRef(false);
  const storedScrollPositionsRef = useRef<Record<string, number>>(
    typeof window === "undefined" ? {} : parseStoredAiScrollPositions(window.localStorage.getItem(aiScrollStorageKey)),
  );

  const isAiResponding = respondingAiThreadId !== null;
  const activeAiThread = useMemo(
    () => aiThreads.find((thread) => thread.id === activeAiThreadId) ?? aiThreads[0] ?? null,
    [activeAiThreadId, aiThreads],
  );
  const activeAiMessages = activeAiThread?.messages ?? [];
  const aiSettingSuggestions = useMemo(
    () => inferAiSettingSuggestions(editorSnapshotText, aiSettings),
    [aiSettings, editorSnapshotText],
  );

  const runAutoRecommend = () => {
    if (!editor || !activeAiThread) {
      return;
    }

    const currentSnapshotText = getDocumentSnapshotText(editor, title);
    const previousSnapshotText = autoRecommendBaselineTextRef.current ?? currentSnapshotText;
    const diffSize = computeDocumentDiffSize(previousSnapshotText, currentSnapshotText);
    if (diffSize < AI_AUTO_RECOMMEND_DIFF_THRESHOLD) {
      pendingAutoRecommendRef.current = false;
      return;
    }

    pendingAutoRecommendRef.current = false;
    autoRecommendBaselineTextRef.current = currentSnapshotText;
    const autoPrompt = `${AI_AUTO_RECOMMEND_PROMPT}（推定差分量: ${diffSize}文字）`;
    const threadId = activeAiThread.id;
    setRespondingAiThreadId(threadId);
    setAutoRecommendStatus({
      diffSize,
      startedAt: new Date().toISOString(),
    });

    void (async () => {
      try {
        const conversationHistory = activeAiThread.messages.slice(-12).map(serializeMessageForHistory);
        const documentEditResult = await requestDocumentEdit({
          pressReleaseId,
          prompt: autoPrompt,
          editor,
          title,
          conversationHistory,
          aiSettings,
          aiEditMemory,
        });
        const assistantMessage = {
          ...createAiMessage(
            "assistant",
            documentEditResult.assistant_message,
          ),
          documentEditResult,
        };
        updateThreadMessages(threadId, assistantMessage);
        onCreateDocumentSuggestion(assistantMessage.id, autoPrompt, documentEditResult);
      } catch (error) {
        const message = error instanceof Error ? error.message : "AIリクエストの自動実行に失敗しました";
        updateThreadMessages(threadId, createAiMessage("assistant", message));
      } finally {
        setAutoRecommendStatus((current) => (current?.diffSize === diffSize ? null : current));
        setRespondingAiThreadId((current) => (current === threadId ? null : current));
      }
    })();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(aiThreads));
  }, [aiThreads]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(aiSettingsStorageKey, JSON.stringify(aiSettings));
  }, [aiSettings, aiSettingsStorageKey]);

  useEffect(() => {
    if (!aiThreads.some((thread) => thread.id === activeAiThreadId)) {
      setActiveAiThreadId(aiThreads[0]?.id ?? "");
    }
  }, [aiThreads, activeAiThreadId]);

  useEffect(() => {
    const container = aiMessagesContainerRef.current;
    if (!container || !activeAiThreadId) {
      return;
    }

    const handleScroll = () => {
      if (!hasRestoredScrollRef.current) {
        return;
      }

      storedScrollPositionsRef.current[activeAiThreadId] = container.scrollTop;
      shouldStickToBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 48;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(aiScrollStorageKey, JSON.stringify(storedScrollPositionsRef.current));
      }
    };

    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [activeAiThreadId, aiScrollStorageKey]);

  useEffect(() => {
    const container = aiMessagesContainerRef.current;
    if (!container || !activeAiThreadId) {
      return;
    }

    window.requestAnimationFrame(() => {
      const savedScrollTop = storedScrollPositionsRef.current[activeAiThreadId];
      if (typeof savedScrollTop === "number") {
        container.scrollTop = savedScrollTop;
      } else {
        container.scrollTop = container.scrollHeight;
      }

      shouldStickToBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 48;
      hasRestoredScrollRef.current = true;
    });
  }, [activeAiMessages.length, activeAiThreadId]);

  useEffect(() => {
    hasRestoredScrollRef.current = false;
  }, [activeAiThreadId]);

  useEffect(() => {
    const container = aiMessagesContainerRef.current;
    if (!container || !shouldStickToBottomRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [activeAiMessages.length]);

  useEffect(() => {
    return () => {
      composerAttachments.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, [composerAttachments]);

  useEffect(() => {
    if (!editor) {
      autoRecommendBaselineTextRef.current = null;
      setEditorSnapshotText("");
      return;
    }

    const snapshotText = getDocumentSnapshotText(editor, title);
    autoRecommendBaselineTextRef.current = snapshotText;
    setEditorSnapshotText(snapshotText);

    const syncSnapshotText = () => {
      setEditorSnapshotText(getDocumentSnapshotText(editor, title));
    };

    const handleTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!transaction.docChanged) {
        return;
      }
      syncSnapshotText();
    };

    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [editor, title]);

  const clearComposerAttachments = () => {
    setComposerAttachments((current) => {
      current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
      return [];
    });
  };

  const removeComposerAttachment = (attachmentId: string) => {
    setComposerAttachments((current) =>
      current.filter((attachment) => {
        if (attachment.id === attachmentId) {
          if (attachment.previewUrl) {
            URL.revokeObjectURL(attachment.previewUrl);
          }
          return false;
        }
        return true;
      }),
    );
    setAiAttachmentError(null);
    setAiResponseError(null);
  };

  const addComposerFiles = (files: File[], mode: "image" | "file" | "paste-image") => {
    if (files.length === 0) {
      return;
    }

    let nextError: string | null = null;
    setComposerAttachments((current) => {
      const next = [...current];

      for (const file of files) {
        if (next.length >= AI_MAX_ATTACHMENT_COUNT) {
          nextError = `添付は最大${AI_MAX_ATTACHMENT_COUNT}件までです。`;
          break;
        }

        const isImage = file.type.startsWith("image/");
        const kind: AiAttachmentKind = isImage ? "image" : "file";

        if (mode !== "file" && !isImage) {
          nextError = "画像のみ貼り付けできます。";
          continue;
        }

        if (isImage && !AI_ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
          nextError = "画像は JPG / PNG / WEBP / GIF のみ対応です。";
          continue;
        }

        if (!isImage && mode === "file" && !AI_ALLOWED_FILE_MIME_TYPES.has(file.type) && file.type !== "") {
          nextError = "このファイル形式は現在サポートされていません。";
          continue;
        }

        const maxSize = isImage ? AI_MAX_IMAGE_BYTES : AI_MAX_FILE_BYTES;
        if (file.size > maxSize) {
          nextError = `${isImage ? "画像" : "ファイル"}は1件あたり${Math.floor(maxSize / (1024 * 1024))}MBまでです。`;
          continue;
        }

        const totalSize = next.reduce((sum, attachment) => sum + attachment.size, 0) + file.size;
        if (totalSize > AI_MAX_TOTAL_ATTACHMENT_BYTES) {
          nextError = `添付合計は${Math.floor(AI_MAX_TOTAL_ATTACHMENT_BYTES / (1024 * 1024))}MBまでです。`;
          break;
        }

        next.push({
          id: uuidv4(),
          file,
          kind,
          name: file.name || (kind === "image" ? "pasted-image.png" : "untitled"),
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
        });
      }

      return next;
    });

    setAiAttachmentError(nextError);
    setAiResponseError(null);
    setIsAiAttachMenuOpen(false);
  };

  const updateThreadMessages = (threadId: string, message: AiChatMessage) => {
    setAiThreads((current) => {
      const next = current.map((thread) => {
        if (thread.id !== threadId) {
          return thread;
        }

        const shouldUpdateTitle =
          thread.messages.length === 0 && thread.title === AI_DEFAULT_THREAD_TITLE && message.role === "user";

        return {
          ...thread,
          title: shouldUpdateTitle ? buildThreadTitle(message.text) : thread.title,
          updatedAt: message.createdAt,
          messages: [...thread.messages, message],
        };
      });

      return [...next].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
  };

  const handleAiEcho = async () => {
  const handleAiEcho = async () => {
    if (!activeAiThread) {
      return;
    }

    const normalizedPrompt = aiPrompt.trim();
    const attachments = composerAttachments.map(createAttachmentMeta);
    if ((normalizedPrompt === "" && attachments.length === 0) || respondingAiThreadId !== null) {
      return;
    }

    if (!editor) {
      window.alert("エディタの初期化完了後に再度お試しください。");
      return;
    }

    autoRecommendBaselineTextRef.current = getDocumentSnapshotText(editor, title);

    const displayText = buildMessageText(normalizedPrompt, attachments);
    const effectivePrompt =
      normalizedPrompt !== ""
        ? normalizedPrompt
        : `添付資料を踏まえて文書を編集してください。添付: ${describeAttachments(attachments)}`;

    const threadId = activeAiThread.id;
    const userMessage = createAiMessage("user", displayText);
    if (attachments.length > 0) {
      userMessage.attachments = attachments;
    }
    updateThreadMessages(threadId, userMessage);

    setAiPrompt("");
    clearComposerAttachments();
    setAiAttachmentError(null);
    setAiResponseError(null);
    setIsAiAttachMenuOpen(false);
    setRespondingAiThreadId(threadId);

    try {
      const conversationHistory = [...activeAiThread.messages, userMessage].slice(-12).map(serializeMessageForHistory);
      const documentEditResult = await requestDocumentEdit({
        pressReleaseId,
        prompt: effectivePrompt,
        editor,
        title,
        conversationHistory,
        aiSettings,
        aiEditMemory,
      });
      const assistantMessage = {
        ...createAiMessage("assistant", documentEditResult.assistant_message),
        documentEditResult,
      };
    const requestPayload: AiChatRequestPayload = {
      threadId,
      message: {
        text: normalizedPrompt,
        attachments,
      },
    };

    try {
      const assistantReply = await requestAiAssistant(requestPayload);
      const assistantMessage = createAiMessage("assistant", assistantReply);
      updateThreadMessages(threadId, assistantMessage);
      onCreateDocumentSuggestion(assistantMessage.id, effectivePrompt, documentEditResult);
      setAiResponseError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI編集の取得に失敗しました";
      setAiResponseError(message);
      updateThreadMessages(threadId, createAiMessage("assistant", message));
    } finally {
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AIへの問い合わせに失敗しました。再度お試しください。";
      setAiResponseError(message);
    } finally {
      setRespondingAiThreadId((current) => (current === threadId ? null : current));
    }
    }
  };

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleAutoRecommend = () => {
      if (respondingAiThreadId !== null) {
        pendingAutoRecommendRef.current = true;
        return;
      }

      runAutoRecommend();
    };

    const handleTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!transaction.docChanged) {
        return;
      }

      handleAutoRecommend();
    };

    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [activeAiThread, aiEditMemory, aiSettings, editor, onCreateDocumentSuggestion, pressReleaseId, respondingAiThreadId, title]);

  useEffect(() => {
    if (respondingAiThreadId !== null || !pendingAutoRecommendRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (respondingAiThreadId === null && pendingAutoRecommendRef.current) {
        runAutoRecommend();
      }
    });
  }, [respondingAiThreadId, runAutoRecommend]);

  const setAiSettingText = (
    field: "targetAudience" | "writingStyle" | "tone" | "brandVoice" | "consistencyPolicy",
    value: string,
  ) => {
    setAiSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const toggleAiSettingListValue = (field: "focusPoints" | "priorityChecks", value: string) => {
    setAiSettings((current) => {
      const currentValues = current[field];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...current,
        [field]: nextValues,
      };
    });
  };

  const resetAiSettings = () => {
    setAiSettings(DEFAULT_AI_SETTINGS);
  };

  const handleAiInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleAiEcho();
    }
  };

  const handleAiInputPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(event.clipboardData.items);
    const imageFiles = items
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    addComposerFiles(imageFiles, "paste-image");
  };

  const handleAiDropOver = (event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    if (!isAiDraggingFile) {
      setIsAiDraggingFile(true);
    }
  };

  const handleAiDropLeave = () => {
    setIsAiDraggingFile(false);
  };

  const handleAiDropFiles = (event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setIsAiDraggingFile(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    addComposerFiles(files, "file");
  };

  const handleAiImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    addComposerFiles(files, "image");
    event.target.value = "";
  };

  const handleAiGeneralFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    addComposerFiles(files, "file");
    event.target.value = "";
  };

  const handleAiMixedFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    addComposerFiles(files, "file");
    event.target.value = "";
  };

  const handleClearAiComposer = () => {
    setAiPrompt("");
    clearComposerAttachments();
    setAiAttachmentError(null);
    setAiResponseError(null);
    setIsAiAttachMenuOpen(false);
  };

  const handleCreateAiThread = () => {
    const newThread = createAiThread();
    setAiThreads((current) => [newThread, ...current]);
    setActiveAiThreadId(newThread.id);
    setAiPrompt("");
    clearComposerAttachments();
    setAiAttachmentError(null);
    setAiResponseError(null);
    setIsAiAttachMenuOpen(false);
    setAiThreadMenuOpenId(null);
    setIsAiHistoryOpen(true);
  };

  const handleRenameAiThread = (thread: AiChatThread) => {
    const nextTitle = window.prompt("チャット名を入力してください", thread.title);
    if (!nextTitle || nextTitle.trim() === "") {
      setAiThreadMenuOpenId(null);
      return;
    }

    const normalizedTitle = nextTitle.trim().slice(0, 40);
    setAiThreads((current) =>
      current.map((item) =>
        item.id === thread.id
          ? {
              ...item,
              title: normalizedTitle,
            }
          : item,
      ),
    );
    setAiThreadMenuOpenId(null);
  };

  const handleDeleteAiThread = (thread: AiChatThread) => {
    if (!window.confirm(`「${thread.title}」を削除しますか？`)) {
      setAiThreadMenuOpenId(null);
      return;
    }

    const filteredThreads = aiThreads.filter((item) => item.id !== thread.id);
    const nextThreads = filteredThreads.length > 0 ? filteredThreads : [createAiThread()];
    setAiThreads(nextThreads);

    if (!nextThreads.some((item) => item.id === activeAiThreadId)) {
      setActiveAiThreadId(nextThreads[0].id);
    }

    if (respondingAiThreadId === thread.id) {
      setRespondingAiThreadId(null);
    }

    setAiThreadMenuOpenId(null);
  };

  return {
    activeAiMessages,
    aiSettings,
    aiSettingSuggestions,
    activeAiThread,
    activeAiThreadId,
    aiAttachmentError,
    aiMessagesContainerRef,
    aiResponseError,
    aiMessagesEndRef,
    aiPrompt,
    autoRecommendStatus,
    aiThreadMenuOpenId,
    aiThreads,
    composerAttachments,
    handleAiMixedFileChange,
    handleAiGeneralFileChange,
    handleAiEcho,
    handleAiImageFileChange,
    handleAiInputPaste,
    handleAiDropFiles,
    handleAiDropLeave,
    handleAiDropOver,
    handleAiInputKeyDown,
    resetAiSettings,
    setAiSettingText,
    handleClearAiComposer,
    handleCreateAiThread,
    handleDeleteAiThread,
    handleRenameAiThread,
    isAiHistoryOpen,
    isAiAttachMenuOpen,
    isAiDraggingFile,
    isAiResponding,
    removeComposerAttachment,
    respondingAiThreadId,
    setActiveAiThreadId,
    setAiPrompt,
    setIsAiAttachMenuOpen,
    setAiThreadMenuOpenId,
    setIsAiHistoryOpen,
    toggleAiSettingListValue,
  };
}
