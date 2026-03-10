import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import type { PendingAiSuggestion } from "../types";
import { buildDiffSegments } from "../utils/diff";

type SuggestionDecorationState = {
  activeSuggestionId: string | null;
  suggestions: PendingAiSuggestion[];
};

type SuggestionExtensionOptions = {
  onAcceptSuggestion: (suggestionId: string) => void;
  onAcceptSuggestionOperation: (suggestionId: string, operationIndex: number, nextText?: string) => void;
  onActivateSuggestion: (suggestionId: string | null) => void;
  onDiscardSuggestion: (suggestionId: string) => void;
  onDiscardSuggestionOperation: (suggestionId: string, operationIndex: number) => void;
};

type IndexedBlockPosition = {
  id: string;
  to: number;
};

const aiSuggestionPluginKey = new PluginKey<SuggestionDecorationState>("aiSuggestionDecorations");

function buildIndexedBlockPositions(state: EditorState): IndexedBlockPosition[] {
  const positions: IndexedBlockPosition[] = [];
  let blockIndex = 0;

  state.doc.forEach((node, offset) => {
    const supported = ["heading", "paragraph", "bulletList", "orderedList", "blockquote"].includes(node.type.name);
    if (!supported) {
      return;
    }

    blockIndex += 1;
    positions.push({
      id: `block-${blockIndex}`,
      to: offset + node.nodeSize,
    });
  });

  return positions;
}

function appendDiffSegments(container: HTMLElement, beforeText: string, afterText: string) {
  const segments = buildDiffSegments(beforeText, afterText);
  if (segments.length === 0) {
    const empty = document.createElement("p");
    empty.className = "aiSuggestionDiffEmpty";
    empty.textContent = afterText || beforeText || "変更なし";
    container.append(empty);
    return;
  }

  for (const segment of segments) {
    const chip = document.createElement("span");
    chip.className = `aiSuggestionDiffToken aiSuggestionDiffToken-${segment.type}`;
    chip.textContent = segment.value;
    container.append(chip);
  }
}

function createOperationDiff(
  suggestion: PendingAiSuggestion,
  operation: PendingAiSuggestion["suggestion"]["operations"][number],
  operationIndex: number,
  options: SuggestionExtensionOptions,
) {
  const card = document.createElement("article");
  card.className = "aiSuggestionDiffCard";

  const header = document.createElement("header");
  header.className = "aiSuggestionDiffHeader";

  const type = document.createElement("span");
  type.className = `aiSuggestionDiffType aiSuggestionDiffType-${operation.op}`;
  type.textContent = operation.op.toUpperCase();
  header.append(type);

  const target = document.createElement("span");
  target.className = "aiSuggestionDiffTarget";
  target.textContent =
    operation.op === "add" ? operation.block.id : operation.block_id;
  header.append(target);
  card.append(header);

  if (operation.op === "modify") {
    const before = document.createElement("div");
    before.className = "aiSuggestionDiffBlock";
    const beforeLabel = document.createElement("p");
    beforeLabel.className = "aiSuggestionDiffBlockLabel";
    beforeLabel.textContent = "Before";
    before.append(beforeLabel);
    const beforeBody = document.createElement("div");
    beforeBody.className = "aiSuggestionDiffBlockBody";
    beforeBody.textContent = operation.before?.text ?? "";
    before.append(beforeBody);
    card.append(before);

    const after = document.createElement("div");
    after.className = "aiSuggestionDiffBlock";
    const afterLabel = document.createElement("p");
    afterLabel.className = "aiSuggestionDiffBlockLabel";
    afterLabel.textContent = "After";
    after.append(afterLabel);
    const afterBody = document.createElement("div");
    afterBody.className = "aiSuggestionDiffInline";
    appendDiffSegments(afterBody, operation.before?.text ?? "", operation.after.text);
    after.append(afterBody);

    const editor = document.createElement("textarea");
    editor.className = "aiSuggestionOperationEditor";
    editor.value = operation.after.text;
    editor.rows = Math.min(Math.max(operation.after.text.split("\n").length, 3), 8);
    after.append(editor);
    card.append(after);
  } else if (operation.op === "add") {
    const after = document.createElement("div");
    after.className = "aiSuggestionDiffBlock";
    const afterLabel = document.createElement("p");
    afterLabel.className = "aiSuggestionDiffBlockLabel";
    afterLabel.textContent = "Added";
    after.append(afterLabel);
    const afterBody = document.createElement("div");
    afterBody.className = "aiSuggestionDiffInline";
    appendDiffSegments(afterBody, "", operation.block.text);
    after.append(afterBody);

    const editor = document.createElement("textarea");
    editor.className = "aiSuggestionOperationEditor";
    editor.value = operation.block.text;
    editor.rows = Math.min(Math.max(operation.block.text.split("\n").length, 3), 8);
    after.append(editor);
    card.append(after);
  } else {
    const removed = document.createElement("div");
    removed.className = "aiSuggestionDiffBlock";
    const removedLabel = document.createElement("p");
    removedLabel.className = "aiSuggestionDiffBlockLabel";
    removedLabel.textContent = "Removed";
    removed.append(removedLabel);
    const removedBody = document.createElement("div");
    removedBody.className = "aiSuggestionDiffInline";
    appendDiffSegments(removedBody, operation.removed_block?.text ?? operation.block_id, "");
    removed.append(removedBody);
    card.append(removed);
  }

  if (operation.reason) {
    const reason = document.createElement("p");
    reason.className = "aiSuggestionDiffReason";
    reason.textContent = operation.reason;
    card.append(reason);
  }

  const operationActions = document.createElement("div");
  operationActions.className = "aiSuggestionOperationActions";

  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "aiSuggestionAccept";
  apply.textContent = "この差分を適用";
  apply.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const editor = card.querySelector<HTMLTextAreaElement>(".aiSuggestionOperationEditor");
    const nextText = editor?.value;
    options.onAcceptSuggestionOperation(suggestion.id, operationIndex, nextText);
  });
  operationActions.append(apply);

  const discard = document.createElement("button");
  discard.type = "button";
  discard.className = "aiSuggestionDiscard";
  discard.textContent = "この差分を破棄";
  discard.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    options.onDiscardSuggestionOperation(suggestion.id, operationIndex);
  });
  operationActions.append(discard);

  card.append(operationActions);

  return card;
}

