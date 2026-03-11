import { RotateCcw, Sparkles } from "lucide-react";

import type { AiAgentSettings } from "../hooks/useAiAssistant";
import "./AiSidebar.css";

const AI_STYLE_OPTIONS = ["", "プレスリリース標準", "ニュースライク", "やわらかめ", "採用向け", "商品訴求寄り"];
const AI_TONE_OPTIONS = ["", "簡潔", "丁寧", "力強い", "親しみやすい", "落ち着いた"];
const AI_FOCUS_POINT_OPTIONS = ["タイトル", "導入文", "本文構成", "見出し", "CTA"];
const AI_PRIORITY_CHECK_OPTIONS = ["誤字脱字", "表記ゆれ", "読みやすさ", "リスク表現", "数字・日付の整合性"];

export type AiSettingsSidebarProps = {
  aiSettings: AiAgentSettings;
  resetAiSettings: () => void;
  setAiSettingText: (
    field: "targetAudience" | "writingStyle" | "tone" | "brandVoice" | "consistencyPolicy",
    value: string,
  ) => void;
  toggleAiSettingListValue: (field: "focusPoints" | "priorityChecks", value: string) => void;
};

export function AiSettingsSidebar({
  aiSettings,
  resetAiSettings,
  setAiSettingText,
  toggleAiSettingListValue,
}: AiSettingsSidebarProps) {
  return (
    <section className="aiPanel" aria-label="AI設定">
      <div className="aiPanelHeader">
        <h2 className="aiPanelTitle">
          <Sparkles className="aiIcon aiIcon-title" aria-hidden="true" />
          AI設定
        </h2>
        <p className="aiPanelDescription">想定読者や文体を指定して、提案と補助候補の方向性をそろえます。</p>
      </div>

      <div className="aiSettingsStandaloneBody">
        <section className="aiSettingsPanel" aria-label="AI設定フォーム">
          <div className="aiSettingsHeader">
            <div>
              <p className="aiSettingsEyebrow">Guidance</p>
              <p className="aiSettingsDescription">未指定項目は本文から推測されます。必要なところだけ埋めれば十分です。</p>
            </div>
            <button type="button" className="aiSettingsResetButton" onClick={resetAiSettings}>
              <RotateCcw className="aiIcon" aria-hidden="true" />
              リセット
            </button>
          </div>

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
                rows={4}
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
        </section>
      </div>
    </section>
  );
}
