import type { Editor } from "@tiptap/react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { buildAiSuggestionWidgetSelector } from "../domain/editorSession";
import { useAiAssistant } from "../hooks/useAiAssistant";
import type { AgentDocumentEditResult, PendingAiSuggestion } from "../types";

type UseAiRecommendationsOptions = {
  editor: Editor | null;
  pendingAiSuggestionsRef: RefObject<PendingAiSuggestion[]>;
  setActiveAiSuggestionId: Dispatch<SetStateAction<string | null>>;
  setPendingAiSuggestions: Dispatch<SetStateAction<PendingAiSuggestion[]>>;
  title: string;
};

export function useAiRecommendations({
  editor,
  pendingAiSuggestionsRef,
  setActiveAiSuggestionId,
  setPendingAiSuggestions,
  title,
}: UseAiRecommendationsOptions) {
  const handleCreateAiSuggestion = (suggestionId: string, prompt: string, result: AgentDocumentEditResult) => {
    const suggestions = result.suggestions.map((suggestion) => ({
      id: `${suggestionId}:${suggestion.id}`,
      prompt,
      responseSummary: result.summary,
      suggestion,
    }));

    setPendingAiSuggestions((current) => [...current, ...suggestions]);
    setActiveAiSuggestionId(suggestions[0]?.id ?? null);
  };

  const aiAssistant = useAiAssistant({ editor, onCreateDocumentSuggestion: handleCreateAiSuggestion, title });

  const handleJumpToSuggestion = (messageId: string) => {
    const suggestion = pendingAiSuggestionsRef.current.find((entry) => entry.id.startsWith(`${messageId}:`));
    if (!suggestion) {
      return;
    }

    setActiveAiSuggestionId(suggestion.id);

    const scrollToSuggestion = () => {
      const element = document.querySelector<HTMLElement>(buildAiSuggestionWidgetSelector(suggestion.id));
      if (!element) {
        return;
      }

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToSuggestion);
    });
  };

  return {
    aiAssistant,
    handleJumpToSuggestion,
  };
}
