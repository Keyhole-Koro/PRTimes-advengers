export function buildAiSuggestionWidgetSelector(suggestionId: string): string {
  return `.aiSuggestionWidget[data-suggestion-id="${suggestionId}"]`;
}
