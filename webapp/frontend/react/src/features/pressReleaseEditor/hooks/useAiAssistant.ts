import type { Editor } from "@tiptap/react";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BASE_URL, PRESS_RELEASE_ID } from "../constants";
import type { AgentDocumentEditOperation, AgentDocumentEditResult, AgentDocumentEditSuggestion, PressReleaseResponse } from "../types";
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
  focusPoints: string[];
  priorityChecks: string[];
};

type UseAiAssistantOptions = {
  editor: Editor | null;
  onCreateDocumentSuggestion: (suggestionId: string, prompt: string, result: AgentDocumentEditResult) => void;
  title: string;
};

type ConversationHistoryEntry = {
  role: "user" | "assistant";
  text: string;
  created_at: string;
};

const AI_CHAT_STORAGE_KEY = "press-release-editor-ai-chat";
const AI_SETTINGS_STORAGE_KEY = `press-release-editor-ai-settings:${PRESS_RELEASE_ID}`;
const AI_DEFAULT_THREAD_TITLE = "新しいチャット";
const AI_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const AI_MAX_FILE_BYTES = 10 * 1024 * 1024;
const AI_MAX_ATTACHMENT_COUNT = 4;
const AI_MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const AI_AUTO_RECOMMEND_LINE_THRESHOLD = 3;
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
      focusPoints: isStringArray(parsed.focusPoints) ? parsed.focusPoints : [],
      priorityChecks: isStringArray(parsed.priorityChecks) ? parsed.priorityChecks : [],
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

function normalizeSettingText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}

function serializeAiSettings(settings: AiAgentSettings): Record<string, unknown> | undefined {
  const payload = {
    target_audience: normalizeSettingText(settings.targetAudience),
    writing_style: normalizeSettingText(settings.writingStyle),
    tone: normalizeSettingText(settings.tone),
    brand_voice: normalizeSettingText(settings.brandVoice),
    focus_points: settings.focusPoints.length > 0 ? settings.focusPoints : undefined,
    priority_checks: settings.priorityChecks.length > 0 ? settings.priorityChecks : undefined,
  };

  return Object.values(payload).some((value) => value !== undefined) ? payload : undefined;
}

