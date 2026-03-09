import { Mark, mergeAttributes } from "@tiptap/core";

export const CommentHighlight = Mark.create({
  name: "commentHighlight",

  // Allow multiple commentHighlight marks on the same text (different threads)
  excludes: "",

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-thread-id");
          return raw ? Number(raw) : null;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-thread-id": attributes.threadId,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-thread-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "commentHighlight",
      }),
      0,
    ];
  },
});
