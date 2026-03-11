import json

from editorial_policy import render_editorial_policy
from models import TaskDefinition


def build_tag_suggest_task() -> TaskDefinition:
    return TaskDefinition(
        name="tag_suggest",
        description="タイトルと本文からプレスリリース向けのタグ候補を返します。",
        input_schema="tag_suggest_request.schema.json",
        output_schema="tag_suggest_response.schema.json",
        prompt_builder=build_prompt,
        post_processor=normalize_tag_result,
    )


def build_prompt(payload: dict) -> str:
    instructions = payload.get("instructions", {})
    settings_lines = []

    if instructions.get("audience"):
        settings_lines.append(f"- 想定読者: {instructions['audience']}")
    if instructions.get("style"):
        settings_lines.append(f"- 文章スタイル: {instructions['style']}")
    if instructions.get("tone"):
        settings_lines.append(f"- トーン: {instructions['tone']}")
    if instructions.get("brand_voice"):
        settings_lines.append(f"- ブランド方針: {instructions['brand_voice']}")
    if instructions.get("consistency_policy"):
        settings_lines.append(f"- 固定方針: {instructions['consistency_policy']}")

    settings_block = ""
    if settings_lines:
        settings_block = "フロント設定:\n" + "\n".join(settings_lines) + "\n\n"

    return (
        "あなたはプレスリリース編集支援のタグ提案エージェントです。\n"
        "タイトルと本文を読んで、その文書に本当に関連するタグ候補だけを返してください。\n"
        "タグは 3〜5 件までに絞り、冗長な一般語や意味の弱いタグは避けてください。\n"
        "各タグは必ず # から始め、短く自然な日本語または必要最小限の英字にしてください。\n"
        "本文に明確な根拠がないタグは提案しないでください。\n"
        "同義語を大量に並べず、役割の違うタグを優先してください。\n"
        "reason には、そのタグを勧める根拠を 1 文で簡潔に書いてください。\n\n"
        "プレスリリース品質の観点:\n"
        f"{render_editorial_policy()}\n\n"
        f"{settings_block}"
        f"入力JSON:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def normalize_tag_result(_payload: dict, result: dict) -> dict:
    normalized_tags = []
    seen = set()

    for tag in result.get("tags", []):
        label = tag.get("label", "").strip()
        if not label:
            continue
        if not label.startswith("#"):
            label = f"#{label}"
        if label in seen:
            continue
        seen.add(label)
        normalized_tags.append(
            {
                "label": label,
                "reason": tag.get("reason", "").strip() or f"{label} が文書内容と関連しています。",
            }
        )

    return {
        "summary": result.get("summary", "タグ候補を抽出しました。"),
        "tags": normalized_tags[:5],
    }
