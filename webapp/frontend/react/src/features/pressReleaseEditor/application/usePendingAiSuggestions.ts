import { useEffect, useRef, useState } from "react";

import { normalizeLegacySuggestion } from "../domain/pendingAiSuggestion";
import { getStoredJson, setStoredJson } from "../infrastructure/localStorageRepository";
import type { PendingAiSuggestion } from "../types";

const MAX_PENDING_AI_SUGGESTIONS = 4;

type UsePendingAiSuggestionsOptions = {
  storageKey: string;
};

export function usePendingAiSuggestions({ storageKey }: UsePendingAiSuggestionsOptions) {
  const [pendingAiSuggestions, setPendingAiSuggestions] = useState<PendingAiSuggestion[]>(() =>
    getStoredJson(
      storageKey,
      (value) =>
        Array.isArray(value)
          ? value
              .map(normalizeLegacySuggestion)
              .filter((entry): entry is PendingAiSuggestion => entry !== null)
              .slice(-MAX_PENDING_AI_SUGGESTIONS)
          : [],
      [],
    ),
  );
  const [activeAiSuggestionId, setActiveAiSuggestionId] = useState<string | null>(null);
  const pendingAiSuggestionsRef = useRef<PendingAiSuggestion[]>([]);

  useEffect(() => {
    pendingAiSuggestionsRef.current = pendingAiSuggestions;
  }, [pendingAiSuggestions]);

  useEffect(() => {
    setStoredJson(storageKey, pendingAiSuggestions);
  }, [pendingAiSuggestions, storageKey]);

  return {
    activeAiSuggestionId,
    pendingAiSuggestions,
    pendingAiSuggestionsRef,
    setActiveAiSuggestionId,
    setPendingAiSuggestions,
  };
}
