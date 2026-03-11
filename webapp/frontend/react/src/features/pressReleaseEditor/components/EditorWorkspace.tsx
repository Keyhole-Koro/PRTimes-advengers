import { EditorContent, type Editor, useEditorState } from "@tiptap/react";
import type { ChangeEvent, DragEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleCheckBig, Eye, PencilLine, Plus, Sparkles, Tag, Trash2, WandSparkles } from "lucide-react";

import type { AiAgentSettings, AiSettingSuggestion } from "../hooks/useAiAssistant";
import { requestTagSuggestions } from "../infrastructure/aiApi";
import type { AiTagSuggestion, ToolbarGroupConfig } from "../types";
import { EditorToolbar } from "./EditorToolbar";

type AiTextField = "targetAudience" | "writingStyle" | "tone" | "brandVoice";
type AiListField = "focusPoints" | "priorityChecks";

type EditorWorkspaceProps = {
  aiSettingSuggestions: AiSettingSuggestion[];
  aiSettings: AiAgentSettings;
  editor: Editor;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleDrop: (event: DragEvent<HTMLDivElement>) => void | Promise<void>;
  handleImageSelected: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  handleImportHtml: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  htmlInputRef: RefObject<HTMLInputElement | null>;
  isAiSettingSuggestionsLoading: boolean;
  isDraggingImage: boolean;
  isUploadingImage: boolean;
  isRunningChecklistAction: boolean;
  onRunChecklistAction: (prompt: string, label: string) => void | Promise<void>;
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onReturnToList: () => void;
  pressReleaseId: number;
  runningChecklistActionLabel: string | null;
  setAiSettingText: (field: AiTextField, value: string) => void;
  title: string;
  toggleAiSettingListValue: (field: AiListField, value: string) => void;
  toolbarGroups: ToolbarGroupConfig[];
};

