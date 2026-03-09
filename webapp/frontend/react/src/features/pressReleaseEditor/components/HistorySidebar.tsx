import type { ChangeEvent } from "react";

import { buildDiffSegments, extractTextContent } from "../utils/diff";
import type {
  DiffSegment,
  PressReleaseRevisionResponse,
  PressReleaseTemplateResponse,
} from "../types";

type RevisionSummary = {
  added: number;
  removed: number;
};

type HistorySidebarProps = {
  revisions: PressReleaseRevisionResponse[];
  selectedRevision: PressReleaseRevisionResponse | null;
  previousRevision: PressReleaseRevisionResponse | null;
  selectedRevisionId: number | null;
  setSelectedRevisionId: (revisionId: number) => void;
  revisionSummaries: Record<number, RevisionSummary>;
  restoringRevisionId: number | null;
  restoreRevision: (revisionId: number) => void | Promise<void>;
  templates: PressReleaseTemplateResponse[];
  templateName: string;
  setTemplateName: (value: string) => void;
  saveCurrentAsTemplate: () => void | Promise<void>;
  isSavingTemplate: boolean;
  applyingTemplateId: number | null;
  applyTemplate: (templateId: number) => void | Promise<void>;
};

function renderDiffTokens(segments: DiffSegment[]) {
  return segments.map((segment, index) => (
    <span key={`${segment.type}-${index}`} className={`diffToken is-${segment.type}`}>
      {segment.type === "added" ? "+ " : "- "}
      {segment.value}
    </span>
  ));
}

export function HistorySidebar({
  revisions,
  selectedRevision,
  previousRevision,
  selectedRevisionId,
  setSelectedRevisionId,
  revisionSummaries,
  restoringRevisionId,
  restoreRevision,
  templates,
  templateName,
  setTemplateName,
  saveCurrentAsTemplate,
  isSavingTemplate,
  applyingTemplateId,
  applyTemplate,
}: HistorySidebarProps) {
  const titleDiff = selectedRevision
    ? buildDiffSegments(previousRevision?.title ?? "", selectedRevision.title)
    : [];
  const bodyDiff = selectedRevision
    ? buildDiffSegments(
        extractTextContent(previousRevision?.content),
        extractTextContent(selectedRevision.content),
      )
    : [];
  const visibleBodyDiff = bodyDiff.slice(0, 8);

  return (
    <>
      <section className="templatePanel">
        <div className="historyPanelHeader">
          <h2 className="historyTitle">テンプレート</h2>
          <span className="historyCount">{templates.length}件</span>
        </div>
        <div className="templateSaveRow">
          <input
            type="text"
            value={templateName}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTemplateName(event.target.value)}
            placeholder="テンプレート名"
            className="templateInput"
          />
          <button
            type="button"
            className="templateButton"
            onClick={() => void saveCurrentAsTemplate()}
            disabled={isSavingTemplate}
          >
            {isSavingTemplate ? "保存中..." : "保存"}
          </button>
        </div>
        <div className="templateList">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="templateItem"
              onClick={() => void applyTemplate(template.id)}
              disabled={applyingTemplateId === template.id}
            >
              <span className="templateName">{template.name}</span>
              <span className="templateMeta">{template.updated_at}</span>
              <span className="templateTitle">{template.title}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="historyPanelHeader">
        <h2 className="historyTitle">変更履歴</h2>
        <span className="historyCount">{revisions.length}件</span>
      </div>

      <div className="historyList">
        {revisions.map((revision) => (
          <button
            key={revision.id}
            type="button"
            className={`historyItem${revision.id === selectedRevisionId ? " is-active" : ""}`}
            onClick={() => setSelectedRevisionId(revision.id)}
          >
            <span className="historyItemVersion">v{revision.version}</span>
            <span className="historyItemDate">{revision.created_at}</span>
            <span className="historyItemMeta">
              +{revisionSummaries[revision.id]?.added ?? 0}
              {" / "}
              -{revisionSummaries[revision.id]?.removed ?? 0}
            </span>
          </button>
        ))}
      </div>

      {selectedRevision && (
        <section className="historyPreview">
          <div className="historyPreviewMeta">
            <span>version {selectedRevision.version}</span>
            <span>{selectedRevision.created_at}</span>
          </div>
          <h3 className="historyPreviewTitle">
            {previousRevision
              ? `v${previousRevision.version} -> v${selectedRevision.version}`
              : "初回保存"}
          </h3>
          <button
            type="button"
            className="restoreButton"
            onClick={() => void restoreRevision(selectedRevision.id)}
            disabled={restoringRevisionId === selectedRevision.id}
          >
            {restoringRevisionId === selectedRevision.id ? "復元中..." : "復元"}
          </button>
          {titleDiff.length > 0 && (
            <div className="diffGroup">
              <span className="diffLabel">タイトル</span>
              <div className="diffTokens">{renderDiffTokens(titleDiff)}</div>
            </div>
          )}
          <div className="diffGroup">
            <span className="diffLabel">本文差分</span>
            <div className="diffTokens">
              {visibleBodyDiff.length > 0 ? renderDiffTokens(visibleBodyDiff) : <span className="diffEmpty">差分なし</span>}
            </div>
          </div>
          {bodyDiff.length > visibleBodyDiff.length && (
            <span className="historyMore">さらに {bodyDiff.length - visibleBodyDiff.length} 件</span>
          )}
        </section>
      )}
    </>
  );
}
