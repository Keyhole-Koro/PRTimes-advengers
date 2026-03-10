import type { Editor } from "@tiptap/react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { buildAiSuggestionWidgetSelector } from "../domain/editorSession";
import { useAiAssistant } from "../hooks/useAiAssistant";
import type { AiEditMemoryEntry } from "../hooks/useAiAssistant";
import type { AgentDocumentEditResult, PendingAiSuggestion } from "../types";

const MAX_PENDING_AI_SUGGESTIONS = 4;

type UseAiRecommendationsOptions = {
  aiEditMemory: AiEditMemoryEntry[];
  editor: Editor | null;
  pendingAiSuggestionsRef: RefObject<PendingAiSuggestion[]>;
  pressReleaseId: number;
  setActiveAiSuggestionId: Dispatch<SetStateAction<string | null>>;
  setPendingAiSuggestions: Dispatch<SetStateAction<PendingAiSuggestion[]>>;
  title: string;
};

export function useAiRecommendations({
  aiEditMemory,
  editor,
  pendingAiSuggestionsRef,
  pressReleaseId,
  setActiveAiSuggestionId,
  setPendingAiSuggestions,
  title,
}: UseAiRecommendationsOptions) {
  const preserveEditorViewport = (applyUpdate: () => void) => {
    if (!editor) {
      applyUpdate();
      return;
    }

    const scrollContainer = editor.view.dom as HTMLElement;
    const selectionAnchor = editor.state.selection.from;
    const beforeTop = editor.view.coordsAtPos(selectionAnchor).top;

    applyUpdate();

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        try {
          const afterTop = editor.view.coordsAtPos(selectionAnchor).top;
          const delta = afterTop - beforeTop;
          if (delta !== 0) {
            scrollContainer.scrollTop += delta;
          }
        } catch {
          // Ignore when the selection position is no longer resolvable.
        }
      });
    });
  };

  const handleCreateAiSuggestion = (suggestionId: string, prompt: string, result: AgentDocumentEditResult) => {
    const suggestions = result.suggestions.map((suggestion) => ({
      id: `${suggestionId}:${suggestion.id}`,
      prompt,
      responseSummary: result.summary,
      suggestion,
    }));

    preserveEditorViewport(() => {
      setPendingAiSuggestions((current) => [...current, ...suggestions].slice(-MAX_PENDING_AI_SUGGESTIONS));
      setActiveAiSuggestionId(null);
    });
  };

  const aiAssistant = useAiAssistant({
    editor,
    aiEditMemory,
    onCreateDocumentSuggestion: handleCreateAiSuggestion,
    pressReleaseId,
    title,
  });

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
