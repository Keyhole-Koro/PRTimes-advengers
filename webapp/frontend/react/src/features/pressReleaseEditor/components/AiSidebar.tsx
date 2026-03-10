import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from "react";

import type { AiChatMessage, AiChatThread } from "../hooks/useAiAssistant";
import { formatAiMessageTime, formatAiThreadTime } from "../hooks/useAiAssistant";
import "./AiSidebar.css";

export type AiSidebarProps = {
  activeAiMessages: AiChatMessage[];
  activeAiThread: AiChatThread | null;
  activeAiThreadId: string;
  aiMessagesEndRef: RefObject<HTMLDivElement | null>;
  aiPrompt: string;
  aiThreadMenuOpenId: string | null;
  aiThreads: AiChatThread[];
  handleAiEcho: () => void;
  handleAiInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleCreateAiThread: () => void;
  handleDeleteAiThread: (thread: AiChatThread) => void;
  handleRenameAiThread: (thread: AiChatThread) => void;
  isAiHistoryOpen: boolean;
  isAiResponding: boolean;
  respondingAiThreadId: string | null;
  setActiveAiThreadId: (threadId: string) => void;
  setAiPrompt: (value: string) => void;
  setAiThreadMenuOpenId: Dispatch<SetStateAction<string | null>>;
  setIsAiHistoryOpen: (open: boolean) => void;
};

const AI_DEFAULT_THREAD_TITLE = "新しいチャット";

export function AiSidebar({
  activeAiMessages,
  activeAiThread,
  activeAiThreadId,
  aiMessagesEndRef,
  aiPrompt,
  aiThreadMenuOpenId,
  aiThreads,
  handleAiEcho,
  handleAiInputKeyDown,
  handleCreateAiThread,
  handleDeleteAiThread,
  handleRenameAiThread,
  isAiHistoryOpen,
  isAiResponding,
  respondingAiThreadId,
  setActiveAiThreadId,
  setAiPrompt,
  setAiThreadMenuOpenId,
  setIsAiHistoryOpen,
}: AiSidebarProps) {
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
              </article>
            ))}
            {respondingAiThreadId === activeAiThread?.id && <p className="aiTyping">AIが返信を作成中です...</p>}
            <div ref={aiMessagesEndRef} />
            </div>

            <div className="aiComposer">
              <textarea
                className="aiComposerInput"
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                onKeyDown={handleAiInputKeyDown}
                placeholder="AIに質問してみましょう"
                rows={3}
              />
              <div className="aiComposerFooter">
                <div className="aiComposerLeft">
                  <button type="button" className="aiComposerIconButton" aria-label="追加オプション">
                    +
                  </button>
                  <button
                    type="button"
                    className="aiComposerLinkButton"
                    onClick={() => setAiPrompt("")}
                    disabled={aiPrompt.trim() === ""}
                  >
                    入力をクリア
                  </button>
                </div>
                <button
                  type="button"
                  className="aiComposerSendButton"
                  onClick={handleAiEcho}
                  disabled={isAiResponding || aiPrompt.trim() === ""}
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
