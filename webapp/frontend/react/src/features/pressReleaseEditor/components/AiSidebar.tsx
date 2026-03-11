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
import {
  ArrowDownCircle,
  Bot,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CircleEllipsis,
  Eraser,
  FileText,
  ImagePlus,
  MessageSquarePlus,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";

import type { AiAgentSettings, AiChatMessage, AiChatThread, AiComposerAttachment } from "../hooks/useAiAssistant";
import { formatAiMessageTime, formatAiThreadTime } from "../hooks/useAiAssistant";
import "./AiSidebar.css";

const AI_STYLE_OPTIONS = ["", "プレスリリース標準", "ニュースライク", "やわらかめ", "採用向け", "商品訴求寄り"];
const AI_TONE_OPTIONS = ["", "簡潔", "丁寧", "力強い", "親しみやすい", "落ち着いた"];
const AI_FOCUS_POINT_OPTIONS = ["タイトル", "導入文", "本文構成", "見出し", "CTA"];
const AI_PRIORITY_CHECK_OPTIONS = ["誤字脱字", "表記ゆれ", "読みやすさ", "リスク表現", "数字・日付の整合性"];

function formatAttachmentSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

export type AiSidebarProps = {
  activeAiMessages: AiChatMessage[];
  aiSettings: AiAgentSettings;
  activeAiThread: AiChatThread | null;
  activeAiThreadId: string;
  aiAttachmentError: string | null;
  aiMessagesContainerRef: RefObject<HTMLDivElement | null>;
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
  handleJumpToSuggestion: (messageId: string) => void;
  handleClearAiComposer: () => void;
  handleCreateAiThread: () => void;
  handleDeleteAiThread: (thread: AiChatThread) => void;
  handleRenameAiThread: (thread: AiChatThread) => void;
  isAiHistoryOpen: boolean;
  isAiAttachMenuOpen: boolean;
  isAiResponding: boolean;
  resetAiSettings: () => void;
  removeComposerAttachment: (attachmentId: string) => void;
  respondingAiThreadId: string | null;
  setActiveAiThreadId: (threadId: string) => void;
  setAiSettingText: (
    field: "targetAudience" | "writingStyle" | "tone" | "brandVoice" | "consistencyPolicy",
    value: string,
  ) => void;
  setAiPrompt: (value: string) => void;
  setIsAiAttachMenuOpen: (open: boolean) => void;
  setAiThreadMenuOpenId: Dispatch<SetStateAction<string | null>>;
  setIsAiHistoryOpen: (open: boolean) => void;
  toggleAiSettingListValue: (field: "focusPoints" | "priorityChecks", value: string) => void;
};

const AI_DEFAULT_THREAD_TITLE = "新しいチャット";

export function AiSidebar({
  activeAiMessages,
  aiSettings,
  activeAiThread,
  activeAiThreadId,
  aiAttachmentError,
  aiMessagesContainerRef,
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
  handleJumpToSuggestion,
  handleClearAiComposer,
  handleCreateAiThread,
  handleDeleteAiThread,
  handleRenameAiThread,
  isAiHistoryOpen,
  isAiAttachMenuOpen,
  isAiResponding,
  resetAiSettings,
  removeComposerAttachment,
  respondingAiThreadId,
  setActiveAiThreadId,
  setAiSettingText,
  setAiPrompt,
  setIsAiAttachMenuOpen,
  setAiThreadMenuOpenId,
  setIsAiHistoryOpen,
  toggleAiSettingListValue,
}: AiSidebarProps) {
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const generalFileInputRef = useRef<HTMLInputElement | null>(null);
  const mixedFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);

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
        <h2 className="aiPanelTitle">
          <Sparkles className="aiIcon aiIcon-title" aria-hidden="true" />
          AIアシスタント
        </h2>
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
                <ChevronLeft className="aiIcon" aria-hidden="true" />
                履歴を閉じる
              </button>
              <button type="button" className="aiNewChatButton" onClick={handleCreateAiThread}>
                <MessageSquarePlus className="aiIcon" aria-hidden="true" />
                新しいチャット
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
                        <CircleEllipsis className="aiIcon" aria-hidden="true" />
                      </button>
                      {aiThreadMenuOpenId === thread.id && (
                        <div className="aiThreadMenu">
                          <button type="button" className="aiThreadMenuItem" onClick={() => handleRenameAiThread(thread)}>
                            <Pencil className="aiIcon" aria-hidden="true" />
                            名前変更
                          </button>
                          <button
                            type="button"
                            className="aiThreadMenuItem aiThreadMenuItemDanger"
                            onClick={() => handleDeleteAiThread(thread)}
                          >
                            <Trash2 className="aiIcon" aria-hidden="true" />
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
                <ChevronRight className="aiIcon" aria-hidden="true" />
                履歴を開く
              </button>
              <span className="aiActiveThreadTitle">{activeAiThread?.title ?? AI_DEFAULT_THREAD_TITLE}</span>
            </div>
            <div ref={aiMessagesContainerRef} className="aiChatList" aria-live="polite">
              {activeAiMessages.length === 0 && (
                <p className="aiEmpty">まだ会話はありません。下の入力欄から開始してください。</p>
              )}
              {activeAiMessages.map((message) => (
                <article key={message.id} className={`aiMessage aiMessage-${message.role}`}>
                  <header className="aiMessageHeader">
                    <span className="aiMessageRole">
                      {message.role === "user" ? (
                        <User className="aiIcon" aria-hidden="true" />
                      ) : (
                        <Bot className="aiIcon" aria-hidden="true" />
                      )}
                      {message.role === "user" ? "あなた" : "AI"}
                    </span>
                    <time className="aiMessageTime">{formatAiMessageTime(message.createdAt)}</time>
                  </header>
                  <p className="aiMessageBody">{message.text}</p>
                  {message.attachments && message.attachments.length > 0 && (
                    <ul className="aiMessageAttachmentList">
                      {message.attachments.map((attachment) => (
                        <li key={attachment.id} className="aiMessageAttachmentItem">
                          {attachment.kind === "image" ? (
                            <ImagePlus className="aiIcon" aria-hidden="true" />
                          ) : (
                            <FileText className="aiIcon" aria-hidden="true" />
                          )}
                          {attachment.kind === "image" ? "画像" : "ファイル"}: {attachment.name} ({formatAttachmentSize(attachment.size)})
                        </li>
                      ))}
                    </ul>
                  )}
                  {message.documentEditResult && (
                    <button type="button" className="aiMessageHintButton" onClick={() => handleJumpToSuggestion(message.id)}>
                      <ArrowDownCircle className="aiIcon" aria-hidden="true" />
                      {message.documentEditResult.navigation_label}
                    </button>
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
                        {attachment.kind === "image" ? (
                          <ImagePlus className="aiIcon" aria-hidden="true" />
                        ) : (
                          <FileText className="aiIcon" aria-hidden="true" />
                        )}
                        {attachment.kind === "image" ? "画像" : "ファイル"}: {attachment.name} ({formatAttachmentSize(attachment.size)})
                      </span>
                      <button
                        type="button"
                        className="aiComposerAttachmentRemove"
                        onClick={() => removeComposerAttachment(attachment.id)}
                        aria-label={`${attachment.name} を削除`}
                      >
                        <X className="aiIcon" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {aiAttachmentError && <p className="aiComposerError">{aiAttachmentError}</p>}
              <section className="aiSettingsPanel" aria-label="AI設定">
                <div className="aiSettingsHeader">
                  <button
                    type="button"
                    className="aiSettingsToggle"
                    onClick={() => setIsAiSettingsOpen((current) => !current)}
                    aria-expanded={isAiSettingsOpen}
                  >
                    <div>
                      <p className="aiSettingsEyebrow">AI設定</p>
                      <p className="aiSettingsDescription">想定読者や文体を指定して、提案の方向性をそろえます。</p>
                    </div>
                    {isAiSettingsOpen ? (
                      <ChevronUp className="aiIcon" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="aiIcon" aria-hidden="true" />
                    )}
                  </button>
                  <button type="button" className="aiSettingsResetButton" onClick={resetAiSettings}>
                    リセット
                  </button>
                </div>
                {isAiSettingsOpen && (
                  <>
                    <div className="aiSettingsGrid">
                      <label className="aiSettingsField">
                        <span className="aiSettingsLabel">ターゲット</span>
                        <input
                          className="aiSettingsInput"
                          type="text"
                          value={aiSettings.targetAudience}
                          onChange={(event) => setAiSettingText("targetAudience", event.target.value)}
                          placeholder="例: 記者、求職者、既存顧客"
                        />
                      </label>
                      <label className="aiSettingsField">
                        <span className="aiSettingsLabel">文章スタイル</span>
                        <select
                          className="aiSettingsSelect"
                          value={aiSettings.writingStyle}
                          onChange={(event) => setAiSettingText("writingStyle", event.target.value)}
                        >
                          {AI_STYLE_OPTIONS.map((option) => (
                            <option key={option || "default"} value={option}>
                              {option || "指定なし"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="aiSettingsField">
                        <span className="aiSettingsLabel">トーン</span>
                        <select
                          className="aiSettingsSelect"
                          value={aiSettings.tone}
                          onChange={(event) => setAiSettingText("tone", event.target.value)}
                        >
                          {AI_TONE_OPTIONS.map((option) => (
                            <option key={option || "default"} value={option}>
                              {option || "指定なし"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="aiSettingsField">
                        <span className="aiSettingsLabel">ブランド方針</span>
                        <input
                          className="aiSettingsInput"
                          type="text"
                          value={aiSettings.brandVoice}
                          onChange={(event) => setAiSettingText("brandVoice", event.target.value)}
                          placeholder="例: 信頼感重視、誠実、専門性を強調"
                        />
                      </label>
                      <label className="aiSettingsField aiSettingsField-wide">
                        <span className="aiSettingsLabel">固定方針</span>
                        <textarea
                          className="aiSettingsTextarea"
                          value={aiSettings.consistencyPolicy}
                          onChange={(event) => setAiSettingText("consistencyPolicy", event.target.value)}
                          placeholder="例: 見出しは簡潔に保つ、です・ます調を維持、煽り表現は避ける"
                          rows={3}
                        />
                      </label>
                    </div>
                    <div className="aiSettingsGroup">
                      <span className="aiSettingsLabel">重視ポイント</span>
                      <div className="aiSettingsChips">
                        {AI_FOCUS_POINT_OPTIONS.map((option) => {
                          const isActive = aiSettings.focusPoints.includes(option);
                          return (
                            <button
                              key={option}
                              type="button"
                              className={`aiSettingsChip${isActive ? " is-active" : ""}`}
                              onClick={() => toggleAiSettingListValue("focusPoints", option)}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="aiSettingsGroup">
                      <span className="aiSettingsLabel">優先チェック</span>
                      <div className="aiSettingsChips">
                        {AI_PRIORITY_CHECK_OPTIONS.map((option) => {
                          const isActive = aiSettings.priorityChecks.includes(option);
                          return (
                            <button
                              key={option}
                              type="button"
                              className={`aiSettingsChip${isActive ? " is-active" : ""}`}
                              onClick={() => toggleAiSettingListValue("priorityChecks", option)}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </section>
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
                    <Plus className="aiIcon" aria-hidden="true" />
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
                            <ImagePlus className="aiIcon" aria-hidden="true" />
                            写真を追加
                          </button>
                          <button
                            type="button"
                            className="aiAttachMenuItem"
                            onClick={() => generalFileInputRef.current?.click()}
                          >
                            <Paperclip className="aiIcon" aria-hidden="true" />
                            ファイルを追加
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="aiAttachMenuItem"
                          onClick={() => mixedFileInputRef.current?.click()}
                        >
                          <Paperclip className="aiIcon" aria-hidden="true" />
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
                    <Eraser className="aiIcon" aria-hidden="true" />
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
                  {isAiResponding ? <Sparkles className="aiIcon" aria-hidden="true" /> : <Send className="aiIcon" aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