const WRITING_CHECKLIST_ITEMS = [
  {
    id: "headline",
    label: "タイトルを引き締める",
    description: "要点が先頭で伝わる短い見出しに整えます。",
    prompt: "このプレスリリースのタイトルを、要点がひと目で伝わるように簡潔で強い表現へ改善してください。",
  },
  {
    id: "lede",
    label: "導入文を明確にする",
    description: "冒頭で結論と価値が伝わるようにします。",
    prompt: "導入文を見直して、何を発表するのかと読者にとっての価値が冒頭で伝わるように改善してください。",
  },
  {
    id: "structure",
    label: "本文構成を整理する",
    description: "情報の順番を読みやすく並べ替えます。",
    prompt: "本文の構成を見直して、背景・発表内容・読者メリットの順で読みやすくなるように改善してください。",
  },
  {
    id: "risk",
    label: "リスク表現を確認する",
    description: "誤解や断定表現を抑えた表現に整えます。",
    prompt: "本文を確認し、強すぎる断定表現や誤解を招きやすい言い回しがあれば、自然で安全な表現に修正してください。",
  },
];

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
  aiSettingSuggestions,
  aiSettings,
  editor,
  fileInputRef,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleImageSelected,
  handleImportHtml,
  htmlInputRef,
  isAiSettingSuggestionsLoading,
  isDraggingImage,
  isUploadingImage,
  isRunningChecklistAction,
  onRunChecklistAction,
  onTitleChange,
  onReturnToList,
  pressReleaseId,
  runningChecklistActionLabel,
  setAiSettingText,
  title,
  toggleAiSettingListValue,
  toolbarGroups,
}: EditorWorkspaceProps) {
  const metaWidthStorageKey = "press-release-editor-meta-width";
  const contentLayoutRef = useRef<HTMLDivElement | null>(null);
  const [canvasMode, setCanvasMode] = useState<"edit" | "preview">("edit");
  const [metaPanelWidth, setMetaPanelWidth] = useState(() => {
    if (typeof window === "undefined") {
      return 300;
    }
    const raw = window.localStorage.getItem(metaWidthStorageKey);
    const value = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(value) ? Math.min(360, Math.max(220, value)) : 300;
  });
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(["#PR"]);
  const [dismissedSuggestedTags, setDismissedSuggestedTags] = useState<string[]>([]);
  const [completedChecklistItemIds, setCompletedChecklistItemIds] = useState<string[]>([]);
  const [aiTagSuggestions, setAiTagSuggestions] = useState<AiTagSuggestion[]>([]);
  const previewHtml = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor?.getHTML() ?? "",
  });
  const editorText = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor?.getText({ blockSeparator: "\n" }) ?? "",
  });
  const suggestedTags = useMemo(
    () => aiTagSuggestions.filter((tag) => !tags.includes(tag.label) && !dismissedSuggestedTags.includes(tag.label)),
    [aiTagSuggestions, dismissedSuggestedTags, tags],
  );
  const visibleChecklistItems = useMemo(
    () => WRITING_CHECKLIST_ITEMS.filter((item) => !completedChecklistItemIds.includes(item.id)),
    [completedChecklistItemIds],
  );

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
    setDismissedSuggestedTags((current) => current.filter((item) => item !== tag));
  };

  const discardSuggestedTag = (tag: string) => {
    setDismissedSuggestedTags((current) => (current.includes(tag) ? current : [...current, tag]));
  };

  const handleChecklistAction = async (itemId: string, prompt: string, label: string) => {
    await onRunChecklistAction(prompt, label);
    setCompletedChecklistItemIds((current) => (current.includes(itemId) ? current : [...current, itemId]));
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(metaWidthStorageKey, String(metaPanelWidth));
  }, [metaPanelWidth]);

  useEffect(() => {
    if (!title.trim() && !editorText.trim()) {
      setAiTagSuggestions([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void requestTagSuggestions({
        pressReleaseId,
        editor,
        title,
        aiSettings,
      })
        .then((result) => {
          setAiTagSuggestions(result.tags);
        })
        .catch((error) => {
          console.error("Failed to load AI tag suggestions:", error);
          setAiTagSuggestions([]);
        });
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [aiSettings, editor, editorText, pressReleaseId, title]);

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
        <button type="button" className="pressReleaseBackButton pressReleaseBackButton-inline" onClick={onReturnToList}>
          一覧へ戻る
        </button>
        <input
          type="text"
          value={title}
          onChange={onTitleChange}
          placeholder="タイトルを入力してください"
          className="titleInput"
        />
      </div>

      <EditorToolbar toolbarGroups={toolbarGroups} />

      <section className="editorUtilityBar" aria-label="編集補助バー">
        {(isAiSettingSuggestionsLoading || aiSettingSuggestions.length > 0) && (
          <div className="editorUtilityBarAssist">
            <section className="editorAiAssistStrip" aria-label="AI設定の補助提案">
              <div className="editorAiAssistHeader">
                <span className="editorAiAssistBadge">
                  <Sparkles className="editorMetaChipIcon" aria-hidden="true" />
                  推測
                </span>
                <p className="editorAiAssistText">
                  {isAiSettingSuggestionsLoading ? "AIが未設定の方針を推測中です。" : "未設定のAI方針を本文から補っています。"}
                </p>
              </div>
              <div className="editorAiAssistList">
                {isAiSettingSuggestionsLoading && aiSettingSuggestions.length === 0 && (
                  <article className="editorAiAssistCard editorAiAssistCard-loading">
                    <strong className="editorAiAssistPrompt">候補を整理しています...</strong>
                  </article>
                )}
                {aiSettingSuggestions.map((suggestion) => (
                  <article key={suggestion.field} className="editorAiAssistCard">
                    <strong className="editorAiAssistPrompt">{suggestion.prompt}</strong>
                    <div className="editorAiAssistOptions">
                      {suggestion.options.map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          className="editorAiAssistOption"
                          onClick={() => {
                            if (suggestion.field === "focusPoints" || suggestion.field === "priorityChecks") {
                              toggleAiSettingListValue(suggestion.field, option.value);
                              return;
                            }
                            setAiSettingText(suggestion.field, option.value);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        <div className="editorCanvasTabsRow">
          <div className="editorCanvasTabs" role="tablist" aria-label="編集ビュー切替">
            <button
              type="button"
              className={`editorCanvasTab${canvasMode === "edit" ? " is-active" : ""}`}
              onClick={() => setCanvasMode("edit")}
            >
              <PencilLine className="editorMetaChipIcon" aria-hidden="true" />
              編集
            </button>
            <button
              type="button"
              className={`editorCanvasTab${canvasMode === "preview" ? " is-active" : ""}`}
              onClick={() => setCanvasMode("preview")}
            >
              <Eye className="editorMetaChipIcon" aria-hidden="true" />
              プレビュー
            </button>
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
        ref={contentLayoutRef}
        className="editorContentLayout"
        style={{ gridTemplateColumns: `${metaPanelWidth}px 12px minmax(0, 1fr)` }}
      >
        <div className="editorMetaColumn">
          <section className="editorMetaPanel" aria-label="文章チェックリスト">
            <div className="editorMetaPanelHeader">
              <span className="editorMetaPanelTitle">チェックリスト</span>
            </div>
            <p className="editorMetaPanelDescription">良い文章に近づけるための定番タスクです。押すと AI がその観点で提案を作ります。</p>

            <div className="editorMetaCards">
              <div className="editorMetaChecklistList">
                {visibleChecklistItems.length === 0 && (
                  <p className="editorMetaChecklistEmpty">このチェックリストはすべて完了しました。</p>
                )}
                {visibleChecklistItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="editorMetaChecklistItem"
                    onClick={() => void handleChecklistAction(item.id, item.prompt, item.label)}
                    disabled={isRunningChecklistAction}
                  >
                    <div className="editorMetaChecklistBody">
                      <span className="editorMetaChecklistIcon">
                        {runningChecklistActionLabel === item.label ? (
                          <WandSparkles className="editorMetaChipIcon" aria-hidden="true" />
                        ) : (
                          <CircleCheckBig className="editorMetaChipIcon" aria-hidden="true" />
                        )}
                      </span>
                      <div className="editorMetaChecklistText">
                        <strong className="editorMetaChecklistLabel">{item.label}</strong>
                        <p className="editorMetaChecklistDescription">{item.description}</p>
                      </div>
                    </div>
                    <span className="editorMetaChecklistAction">{runningChecklistActionLabel === item.label ? "実行中..." : "AIに依頼"}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

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
                      <div key={tag.label} className="editorMetaSuggestionItem">
                        <div className="editorMetaSuggestionBody">
                          <div className="editorMetaSuggestionSummary">
                            <span className="editorMetaSuggestionBadge">
                              <Sparkles className="editorMetaChipIcon" aria-hidden="true" />
                              AI提案
                            </span>
                            <strong className="editorMetaSuggestionValue">
                              <Tag className="editorMetaChipIcon" aria-hidden="true" />
                              {tag.label}
                            </strong>
                          </div>
                          <p className="editorMetaSuggestionDescription">{tag.reason}</p>
                        </div>
                        <div className="editorMetaSuggestionActions">
                          <button type="button" className="metaAppendButton" onClick={() => applySuggestedTag(tag.label)}>
                            <Plus className="editorMetaActionIcon" aria-hidden="true" />
                            追加する
                          </button>
                          <button type="button" className="metaRejectButton" onClick={() => discardSuggestedTag(tag.label)}>
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
        </div>

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
          {canvasMode === "edit" ? (
            <EditorContent editor={editor} />
          ) : (
            <section className="editorPreviewPane" aria-label="記事プレビュー">
              <div className="editorPreviewContent" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
