import { BASE_URL } from "../constants";
import type { AiAgentSettings, AiEditMemoryEntry, ConversationHistoryEntry } from "../hooks/useAiAssistant";
import type { AgentDocumentEditOperation, AgentDocumentEditResult, AgentDocumentEditSuggestion, PressReleaseResponse } from "../types";

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

  if (operation.op === "title_modify") {
    return typeof operation.after_title === "string";
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

export function normalizeDocumentEditResult(value: unknown): AgentDocumentEditResult | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const result = value as {
    summary?: unknown;
    assistant_message?: unknown;
    navigation_label?: unknown;
    suggestions?: unknown;
    operations?: unknown;
    notes?: unknown;
  };

  if (typeof result.summary !== "string") {
    return undefined;
  }

  const assistantMessage =
    typeof result.assistant_message === "string" && result.assistant_message.trim() !== ""
      ? result.assistant_message
      : "提案を追加しました。内容を確認してください。";
  const navigationLabel =
    typeof result.navigation_label === "string" && result.navigation_label.trim() !== ""
      ? result.navigation_label
      : "提案箇所へ移動";

  if (Array.isArray(result.suggestions) && result.suggestions.every(isValidAgentDocumentEditSuggestion)) {
    return {
      summary: result.summary,
      assistant_message: assistantMessage,
      navigation_label: navigationLabel,
      suggestions: result.suggestions,
      notes: Array.isArray(result.notes) ? result.notes.filter((item): item is string => typeof item === "string") : undefined,
    };
  }

  if (Array.isArray(result.operations) && result.operations.every(isValidAgentDocumentEditOperation)) {
    return {
      summary: result.summary,
      assistant_message: assistantMessage,
      navigation_label: navigationLabel,
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
    consistency_policy: normalizeSettingText(settings.consistencyPolicy),
    focus_points: settings.focusPoints.length > 0 ? settings.focusPoints : undefined,
    priority_checks: settings.priorityChecks.length > 0 ? settings.priorityChecks : undefined,
  };

  return Object.values(payload).some((value) => value !== undefined) ? payload : undefined;
}

function serializeAiEditMemory(memory: AiEditMemoryEntry[]): Record<string, unknown>[] | undefined {
  if (memory.length === 0) {
    return undefined;
  }

  return memory.slice(-12).map((entry) => ({
    decision: entry.decision,
    prompt: entry.prompt,
    suggestion_summary: entry.suggestionSummary,
    suggestion_reason: entry.suggestionReason?.trim() || undefined,
    operation_reasons: entry.operationReasons.length > 0 ? entry.operationReasons : undefined,
    target_hint: entry.targetHint?.trim() || undefined,
    created_at: entry.createdAt,
  }));
}

export async function requestDocumentEdit(params: {
  pressReleaseId: number;
  prompt: string;
  editor: { getJSON: () => Record<string, unknown> };
  title: string;
  conversationHistory: ConversationHistoryEntry[];
  aiSettings: AiAgentSettings;
  aiEditMemory: AiEditMemoryEntry[];
}): Promise<AgentDocumentEditResult> {
  const response = await fetch(`${BASE_URL}/press-releases/${params.pressReleaseId}/ai-edit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: params.prompt,
      title: params.title,
      content: params.editor.getJSON(),
      conversation_history: params.conversationHistory,
      ai_settings: serializeAiSettings(params.aiSettings),
      edit_memory: serializeAiEditMemory(params.aiEditMemory),
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
