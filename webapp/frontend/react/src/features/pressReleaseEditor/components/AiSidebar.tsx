import { useEffect, useRef, useState } from "react";
import type {
  ChangeEvent,
  ClipboardEvent,
  Dispatch,
  KeyboardEvent,
  MouseEvent,
  RefObject,
  SetStateAction,
} from "react";

import type { AiChatMessage, AiChatThread, AiComposerAttachment } from "../hooks/useAiAssistant";
import { formatAiMessageTime, formatAiThreadTime } from "../hooks/useAiAssistant";
import "./AiSidebar.css";

function formatAttachmentSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

export type AiSidebarProps = {
  activeAiMessages: AiChatMessage[];
  activeAiThread: AiChatThread | null;
  activeAiThreadId: string;
  aiAttachmentError: string | null;
  aiMessagesEndRef: RefObject<HTMLDivElement | null>;
  aiPrompt: string;
  aiThreadMenuOpenId: string | null;
  aiThreads: AiChatThread[];
  composerAttachments: AiComposerAttachment[];
  handleAiMixedFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleAiGeneralFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleAiEcho: () => void;
  handleAiImageFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleAiInputPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  handleAiInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleClearAiComposer: () => void;
  handleCreateAiThread: () => void;
  handleDeleteAiThread: (thread: AiChatThread) => void;
  handleRenameAiThread: (thread: AiChatThread) => void;
  isAiHistoryOpen: boolean;
  isAiAttachMenuOpen: boolean;
  isAiResponding: boolean;
  removeComposerAttachment: (attachmentId: string) => void;
  respondingAiThreadId: string | null;
  setActiveAiThreadId: (threadId: string) => void;
  setAiPrompt: (value: string) => void;
  setIsAiAttachMenuOpen: (open: boolean) => void;
  setAiThreadMenuOpenId: Dispatch<SetStateAction<string | null>>;
  setIsAiHistoryOpen: (open: boolean) => void;
};

const AI_DEFAULT_THREAD_TITLE = "新しいチャット";

