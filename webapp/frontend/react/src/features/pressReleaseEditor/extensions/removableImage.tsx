import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

function RemovableImageView({ deleteNode, node, selected }: NodeViewProps) {
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";

  return (
    <NodeViewWrapper
      as="figure"
      className={`editorImageNode${selected ? " is-selected" : ""}`}
    >
      <button
        type="button"
        className="editorImageDeleteButton"
        aria-label="画像を削除"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          deleteNode();
        }}
      >
        ×
      </button>
      <img src={src} alt={alt} draggable="true" />
    </NodeViewWrapper>
  );
}

export const RemovableImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(RemovableImageView);
  },
});