function createAiThread(title = AI_DEFAULT_THREAD_TITLE): AiChatThread {
  return {
    id: globalThis.crypto.randomUUID(),
    title,
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function createAiMessage(role: AiChatMessage["role"], text: string): AiChatMessage {
  return {
    id: globalThis.crypto.randomUUID(),
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

function isValidAgentDocumentEditOperation(value: unknown): value is AgentDocumentEditOperation {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const operation = value as Partial<AgentDocumentEditOperation>;
  if (operation.op === "add") {
    return "block" in operation && "after_block_id" in operation;
  }

  if (operation.op === "remove") {
    return typeof operation.block_id === "string";
  }

  if (operation.op === "modify") {
    return typeof operation.block_id === "string" && "after" in operation;
  }

  return false;
}

function isValidAgentDocumentEditSuggestion(value: unknown): value is AgentDocumentEditSuggestion {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const suggestion = value as Partial<AgentDocumentEditSuggestion>;
  return (
    typeof suggestion.id === "string" &&
    typeof suggestion.category === "string" &&
    typeof suggestion.summary === "string" &&
    Array.isArray(suggestion.operations) &&
    suggestion.operations.every(isValidAgentDocumentEditOperation)
  );
}

function normalizeDocumentEditResult(value: unknown): AgentDocumentEditResult | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const result = value as {
    summary?: unknown;
    suggestions?: unknown;
    operations?: unknown;
    notes?: unknown;
  };

  if (typeof result.summary !== "string") {
    return undefined;
  }

  if (Array.isArray(result.suggestions) && result.suggestions.every(isValidAgentDocumentEditSuggestion)) {
    return {
      summary: result.summary,
      suggestions: result.suggestions,
      notes: Array.isArray(result.notes) ? result.notes.filter((item): item is string => typeof item === "string") : undefined,
    };
  }

  if (Array.isArray(result.operations) && result.operations.every(isValidAgentDocumentEditOperation)) {
    return {
      summary: result.summary,
      suggestions: [
        {
          id: "legacy-body-suggestion",
          category: "body",
          summary: result.summary,
          operations: result.operations,
        },
      ],
      notes: Array.isArray(result.notes) ? result.notes.filter((item): item is string => typeof item === "string") : undefined,
    };
  }

  return undefined;
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

function countDocumentLines(editor: Editor): number {
  const text = editor.getText({ blockSeparator: "\n" }).trimEnd();
  if (text === "") {
    return 0;
  }

  return text.split(/\r?\n/).length;
}

async function requestDocumentEdit(
  prompt: string,
  editor: Editor,
  title: string,
  conversationHistory: ConversationHistoryEntry[],
  aiSettings: AiAgentSettings,
): Promise<AgentDocumentEditResult> {
  const response = await fetch(`${BASE_URL}/press-releases/${PRESS_RELEASE_ID}/ai-edit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      title,
      content: editor.getJSON(),
      conversation_history: conversationHistory,
      ai_settings: serializeAiSettings(aiSettings),
    }),
  });

  const responseBody = (await response.json()) as
    | AgentDocumentEditResult
    | PressReleaseResponse
    | { result?: AgentDocumentEditResult; message?: string }
    | undefined;

  if (!response.ok) {
    const message =
      responseBody && typeof responseBody === "object" && "message" in responseBody && typeof responseBody.message === "string"
        ? responseBody.message
        : `AI編集の取得に失敗しました (${response.status})`;
    throw new Error(message);
  }

  const normalized = normalizeDocumentEditResult(responseBody);
  if (!normalized) {
    throw new Error("AI編集のレスポンス形式が不正です");
  }

  return normalized;
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

export function useAiAssistant({ editor, onCreateDocumentSuggestion, title }: UseAiAssistantOptions) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAttachmentError, setAiAttachmentError] = useState<string | null>(null);
  const [isAiAttachMenuOpen, setIsAiAttachMenuOpen] = useState(false);
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
  const [aiSettings, setAiSettings] = useState<AiAgentSettings>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_AI_SETTINGS;
    }
    return parseStoredAiSettings(window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY));
  });
  const aiMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const autoRecommendBaselineLineCountRef = useRef<number | null>(null);

  const isAiResponding = respondingAiThreadId !== null;
  const activeAiThread = useMemo(
    () => aiThreads.find((thread) => thread.id === activeAiThreadId) ?? aiThreads[0] ?? null,
    [activeAiThreadId, aiThreads],
  );
  const activeAiMessages = activeAiThread?.messages ?? [];

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
    window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(aiSettings));
  }, [aiSettings]);

  useEffect(() => {
    if (!aiThreads.some((thread) => thread.id === activeAiThreadId)) {
      setActiveAiThreadId(aiThreads[0]?.id ?? "");
    }
  }, [aiThreads, activeAiThreadId]);

  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeAiMessages]);

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
      autoRecommendBaselineLineCountRef.current = null;
      return;
    }

    autoRecommendBaselineLineCountRef.current = countDocumentLines(editor);
  }, [editor]);

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
          id: globalThis.crypto.randomUUID(),
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

    autoRecommendBaselineLineCountRef.current = countDocumentLines(editor);

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
    setIsAiAttachMenuOpen(false);
    setRespondingAiThreadId(threadId);

    try {
      const conversationHistory = [...activeAiThread.messages, userMessage].slice(-12).map(serializeMessageForHistory);
      const documentEditResult = await requestDocumentEdit(effectivePrompt, editor, title, conversationHistory, aiSettings);
      const assistantMessage = {
        ...createAiMessage(
          "assistant",
          "細かい提案を文書内に追加しました。該当箇所をクリックして内容を確認し、1つずつ反映するか見送るかを選べます。",
        ),
        documentEditResult,
      };
      updateThreadMessages(threadId, assistantMessage);
      onCreateDocumentSuggestion(assistantMessage.id, effectivePrompt, documentEditResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI編集の取得に失敗しました";
      updateThreadMessages(threadId, createAiMessage("assistant", message));
    } finally {
      setRespondingAiThreadId((current) => (current === threadId ? null : current));
    }
  };

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleAutoRecommend = () => {
      if (respondingAiThreadId !== null || !activeAiThread) {
        return;
      }

      const currentLineCount = countDocumentLines(editor);
      const previousLineCount = autoRecommendBaselineLineCountRef.current ?? currentLineCount;
      const lineDelta = Math.abs(currentLineCount - previousLineCount);
      if (lineDelta < AI_AUTO_RECOMMEND_LINE_THRESHOLD) {
        return;
      }

      autoRecommendBaselineLineCountRef.current = currentLineCount;
      const autoPrompt = `${AI_AUTO_RECOMMEND_PROMPT}（行数差分: ${lineDelta}行）`;
      const userMessage = createAiMessage("user", `自動レコメンドを実行します（行数差分: ${lineDelta}行）。`);
      const threadId = activeAiThread.id;
      updateThreadMessages(threadId, userMessage);
      setRespondingAiThreadId(threadId);

      void (async () => {
        try {
          const conversationHistory = [...activeAiThread.messages, userMessage].slice(-12).map(serializeMessageForHistory);
          const documentEditResult = await requestDocumentEdit(autoPrompt, editor, title, conversationHistory, aiSettings);
          const assistantMessage = {
            ...createAiMessage(
              "assistant",
              "行数差分が3行に達したため、自動レコメンドを作成しました。提案を確認してください。",
            ),
            documentEditResult,
          };
          updateThreadMessages(threadId, assistantMessage);
          onCreateDocumentSuggestion(assistantMessage.id, autoPrompt, documentEditResult);
        } catch (error) {
          const message = error instanceof Error ? error.message : "AIリクエストの自動実行に失敗しました";
          updateThreadMessages(threadId, createAiMessage("assistant", message));
        } finally {
          setRespondingAiThreadId((current) => (current === threadId ? null : current));
        }
      })();
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
  }, [activeAiThread, aiSettings, editor, onCreateDocumentSuggestion, respondingAiThreadId, title]);

  const setAiSettingText = (field: "targetAudience" | "writingStyle" | "tone" | "brandVoice", value: string) => {
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
    setIsAiAttachMenuOpen(false);
  };

  const handleCreateAiThread = () => {
    const newThread = createAiThread();
    setAiThreads((current) => [newThread, ...current]);
    setActiveAiThreadId(newThread.id);
    setAiPrompt("");
    clearComposerAttachments();
    setAiAttachmentError(null);
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
    activeAiThread,
    activeAiThreadId,
    aiAttachmentError,
    aiMessagesEndRef,
    aiPrompt,
    aiThreadMenuOpenId,
    aiThreads,
    composerAttachments,
    handleAiMixedFileChange,
    handleAiGeneralFileChange,
    handleAiEcho,
    handleAiImageFileChange,
    handleAiInputPaste,
    handleAiInputKeyDown,
    resetAiSettings,
    setAiSettingText,
    handleClearAiComposer,
    handleCreateAiThread,
    handleDeleteAiThread,
    handleRenameAiThread,
    isAiHistoryOpen,
    isAiAttachMenuOpen,
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
