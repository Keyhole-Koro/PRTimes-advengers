import { Node, mergeAttributes } from "@tiptap/core";

export const LinkCard = Node.create({
  name: "linkCard",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
      image: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-link-card="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const image = typeof HTMLAttributes.image === "string" ? HTMLAttributes.image : null;

    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-link-card": "true",
        class: "linkCard",
        href: HTMLAttributes.url,
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      [
        "span",
        { class: "linkCardBody" },
        image ? ["img", { class: "linkCardImage", src: image, alt: HTMLAttributes.title }] : ["span", { class: "linkCardImagePlaceholder" }, "LINK"],
        [
          "span",
          { class: "linkCardText" },
          ["span", { class: "linkCardTitle" }, HTMLAttributes.title],
          ["span", { class: "linkCardDescription" }, HTMLAttributes.description || ""],
          ["span", { class: "linkCardUrl" }, HTMLAttributes.url],
        ],
      ],
    ];
  },
});
