import type {
  AgentDocumentEditOperation,
  AgentDocumentEditSuggestion,
  AgentDocumentSuggestionCategory,
  PendingAiSuggestion,
} from "../types";

export function isValidSuggestionCategory(value: unknown): value is AgentDocumentSuggestionCategory {
  return (
    value === "title" ||
    value === "lede" ||
    value === "structure" ||
    value === "readability" ||
    value === "keyword" ||
    value === "tag" ||
    value === "risk" ||
    value === "body"
  );
}

export function isValidPendingAiSuggestion(value: unknown): value is PendingAiSuggestion {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<PendingAiSuggestion>;
  return (
    typeof record.id === "string" &&
    typeof record.prompt === "string" &&
    typeof record.responseSummary === "string" &&
    typeof record.suggestion === "object" &&
    record.suggestion !== null &&
    typeof record.suggestion.id === "string" &&
    (record.suggestion.presentation === undefined ||
      record.suggestion.presentation === "block" ||
      record.suggestion.presentation === "inline") &&
    isValidSuggestionCategory(record.suggestion.category) &&
    typeof record.suggestion.summary === "string" &&
    Array.isArray(record.suggestion.operations)
  );
}

export function normalizeLegacySuggestion(value: unknown): PendingAiSuggestion | null {
  if (isValidPendingAiSuggestion(value)) {
    return value;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const legacy = value as {
    id?: unknown;
    prompt?: unknown;
    result?: {
      summary?: unknown;
      operations?: unknown[];
    };
  };

  if (
    typeof legacy.id !== "string" ||
    typeof legacy.prompt !== "string" ||
    typeof legacy.result?.summary !== "string" ||
    !Array.isArray(legacy.result?.operations)
  ) {
    return null;
  }

  const suggestion: AgentDocumentEditSuggestion = {
    id: `${legacy.id}-legacy`,
    presentation: "block",
    category: "body",
    summary: legacy.result.summary,
    operations: legacy.result.operations as AgentDocumentEditSuggestion["operations"],
  };

  return {
    id: legacy.id,
    prompt: legacy.prompt,
    responseSummary: legacy.result.summary,
    suggestion,
  };
}

export function withOperationText(
  operation: AgentDocumentEditOperation,
  nextText?: string,
): AgentDocumentEditOperation {
  if (typeof nextText !== "string") {
    return operation;
  }

  if (operation.op === "add") {
    return {
      ...operation,
      block: {
        ...operation.block,
        text: nextText,
      },
    };
  }

  if (operation.op === "modify") {
    return {
      ...operation,
      after: {
        ...operation.after,
        text: nextText,
      },
    };
  }

  return operation;
}