function getSuggestionAnchorPosition(state: EditorState, suggestion: PendingAiSuggestion): number {
  const positions = buildIndexedBlockPositions(state);
  const operations = suggestion.suggestion?.operations;
  if (!Array.isArray(operations) || operations.length === 0) {
    return positions[0]?.to ?? state.doc.content.size;
  }

  const firstOperation = operations[0];
  if (!firstOperation) {
    return state.doc.content.size;
  }

  const blockId =
    firstOperation.op === "add"
      ? firstOperation.after_block_id
      : firstOperation.block_id;

  if (blockId) {
    const target = positions.find((item) => item.id === blockId);
    if (target) {
      return target.to;
    }
  }

  return positions[0]?.to ?? state.doc.content.size;
}

function createSuggestionWidget(
  suggestion: PendingAiSuggestion,
  isActive: boolean,
  options: SuggestionExtensionOptions,
) {
  return () => {
    const root = document.createElement("div");
    root.className = `aiSuggestionWidget${isActive ? " is-active" : ""}`;
    root.contentEditable = "false";
    root.setAttribute("data-suggestion-id", suggestion.id);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "aiSuggestionTrigger";
    const promptPreview = suggestion.prompt.length > 28 ? `${suggestion.prompt.slice(0, 28)}...` : suggestion.prompt;
    const lineStart = document.createElement("span");
    lineStart.className = "aiSuggestionTriggerLine";
    trigger.append(lineStart);

    const label = document.createElement("span");
    label.className = "aiSuggestionTriggerLabel";
    label.textContent = isActive ? `AI提案を閉じる: ${promptPreview}` : `AI提案を確認: ${promptPreview}`;
    trigger.append(label);

    const lineEnd = document.createElement("span");
    lineEnd.className = "aiSuggestionTriggerLine";
    trigger.append(lineEnd);
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      console.log("[aiSuggestion] trigger clicked", {
        active: isActive,
        prompt: suggestion.prompt,
        suggestionId: suggestion.id,
      });
      options.onActivateSuggestion(isActive ? null : suggestion.id);
    });
    root.append(trigger);

    if (isActive) {
      const panel = document.createElement("div");
      panel.className = "aiSuggestionPanel";

      const title = document.createElement("p");
      title.className = "aiSuggestionTitle";
      title.textContent = suggestion.suggestion.summary;
      panel.append(title);

      const prompt = document.createElement("p");
      prompt.className = "aiSuggestionPrompt";
      prompt.textContent = `指示: ${suggestion.prompt}`;
      panel.append(prompt);

      const meta = document.createElement("p");
      meta.className = "aiSuggestionPrompt";
      meta.textContent = `分類: ${suggestion.suggestion.category}`;
      panel.append(meta);

      if (suggestion.suggestion.reason) {
        const suggestionReason = document.createElement("p");
        suggestionReason.className = "aiSuggestionDiffReason";
        suggestionReason.textContent = suggestion.suggestion.reason;
        panel.append(suggestionReason);
      }

      const diffList = document.createElement("div");
      diffList.className = "aiSuggestionDiffList";
      suggestion.suggestion.operations.forEach((operation, operationIndex) => {
        diffList.append(createOperationDiff(suggestion, operation, operationIndex, options));
      });
      panel.append(diffList);

      const actions = document.createElement("div");
      actions.className = "aiSuggestionActions";

      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "aiSuggestionAccept";
      accept.textContent = "まとめて適用";
      accept.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onAcceptSuggestion(suggestion.id);
      });
      actions.append(accept);

      const discard = document.createElement("button");
      discard.type = "button";
      discard.className = "aiSuggestionDiscard";
      discard.textContent = "まとめて破棄";
      discard.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onDiscardSuggestion(suggestion.id);
      });
      actions.append(discard);

      panel.append(actions);
      root.append(panel);
    }

    return root;
  };
}

