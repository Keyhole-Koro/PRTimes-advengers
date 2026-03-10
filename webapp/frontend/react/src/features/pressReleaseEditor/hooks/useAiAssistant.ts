import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

export type AiChatThread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: AiChatMessage[];
};

const AI_CHAT_STORAGE_KEY = "press-release-editor-ai-chat";
const AI_DEFAULT_THREAD_TITLE = "新しいチャット";

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

function buildThreadTitle(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return AI_DEFAULT_THREAD_TITLE;
  }
  return normalized.length > 24 ? `${normalized.slice(0, 24)}...` : normalized;
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
    typeof message.createdAt === "string"
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
      const legacyMessages = parsed as AiChatMessage[];
      return [
        {
          ...createAiThread(buildThreadTitle(legacyMessages[0]?.text ?? "")),
          updatedAt: legacyMessages[legacyMessages.length - 1]?.createdAt ?? new Date().toISOString(),
          messages: legacyMessages,
        },
      ];
    }

    const threads = parsed.filter(isValidAiThread);
    return threads.length > 0 ? threads : [createAiThread()];
  } catch {
    return [createAiThread()];
  }
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

export function useAiAssistant() {
  const [aiPrompt, setAiPrompt] = useState("");
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
  const aiMessagesEndRef = useRef<HTMLDivElement | null>(null);

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
    if (!aiThreads.some((thread) => thread.id === activeAiThreadId)) {
      setActiveAiThreadId(aiThreads[0]?.id ?? "");
    }
  }, [aiThreads, activeAiThreadId]);

  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeAiMessages]);

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

  const handleAiEcho = () => {
    if (!activeAiThread) {
      return;
    }

    const normalizedPrompt = aiPrompt.trim();
    if (!normalizedPrompt || respondingAiThreadId !== null) {
      return;
    }

    const threadId = activeAiThread.id;
    const userMessage = createAiMessage("user", normalizedPrompt);
    updateThreadMessages(threadId, userMessage);

    setAiPrompt("");
    setRespondingAiThreadId(threadId);

    window.setTimeout(() => {
      const assistantMessage = createAiMessage("assistant", normalizedPrompt);
      updateThreadMessages(threadId, assistantMessage);
      setRespondingAiThreadId((current) => (current === threadId ? null : current));
    }, 250);
  };

  const handleAiInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleAiEcho();
    }
  };

  const handleCreateAiThread = () => {
    const newThread = createAiThread();
    setAiThreads((current) => [newThread, ...current]);
    setActiveAiThreadId(newThread.id);
    setAiPrompt("");
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
    activeAiThread,
    activeAiThreadId,
    aiMessagesEndRef,
    aiPrompt,
    aiThreadMenuOpenId,
    aiThreads,
    handleAiEcho,
    handleAiInputKeyDown,
    handleCreateAiThread,
    handleDeleteAiThread,
    handleRenameAiThread,
    isAiHistoryOpen,
    isAiResponding,
    respondingAiThreadId,
    setActiveAiThreadId,
    setAiPrompt,
    setAiThreadMenuOpenId,
    setIsAiHistoryOpen,
  };
}
