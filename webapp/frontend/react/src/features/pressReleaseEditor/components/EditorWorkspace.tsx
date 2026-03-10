import { EditorContent, type Editor } from "@tiptap/react";
import type { ChangeEvent, DragEvent, RefObject } from "react";

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
    </div>
  );
}
