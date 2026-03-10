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
  handleInsertImage: () => void | Promise<void>;
  handleInsertLinkCard: () => void | Promise<void>;
  handlePickImage: () => void;
  htmlInputRef: RefObject<HTMLInputElement | null>;
  imageUrl: string;
  isDraggingImage: boolean;
  isFetchingLinkPreview: boolean;
  isUploadingImage: boolean;
  linkUrl: string;
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  setImageUrl: (value: string) => void;
  setLinkUrl: (value: string) => void;
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
  handleInsertImage,
  handleInsertLinkCard,
  handlePickImage,
  htmlInputRef,
  imageUrl,
  isDraggingImage,
  isFetchingLinkPreview,
  isUploadingImage,
  linkUrl,
  onTitleChange,
  setImageUrl,
  setLinkUrl,
  title,
  toolbarGroups,
}: EditorWorkspaceProps) {
  const [isKeywordPanelVisible, setIsKeywordPanelVisible] = useState(true);
  const [isTagPanelVisible, setIsTagPanelVisible] = useState(true);
  const [isKeywordDecided, setIsKeywordDecided] = useState(false);
  const [isTagDecided, setIsTagDecided] = useState(false);
  const mockKeywords = ["生成AI", "広報戦略", "業務効率化"];
  const mockTags = ["#PR", "#AI", "#ドラフト"];
  const [mockChecklistItems, setMockChecklistItems] = useState([
    { id: "headline", label: "見出しが30文字前後で要点を含む", done: true },
    { id: "summary", label: "本文冒頭に結論と背景がある", done: false },
    { id: "source", label: "リンク先の信頼性を確認済み", done: false },
    { id: "cta", label: "読者向けの次アクションが明確", done: true },
  ]);

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

      <section className="linkAssistLayout" aria-label="リンク補助モックUI">
        <div className="linkChecklistHoverArea">
          <button type="button" className="linkChecklistHoverButton">
            AIチェックリスト（mock）
          </button>
          <section className="linkChecklistMock" aria-label="リンクカード生成チェックリスト（モック）">
            <p className="linkChecklistMockTitle">AIチェックリスト（mock）</p>
            <ul className="linkChecklistMockList">
              {mockChecklistItems.map((item) => (
                <li key={item.id} className="linkChecklistMockItem">
                  <label className="linkChecklistMockLabel">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() =>
                        setMockChecklistItems((current) =>
                          current.map((currentItem) =>
                            currentItem.id === item.id ? { ...currentItem, done: !currentItem.done } : currentItem,
                          ),
                        )
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="linkChecklistRow">
          <section className="linkChecklistMockInline" aria-label="常時表示チェックリスト（モック）">
            <p className="linkChecklistMockTitle">常時表示チェックリスト（mock）</p>
            <ul className="linkChecklistMockList">
              {mockChecklistItems.map((item) => (
                <li key={`inline-${item.id}`} className="linkChecklistMockItem">
                  <label className="linkChecklistMockLabel">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() =>
                        setMockChecklistItems((current) =>
                          current.map((currentItem) =>
                            currentItem.id === item.id ? { ...currentItem, done: !currentItem.done } : currentItem,
                          ),
                        )
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <div className="linkInputStack">
            <div className="imageForm">
              <input
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="画像URLを入力してください (https://...)"
                className="imageInput"
              />
              <button
                type="button"
                onClick={() => void handleInsertImage()}
                className="imageButton"
                disabled={isUploadingImage}
              >
                画像を挿入
              </button>
              <button
                type="button"
                onClick={handlePickImage}
                className="imageButton imageButtonSecondary"
                disabled={isUploadingImage}
              >
                画像ファイルを選択
              </button>
            </div>

            <div className="linkCardForm">
              <input
                type="url"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="リンクURLを入力してください (https://...)"
                className="imageInput"
              />
              <button
                type="button"
                onClick={() => void handleInsertLinkCard()}
                className="imageButton"
                disabled={isFetchingLinkPreview}
              >
                {isFetchingLinkPreview ? "取得中..." : "リンクカードを追加"}
              </button>
            </div>
          </div>
        </div>
      </section>

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
