import json

from editorial_policy import render_editorial_policy
from models import TaskDefinition


def build_ai_setting_suggest_task() -> TaskDefinition:
    return TaskDefinition(
        name="ai_setting_suggest",
        description="タイトルと本文から AI 編集設定の候補を返します。",
        input_schema="ai_setting_suggest_request.schema.json",
        output_schema="ai_setting_suggest_response.schema.json",
        prompt_builder=build_prompt,
        post_processor=normalize_setting_suggest_result,
    )


def build_prompt(payload: dict) -> str:
    return (
        "あなたはプレスリリース編集支援の AI 設定推測エージェントです。\n"
        "タイトルと本文を読み、未入力の AI 設定についてだけ候補を返してください。\n"
        "既に指定済みの項目は suggestions に含めないでください。\n"
        "field は targetAudience / writingStyle / tone / brandVoice / focusPoints / priorityChecks のいずれかにしてください。\n"
        "prompt は UI にそのまま表示できる短い日本語にしてください。\n"
        "options は 2〜3 件までに絞り、label と value は同じでも構いません。\n"
        "focusPoints と priorityChecks は複数選択向けなので、本文から重要だと思う観点を返してください。\n"
        "根拠の薄い候補や、本文から読み取れない候補は出さないでください。\n\n"
        "プレスリリース品質の観点:\n"
        f"{render_editorial_policy()}\n\n"
        f"入力JSON:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def normalize_setting_suggest_result(_payload: dict, result: dict) -> dict:
    valid_fields = {
        "targetAudience",
        "writingStyle",
        "tone",
        "brandVoice",
        "focusPoints",
        "priorityChecks",
    }
    suggestions = []
    seen_fields = set()

    for suggestion in result.get("suggestions", []):
        field = suggestion.get("field", "").strip()
        if field not in valid_fields or field in seen_fields:
            continue

        prompt = suggestion.get("prompt", "").strip() or "候補"
        options = []
        seen_values = set()
        for option in suggestion.get("options", []):
            label = option.get("label", "").strip()
            value = option.get("value", "").strip()
            if not label or not value or value in seen_values:
                continue
            seen_values.add(value)
            options.append({
                "label": label,
                "value": value,
            })

        if not options:
            continue

        seen_fields.add(field)
        suggestions.append({
            "field": field,
            "prompt": prompt,
            "options": options[:3],
        })

    return {
        "summary": result.get("summary", "AI設定候補を抽出しました。"),
        "suggestions": suggestions[:4],
    }
