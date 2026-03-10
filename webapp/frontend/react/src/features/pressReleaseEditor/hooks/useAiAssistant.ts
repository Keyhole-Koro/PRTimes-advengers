import type { Editor } from "@tiptap/react";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PRESS_RELEASE_ID } from "../constants";
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
  focusPoints: string[];
  priorityChecks: string[];
};

export type AiAutoRecommendStatus = {
  lineDelta: number;
  startedAt: string;
};

type UseAiAssistantOptions = {
  editor: Editor | null;
  onCreateDocumentSuggestion: (suggestionId: string, prompt: string, result: AgentDocumentEditResult) => void;
  title: string;
};

export type ConversationHistoryEntry = {
  role: "user" | "assistant";
  text: string;
  created_at: string;
};

const AI_CHAT_STORAGE_KEY = "press-release-editor-ai-chat";
const AI_SETTINGS_STORAGE_KEY = `press-release-editor-ai-settings:${PRESS_RELEASE_ID}`;
const AI_SCROLL_STORAGE_KEY = `press-release-editor-ai-scroll:${PRESS_RELEASE_ID}`;
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

function countDocumentLines(editor: Editor): number {
  const text = editor.getText({ blockSeparator: "\n" }).trimEnd();
  if (text === "") {
    return 0;
  }

  return text.split(/\r?\n/).length;
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
  const [autoRecommendStatus, setAutoRecommendStatus] = useState<AiAutoRecommendStatus | null>(null);
  const [aiSettings, setAiSettings] = useState<AiAgentSettings>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_AI_SETTINGS;
    }
    return parseStoredAiSettings(window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY));
  });
  const aiMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const aiMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const autoRecommendBaselineLineCountRef = useRef<number | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const hasRestoredScrollRef = useRef(false);
  const storedScrollPositionsRef = useRef<Record<string, number>>(
    typeof window === "undefined" ? {} : parseStoredAiScrollPositions(window.localStorage.getItem(AI_SCROLL_STORAGE_KEY)),
  );

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
        window.localStorage.setItem(AI_SCROLL_STORAGE_KEY, JSON.stringify(storedScrollPositionsRef.current));
      }
    };

    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [activeAiThreadId]);

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
      const documentEditResult = await requestDocumentEdit({
        prompt: effectivePrompt,
        editor,
        title,
        conversationHistory,
        aiSettings,
      });
      const assistantMessage = {
        ...createAiMessage(
          "assistant",
          documentEditResult.assistant_message,
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
      setAutoRecommendStatus({
        lineDelta,
        startedAt: new Date().toISOString(),
      });

      void (async () => {
        try {
          const conversationHistory = [...activeAiThread.messages, userMessage].slice(-12).map(serializeMessageForHistory);
          const documentEditResult = await requestDocumentEdit({
            prompt: autoPrompt,
            editor,
            title,
            conversationHistory,
            aiSettings,
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
          setAutoRecommendStatus((current) => (current?.lineDelta === lineDelta ? null : current));
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
    aiMessagesContainerRef,
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