function buildDecorations(state: EditorState, pluginState: SuggestionDecorationState, options: SuggestionExtensionOptions) {
  const decorations = pluginState.suggestions
    .filter((suggestion) => Array.isArray(suggestion.suggestion?.operations))
    .map((suggestion) => {
    const position = getSuggestionAnchorPosition(state, suggestion);
    const isActive = pluginState.activeSuggestionId === suggestion.id;
    return Decoration.widget(
      Math.max(0, Math.min(position, state.doc.content.size)),
      createSuggestionWidget(suggestion, isActive, options),
      {
        ignoreSelection: true,
        side: 1,
        key: `ai-suggestion-${suggestion.id}-${isActive ? "open" : "closed"}`,
        stopEvent: (event) => {
          const target = event.target;
          return target instanceof HTMLElement && target.closest(".aiSuggestionWidget") !== null;
        },
      },
    );
    });

  return DecorationSet.create(state.doc, decorations);
}

export const createAiSuggestionDecorations = (options: SuggestionExtensionOptions) =>
  Extension.create({
    name: "aiSuggestionDecorations",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: aiSuggestionPluginKey,
          state: {
            init: (): SuggestionDecorationState => ({
              activeSuggestionId: null,
              suggestions: [],
            }),
            apply(transaction, value) {
              const meta = transaction.getMeta(aiSuggestionPluginKey) as Partial<SuggestionDecorationState> | undefined;
              if (!meta) {
                return value;
              }

              return {
                activeSuggestionId:
                  meta.activeSuggestionId !== undefined ? meta.activeSuggestionId : value.activeSuggestionId,
                suggestions: meta.suggestions ?? value.suggestions,
              };
            },
          },
          props: {
            decorations(state) {
              const pluginState = aiSuggestionPluginKey.getState(state);
              if (!pluginState) {
                return DecorationSet.empty;
              }
              return buildDecorations(state, pluginState, options);
            },
          },
        }),
      ];
    },
  });

export function setAiSuggestions(editor: Editor, suggestions: PendingAiSuggestion[]) {
  editor.view.dispatch(editor.state.tr.setMeta(aiSuggestionPluginKey, { suggestions }));
}

export function setActiveAiSuggestion(editor: Editor, activeSuggestionId: string | null) {
  editor.view.dispatch(editor.state.tr.setMeta(aiSuggestionPluginKey, { activeSuggestionId }));
}
