import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string | null) => ReturnType;
    };
  }
}

const SUPPORTED_NODE_TYPES = new Set(["paragraph", "heading", "blockquote", "listItem"]);

function shouldApplyLineHeight(node: ProseMirrorNode): boolean {
  return SUPPORTED_NODE_TYPES.has(node.type.name);
}

export const LineHeight = Extension.create({
  name: "lineHeight",
  addCommands() {
    return {
      setLineHeight:
        (lineHeight) =>
        ({ state, dispatch }) => {
          const { from, to } = state.selection;
          let transaction = state.tr;
          let hasChanged = false;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!shouldApplyLineHeight(node)) {
              return;
            }

            transaction = transaction.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              lineHeight,
            });
            hasChanged = true;
          });

          if (!hasChanged) {
            const parent = state.selection.$from.parent;
            if (!shouldApplyLineHeight(parent)) {
              return false;
            }

            const parentPos = state.selection.$from.before();
            transaction = transaction.setNodeMarkup(parentPos, undefined, {
              ...parent.attrs,
              lineHeight,
            });
            hasChanged = true;
          }

          if (!hasChanged) {
            return false;
          }

          dispatch?.(transaction);
          return true;
        },
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockquote", "listItem"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => {
              const dataLineHeight = element.getAttribute("data-line-height");
              if (dataLineHeight) {
                return dataLineHeight;
              }

              return element.style.lineHeight || null;
            },
            renderHTML: (attributes) =>
              attributes.lineHeight
                ? {
                    "data-line-height": attributes.lineHeight,
                    style: `line-height: ${attributes.lineHeight};`,
                  }
                : {},
          },
        },
      },
    ];
  },
});
