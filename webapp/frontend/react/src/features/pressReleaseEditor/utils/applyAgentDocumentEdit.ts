import type { JSONContent } from "@tiptap/core";

import type { AgentDocumentBlock, AgentDocumentEditOperation, AgentDocumentEditSuggestion } from "../types";

type IndexedNode = {
  id: string | null;
  node: JSONContent;
};

export type IndexedBlockPosition = {
  id: string;
  from: number;
  to: number;
};

function mapNodeType(type: string | undefined): AgentDocumentBlock["type"] | null {
  switch (type) {
    case "heading":
      return "heading";
    case "paragraph":
      return "paragraph";
    case "bulletList":
      return "bullet_list";
    case "orderedList":
      return "ordered_list";
    case "blockquote":
      return "blockquote";
    default:
      return null;
  }
}

function buildParagraphNode(text: string): JSONContent {
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text }] : [],
  };
}

function buildNodeFromBlock(block: AgentDocumentBlock): JSONContent {
  if (block.type === "heading") {
    const level = typeof block.attrs?.level === "number" ? block.attrs.level : 1;
    return {
      type: "heading",
      attrs: { level },
      content: block.text ? [{ type: "text", text: block.text }] : [],
    };
  }

  if (block.type === "blockquote") {
    return {
      type: "blockquote",
      content: [buildParagraphNode(block.text)],
    };
  }

  if (block.type === "bullet_list" || block.type === "ordered_list") {
    const items = block.text
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      type: block.type === "bullet_list" ? "bulletList" : "orderedList",
      content: (items.length > 0 ? items : [""]).map((item) => ({
        type: "listItem",
        content: [buildParagraphNode(item)],
      })),
    };
  }

  return buildParagraphNode(block.text);
}

function buildIndexedNodes(document: JSONContent): IndexedNode[] {
  const nodes = document.content ?? [];
  let blockIndex = 0;

  return nodes.map((node) => {
    const supported = mapNodeType(node.type);
    if (!supported) {
      return { id: null, node };
    }

    blockIndex += 1;
    return {
      id: `block-${blockIndex}`,
      node,
    };
  });
}

export function buildIndexedBlockPositions(document: JSONContent): IndexedBlockPosition[] {
  const nodes = document.content ?? [];
  const positions: IndexedBlockPosition[] = [];
  let blockIndex = 0;
  let cursor = 0;

  for (const node of nodes) {
    const nodeSize = typeof (node as { nodeSize?: unknown }).nodeSize === "number" ? ((node as { nodeSize: number }).nodeSize) : 0;
    const supported = mapNodeType(node.type);

    if (supported) {
      blockIndex += 1;
      positions.push({
        id: `block-${blockIndex}`,
        from: cursor,
        to: cursor + nodeSize,
      });
    }

    cursor += nodeSize;
  }

  return positions;
}

function findIndexByBlockId(nodes: IndexedNode[], blockId: string): number {
  return nodes.findIndex((entry) => entry.id === blockId);
}

function applyOperations(document: JSONContent, operations: AgentDocumentEditOperation[]): JSONContent {
  const indexedNodes = buildIndexedNodes(document);

  for (const operation of operations) {
    if (operation.op === "title_modify") {
      continue;
    }

    if (operation.op === "add") {
      const targetIndex = operation.after_block_id === null ? 0 : findIndexByBlockId(indexedNodes, operation.after_block_id) + 1;
      indexedNodes.splice(targetIndex < 0 ? indexedNodes.length : targetIndex, 0, {
        id: operation.block.id,
        node: buildNodeFromBlock(operation.block),
      });
      continue;
    }

    if (operation.op === "remove") {
      const targetIndex = findIndexByBlockId(indexedNodes, operation.block_id);
      if (targetIndex >= 0) {
        indexedNodes.splice(targetIndex, 1);
      }
      continue;
    }

    const targetIndex = findIndexByBlockId(indexedNodes, operation.block_id);
    if (targetIndex >= 0) {
      indexedNodes[targetIndex] = {
        id: operation.after.id,
        node: buildNodeFromBlock(operation.after),
      };
    }
  }

  return {
    type: "doc",
    content: indexedNodes.map((entry) => entry.node),
  };
}

export function applyAgentDocumentOperation(document: JSONContent, operation: AgentDocumentEditOperation): JSONContent {
  return applyOperations(document, [operation]);
}

export function applyAgentDocumentSuggestion(document: JSONContent, suggestion: AgentDocumentEditSuggestion): JSONContent {
  return applyOperations(document, suggestion.operations);
}

export function getSuggestedTitle(operations: AgentDocumentEditOperation[]): string | null {
  const titleOperation = operations.find((operation) => operation.op === "title_modify");
  return titleOperation?.op === "title_modify" ? titleOperation.after_title : null;
}
