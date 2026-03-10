import { useEffect, useState } from "react";

import { getStoredJson, setStoredJson } from "../infrastructure/localStorageRepository";

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

const MAX_AI_EDIT_MEMORY_ENTRIES = 24;

function isValidAiEditMemoryEntry(value: unknown): value is AiEditMemoryEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Partial<AiEditMemoryEntry>;
  return (
    typeof entry.id === "string" &&
    (entry.decision === "accepted" || entry.decision === "dismissed") &&
    typeof entry.prompt === "string" &&
    typeof entry.suggestionSummary === "string" &&
    (entry.suggestionReason === undefined || typeof entry.suggestionReason === "string") &&
    Array.isArray(entry.operationReasons) &&
    entry.operationReasons.every((reason) => typeof reason === "string") &&
    (entry.targetHint === undefined || typeof entry.targetHint === "string") &&
    typeof entry.createdAt === "string"
  );
}

type RecordAiEditMemoryInput = Omit<AiEditMemoryEntry, "id" | "createdAt">;

type UseAiEditMemoryOptions = {
  storageKey: string;
};

export function useAiEditMemory({ storageKey }: UseAiEditMemoryOptions) {
  const [aiEditMemory, setAiEditMemory] = useState<AiEditMemoryEntry[]>(() =>
    getStoredJson(
      storageKey,
      (value) =>
        Array.isArray(value)
          ? value.filter((entry): entry is AiEditMemoryEntry => isValidAiEditMemoryEntry(entry)).slice(-MAX_AI_EDIT_MEMORY_ENTRIES)
          : [],
      [],
    ),
  );

  useEffect(() => {
    setStoredJson(storageKey, aiEditMemory);
  }, [aiEditMemory, storageKey]);

  const recordAiEditMemory = (input: RecordAiEditMemoryInput) => {
    const nextEntry: AiEditMemoryEntry = {
      id: globalThis.crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
    };

    setAiEditMemory((current) => [...current, nextEntry].slice(-MAX_AI_EDIT_MEMORY_ENTRIES));
  };

  return {
    aiEditMemory,
    recordAiEditMemory,
  };
}