export function AiSidebar({
  activeAiMessages,
  activeAiThread,
  activeAiThreadId,
  aiAttachmentError,
  aiMessagesEndRef,
  aiPrompt,
  aiThreadMenuOpenId,
  aiThreads,
  composerAttachments,
  handleAiMixedFileChange,
  handleAiGeneralFileChange,
  handleAiEcho,
  handleAiImageFileChange,
  handleAiInputPaste,
  handleAiInputKeyDown,
  handleClearAiComposer,
  handleCreateAiThread,
  handleDeleteAiThread,
  handleRenameAiThread,
  isAiHistoryOpen,
  isAiAttachMenuOpen,
  isAiResponding,
  removeComposerAttachment,
  respondingAiThreadId,
  setActiveAiThreadId,
  setAiPrompt,
  setIsAiAttachMenuOpen,
  setAiThreadMenuOpenId,
  setIsAiHistoryOpen,
}: AiSidebarProps) {
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const generalFileInputRef = useRef<HTMLInputElement | null>(null);
  const mixedFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const handleChange = () => setIsTouchLikeDevice(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const handleToggleAttachMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsAiAttachMenuOpen(!isAiAttachMenuOpen);
  };

  return (
    <section className="aiPanel" aria-label="AIアシスタント">
      <div className="aiPanelHeader">
        <h2 className="aiPanelTitle">AIアシスタント</h2>
        <p className="aiPanelDescription">
          チャットを選択して会話できます。Enterで送信、Shift+Enterで改行できます。
        </p>
      </div>

      <div className={`aiLayout${isAiHistoryOpen ? " is-thread-open" : ""}`}>
        {isAiHistoryOpen ? (
          <aside className="aiThreadPane" aria-label="AIチャット一覧">
            <div className="aiThreadPaneHeader">
              <button
                type="button"
                className="aiHistoryToggle"
                onClick={() => {
                  setIsAiHistoryOpen(false);
                  setAiThreadMenuOpenId(null);
                }}
              >
                ← 履歴を閉じる
              </button>
              <button type="button" className="aiNewChatButton" onClick={handleCreateAiThread}>
                + 新しいチャット
              </button>
            </div>
            <div className="aiThreadList">
              {aiThreads.map((thread) => {
                const lastMessage = thread.messages[thread.messages.length - 1];
                return (
                  <article
                    key={thread.id}
                    className={`aiThreadItem${thread.id === activeAiThreadId ? " is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="aiThreadMain"
                      onClick={() => {
                        setActiveAiThreadId(thread.id);
                        setAiThreadMenuOpenId(null);
                        setIsAiHistoryOpen(false);
                      }}
                    >
                      <span className="aiThreadTitle">{thread.title}</span>
                      <span className="aiThreadPreview">{lastMessage ? lastMessage.text.slice(0, 36) : "メッセージなし"}</span>
                      <span className="aiThreadTime">{formatAiThreadTime(thread.updatedAt)}</span>
                    </button>
                    <div className="aiThreadMenuWrap">
                      <button
                        type="button"
                        className="aiThreadMenuButton"
                        onClick={() => setAiThreadMenuOpenId((current) => (current === thread.id ? null : thread.id))}
                        aria-label="チャットメニュー"
                      >
                        ⋯
                      </button>
                      {aiThreadMenuOpenId === thread.id && (
                        <div className="aiThreadMenu">
                          <button type="button" className="aiThreadMenuItem" onClick={() => handleRenameAiThread(thread)}>
                            名前変更
                          </button>
                          <button
                            type="button"
                            className="aiThreadMenuItem aiThreadMenuItemDanger"
                            onClick={() => handleDeleteAiThread(thread)}
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </aside>
        ) : (
          <div className="aiChatArea">
            <div className="aiChatTopBar">
            <button
              type="button"
              className="aiHistoryToggle"
              onClick={() => {
                setIsAiHistoryOpen(true);
                setAiThreadMenuOpenId(null);
              }}
            >
              ← 履歴を開く
            </button>
            <span className="aiActiveThreadTitle">{activeAiThread?.title ?? AI_DEFAULT_THREAD_TITLE}</span>
            </div>
            <div className="aiChatList" aria-live="polite">
            {activeAiMessages.length === 0 && (
              <p className="aiEmpty">まだ会話はありません。下の入力欄から開始してください。</p>
            )}
            {activeAiMessages.map((message) => (
              <article key={message.id} className={`aiMessage aiMessage-${message.role}`}>
                <header className="aiMessageHeader">
                  <span className="aiMessageRole">{message.role === "user" ? "あなた" : "AI"}</span>
                  <time className="aiMessageTime">{formatAiMessageTime(message.createdAt)}</time>
                </header>
                <p className="aiMessageBody">{message.text}</p>
                {message.attachments && message.attachments.length > 0 && (
                  <ul className="aiMessageAttachmentList">
                    {message.attachments.map((attachment) => (
                      <li key={attachment.id} className="aiMessageAttachmentItem">
                        {attachment.kind === "image" ? "画像" : "ファイル"}: {attachment.name} ({formatAttachmentSize(attachment.size)})
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
            {respondingAiThreadId === activeAiThread?.id && <p className="aiTyping">AIが返信を作成中です...</p>}
            <div ref={aiMessagesEndRef} />
            </div>

            <div className="aiComposer">
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="aiHiddenInput"
                onChange={handleAiImageFileChange}
              />
              <input
                ref={generalFileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.docx"
                multiple
                className="aiHiddenInput"
                onChange={handleAiGeneralFileChange}
              />
              <input
                ref={mixedFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.md,.docx"
                multiple
                className="aiHiddenInput"
                onChange={handleAiMixedFileChange}
              />
              {composerAttachments.length > 0 && (
                <ul className="aiComposerAttachmentList">
                  {composerAttachments.map((attachment) => (
                    <li key={attachment.id} className="aiComposerAttachmentItem">
                      <span className="aiComposerAttachmentLabel">
                        {attachment.kind === "image" ? "画像" : "ファイル"}: {attachment.name} ({formatAttachmentSize(attachment.size)})
                      </span>
                      <button
                        type="button"
                        className="aiComposerAttachmentRemove"
                        onClick={() => removeComposerAttachment(attachment.id)}
                        aria-label={`${attachment.name} を削除`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {aiAttachmentError && <p className="aiComposerError">{aiAttachmentError}</p>}
              <textarea
                className="aiComposerInput"
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                onKeyDown={handleAiInputKeyDown}
                onPaste={handleAiInputPaste}
                placeholder="AIに質問してみましょう"
                rows={3}
              />
              <div className="aiComposerFooter">
                <div className="aiComposerLeft">
                  <button
                    type="button"
                    className="aiComposerIconButton"
                    aria-label="追加オプション"
                    onClick={handleToggleAttachMenu}
                  >
                    +
                  </button>
                  {isAiAttachMenuOpen && (
                    <div className="aiAttachMenu">
                      {isTouchLikeDevice ? (
                        <>
                          <button
                            type="button"
                            className="aiAttachMenuItem"
                            onClick={() => imageFileInputRef.current?.click()}
                          >
                            写真を追加
                          </button>
                          <button
                            type="button"
                            className="aiAttachMenuItem"
                            onClick={() => generalFileInputRef.current?.click()}
                          >
                            ファイルを追加
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="aiAttachMenuItem"
                          onClick={() => mixedFileInputRef.current?.click()}
                        >
                          写真とファイルを追加
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className="aiComposerLinkButton"
                    onClick={handleClearAiComposer}
                    disabled={aiPrompt.trim() === "" && composerAttachments.length === 0}
                  >
                    入力をクリア
                  </button>
                </div>
                <button
                  type="button"
                  className="aiComposerSendButton"
                  onClick={handleAiEcho}
                  disabled={isAiResponding || (aiPrompt.trim() === "" && composerAttachments.length === 0)}
                  aria-label={isAiResponding ? "返信中" : "送信"}
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
