import { EditorContent, type Editor } from "@tiptap/react";
import type { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { Bot, Check, Plus, Tag, Trash2 } from "lucide-react";

import type { ToolbarGroupConfig } from "../types";
import { EditorToolbar } from "./EditorToolbar";

type EditorWorkspaceProps = {
  editor: Editor;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleDrop: (event: DragEvent<HTMLDivElement>) => void | Promise<void>;
  handleImageSelected: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  handleImportHtml: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  htmlInputRef: RefObject<HTMLInputElement | null>;
  isDraggingImage: boolean;
  isUploadingImage: boolean;
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  title: string;
  toolbarGroups: ToolbarGroupConfig[];
};

function normalizeMetaValue(value: string, withHash = false): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (!withHash) {
    return trimmed;
  }

  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function EditorWorkspace({
  editor,
  fileInputRef,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleImageSelected,
  handleImportHtml,
  htmlInputRef,
  isDraggingImage,
  isUploadingImage,
  onTitleChange,
  title,
  toolbarGroups,
}: EditorWorkspaceProps) {
  const metaWidthStorageKey = "press-release-editor-meta-width";
  const contentLayoutRef = useRef<HTMLDivElement | null>(null);
  const [metaPanelWidth, setMetaPanelWidth] = useState(() => {
    if (typeof window === "undefined") {
      return 260;
    }
    const raw = window.localStorage.getItem(metaWidthStorageKey);
    const value = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(value) ? Math.min(360, Math.max(220, value)) : 260;
  });
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(["#PR"]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>(["#AI", "#ドラフト"]);

  const addTag = () => {
    const nextTag = normalizeMetaValue(tagInput, true);
    if (!nextTag || tags.includes(nextTag)) {
      return;
    }
    setTags((current) => [...current, nextTag]);
    setTagInput("");
  };

  const applySuggestedTag = (tag: string) => {
    setTags((current) => (current.includes(tag) ? current : [...current, tag]));
    setSuggestedTags((current) => current.filter((item) => item !== tag));
  };

  const discardSuggestedTag = (tag: string) => {
    setSuggestedTags((current) => current.filter((item) => item !== tag));
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(metaWidthStorageKey, String(metaPanelWidth));
  }, [metaPanelWidth]);

  const handleMetaResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    const layout = contentLayoutRef.current;
    if (!layout) {
      return;
    }

    event.preventDefault();
    const bounds = layout.getBoundingClientRect();
    const startX = event.clientX;
    const startWidth = metaPanelWidth;
    const minWidth = 220;
    const maxWidth = Math.min(420, Math.max(minWidth, bounds.width - 320));
    document.body.classList.add("is-resizing-panels");

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
      setMetaPanelWidth(nextWidth);
    };

    const handlePointerUp = () => {
      document.body.classList.remove("is-resizing-panels");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div className="editorWrapper">
      <div className="titleInputWrapper">
        <input
          type="text"
          value={title}
          onChange={onTitleChange}
          placeholder="タイトルを入力してください"
          className="titleInput"
        />
      </div>

      <EditorToolbar toolbarGroups={toolbarGroups} />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hiddenFileInput"
        onChange={(event) => void handleImageSelected(event)}
      />
      <input
        ref={htmlInputRef}
        type="file"
        multiple
        accept=".html,text/html,image/*"
        className="hiddenFileInput"
        onChange={(event) => void handleImportHtml(event)}
      />

      <div
        ref={contentLayoutRef}
        className="editorContentLayout"
        style={{ gridTemplateColumns: `${metaPanelWidth}px 12px minmax(0, 1fr)` }}
      >
        <section className="editorMetaPanel" aria-label="タグ">
          <div className="editorMetaPanelHeader">
            <span className="editorMetaPanelTitle">タグ</span>
          </div>
          <p className="editorMetaPanelDescription">タグを設定すると、検索されやすくなり、記事の意図も伝わりやすくなります。</p>

          <div className="editorMetaCards">
              <div className="editorMetaContent">
              <div className="editorMetaInputRow">
                <input
                  type="text"
                  className="editorMetaInput"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="タグを追加"
                />
                <button type="button" className="metaAppendButton" onClick={addTag}>
                  追加
                </button>
              </div>
              <div className="editorMetaSection">
                <span className="editorMetaSectionLabel">現在のタグ</span>
                <div className="editorMetaChipList">
                  {tags.map((tag) => (
                    <span key={tag} className="editorMetaChip">
                      <Check className="editorMetaChipIcon" aria-hidden="true" />
                      {tag}
                      <button
                        type="button"
                        className="editorMetaChipRemove"
                        onClick={() => setTags((current) => current.filter((item) => item !== tag))}
                        aria-label={`${tag} を削除`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="editorMetaSection">
                <span className="editorMetaSectionLabel">AIの提案</span>
                <div className="editorMetaSuggestionList">
                  {suggestedTags.length === 0 && (
                    <p className="editorMetaSuggestionEmpty">AIからのタグ提案はありません。</p>
                  )}
                  {suggestedTags.map((tag) => (
                    <div key={tag} className="editorMetaSuggestionItem">
                      <div className="editorMetaSuggestionBody">
                        <div className="editorMetaSuggestionSummary">
                          <span className="editorMetaSuggestionBadge">
                            <Bot className="editorMetaChipIcon" aria-hidden="true" />
                            AI提案
                          </span>
                          <strong className="editorMetaSuggestionValue">
                            <Tag className="editorMetaChipIcon" aria-hidden="true" />
                            {tag}
                          </strong>
                        </div>
                        <p className="editorMetaSuggestionDescription">反映すると追加されます</p>
                      </div>
                      <div className="editorMetaSuggestionActions">
                        <button type="button" className="metaAppendButton" onClick={() => applySuggestedTag(tag)}>
                          <Plus className="editorMetaActionIcon" aria-hidden="true" />
                          追加する
                        </button>
                        <button type="button" className="metaRejectButton" onClick={() => discardSuggestedTag(tag)}>
                          <Trash2 className="editorMetaActionIcon" aria-hidden="true" />
                          見送る
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>
          </div>
        </section>

        <div
          className="paneResizeHandle"
          role="separator"
          aria-orientation="vertical"
          aria-label="メタデータ列の幅を調整"
          onPointerDown={handleMetaResizeStart}
        />

        <div
          className={`dropZone${isDraggingImage ? " is-dragging" : ""}${isUploadingImage ? " is-uploading" : ""}`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(event) => void handleDrop(event)}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
