import type { PressReleaseTemplateResponse } from "./types";

export const MOCK_TEMPLATES: PressReleaseTemplateResponse[] = [
  {
    id: 1,
    name: "採用告知",
    title: "2026年度 新卒採用の募集開始に関するお知らせ",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "概要" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "株式会社○○は、" },
            { type: "text", marks: [{ type: "bold" }], text: "2026年度新卒採用" },
            { type: "text", text: "の募集を開始しました。" },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "募集職種" }],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "ソフトウェアエンジニア" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "プロダクトデザイナー" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "ビジネス職（営業・企画）" }] }] },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "選考フロー" }],
        },
        {
          type: "orderedList",
          attrs: { start: 1 },
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "エントリー" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "書類選考" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "面接（複数回）" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "内定" }] }] },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", marks: [{ type: "underline" }], text: "詳細は採用サイトをご確認ください。" }],
        },
      ],
    },
    created_at: "2026-03-09 09:00",
    updated_at: "2026-03-09 09:00",
  },
  {
    id: 2,
    name: "サービスリリース",
    title: "新サービス「○○」提供開始のお知らせ",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "サービス概要" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "株式会社○○は、本日より新サービス「○○」の提供を開始しました。" },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "本サービスは、" },
            { type: "text", marks: [{ type: "italic" }], text: "情報整理・共有・進行管理" },
            { type: "text", text: "を一つの画面で行えることを特徴としています。" },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "主な特長" }],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "操作しやすいダッシュボード" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "チーム横断での情報共有" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "分析レポートの自動生成" }] }] },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "提供開始までの流れ" }],
        },
        {
          type: "orderedList",
          attrs: { start: 1 },
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "先行導入企業による検証" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "正式版の機能拡充" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "一般提供開始" }] }] },
          ],
        },
      ],
    },
    created_at: "2026-03-08 15:30",
    updated_at: "2026-03-08 15:30",
  },
  {
    id: 3,
    name: "イベント開催",
    title: "イベント「○○ 2026」開催決定のお知らせ",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "イベント開催概要" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "株式会社○○は、2026年5月にイベント「○○ 2026」を開催します。" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "開催目的" }],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "業界関係者との接点創出" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "新しい取り組みの発信" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "来場者との双方向コミュニケーション" }] }] },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "当日のプログラム" }],
        },
        {
          type: "orderedList",
          attrs: { start: 1 },
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "オープニングセッション" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "基調講演" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "パネルディスカッション" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "ネットワーキング" }] }] },
          ],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "開催概要、参加方法、登壇情報は特設ページで順次公開予定です。" }],
        },
      ],
    },
    created_at: "2026-03-07 12:00",
    updated_at: "2026-03-07 12:00",
  },
];

