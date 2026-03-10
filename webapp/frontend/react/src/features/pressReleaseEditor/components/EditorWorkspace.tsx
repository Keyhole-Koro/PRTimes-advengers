import { EditorContent, type Editor } from "@tiptap/react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import { useState } from "react";

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
  const [isKeywordPanelVisible, setIsKeywordPanelVisible] = useState(true);
  const [isTagPanelVisible, setIsTagPanelVisible] = useState(true);
  const [isKeywordDecided, setIsKeywordDecided] = useState(false);
  const [isTagDecided, setIsTagDecided] = useState(false);
  const mockKeywords = ["生成AI", "広報戦略", "業務効率化"];
  const mockTags = ["#PR", "#AI", "#ドラフト"];

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
        className={`dropZone${isDraggingImage ? " is-dragging" : ""}${isUploadingImage ? " is-uploading" : ""}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(event) => void handleDrop(event)}
      >
        <div className="dropZoneHint">
          画像をここにドラッグ&ドロップして追加できます
          {isUploadingImage ? "（アップロード中...）" : ""}
        </div>
        <EditorContent editor={editor} />
      </div>

      <section className="editorMetaPanel" aria-label="AI連携用モック情報">
        <div className="editorMetaPanelHeader">
          <span className="editorMetaPanelTitle">AI連携モック</span>
          <div className="editorMetaRestoreButtons">
            {!isKeywordPanelVisible && (
              <button type="button" className="metaRestoreButton" onClick={() => setIsKeywordPanelVisible(true)}>
                キーワードを復元
              </button>
            )}
            {!isTagPanelVisible && (
              <button type="button" className="metaRestoreButton" onClick={() => setIsTagPanelVisible(true)}>
                タグを復元
              </button>
            )}
          </div>
        </div>

        <div className="editorMetaCards">
          {isKeywordPanelVisible && (
            <article className="editorMetaCard">
              <header className="editorMetaCardHeader">
                <h3 className="editorMetaCardTitle">キーワード</h3>
                <button
                  type="button"
                  className="metaDismissButton"
                  onClick={() => setIsKeywordPanelVisible(false)}
                  aria-label="キーワード枠を閉じる"
                >
                  ×
                </button>
              </header>
              <div className="editorMetaChipList">
                {mockKeywords.map((keyword) => (
                  <span key={keyword} className="editorMetaChip">
                    {keyword}
                  </span>
                ))}
              </div>
              <div className="editorMetaCardFooter">
                <button
                  type="button"
                  className={`metaDecisionButton${isKeywordDecided ? " is-decided" : ""}`}
                  onClick={() => setIsKeywordDecided((current) => !current)}
                >
                  {isKeywordDecided ? "キーワード決定を解除" : "キーワードを決定"}
                </button>
                <span className={`metaDecisionStatus${isKeywordDecided ? " is-decided" : ""}`}>
                  {isKeywordDecided ? "決定済み" : "未決定"}
                </span>
              </div>
            </article>
          )}

          {isTagPanelVisible && (
            <article className="editorMetaCard">
              <header className="editorMetaCardHeader">
                <h3 className="editorMetaCardTitle">タグ</h3>
                <button
                  type="button"
                  className="metaDismissButton"
                  onClick={() => setIsTagPanelVisible(false)}
                  aria-label="タグ枠を閉じる"
                >
                  ×
                </button>
              </header>
              <div className="editorMetaChipList">
                {mockTags.map((tag) => (
                  <span key={tag} className="editorMetaChip">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="editorMetaCardFooter">
                <button
                  type="button"
                  className={`metaDecisionButton${isTagDecided ? " is-decided" : ""}`}
                  onClick={() => setIsTagDecided((current) => !current)}
                >
                  {isTagDecided ? "タグ決定を解除" : "タグを決定"}
                </button>
                <span className={`metaDecisionStatus${isTagDecided ? " is-decided" : ""}`}>
                  {isTagDecided ? "決定済み" : "未決定"}
                </span>
              </div>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
