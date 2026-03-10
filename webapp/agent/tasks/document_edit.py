import json
from copy import deepcopy

from editorial_policy import render_editorial_policy
from models import TaskDefinition


def build_document_edit_task() -> TaskDefinition:
    return TaskDefinition(
        name="document_edit",
        description="TipTapドキュメントに対して add/remove/modify の block 単位編集提案を返します。",
        input_schema="document_edit_request.schema.json",
        output_schema="document_edit_response.schema.json",
        prompt_builder=build_prompt,
        post_processor=normalize_document_edit_result,
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
        settings_lines.append(f"- ブランドらしさ・文体方針: {instructions['brand_voice']}")
    if instructions.get("focus_points"):
        settings_lines.append("- 特に重視する論点: " + " / ".join(instructions["focus_points"]))
    if instructions.get("priority_checks"):
        settings_lines.append("- 優先的に確認する項目: " + " / ".join(instructions["priority_checks"]))

    settings_block = ""
    if settings_lines:
        settings_block = "依頼者がフロントで指定した編集方針:\n" + "\n".join(settings_lines) + "\n\n"

    return (
        "あなたは TipTap 形式のドキュメントを編集するエージェントです。\n"
        "同時に、プレスリリースの品質を高める編集アシスタントとして振る舞ってください。\n"
        "返す内容は、細かく分割された suggestion 単位の提案です。\n"
        "許可される操作は add、remove、modify のみです。\n"
        "同じ意味の block を保てる場合は、remove+add より modify を優先してください。\n"
        "未対応の node type は作らないでください。\n"
        "各 operation は元ドキュメントの block id を対象にするか、新しい一意な block id を持つ block を作成してください。\n\n"
        "強いプレスリリースにするための共通編集基準:\n"
        f"{render_editorial_policy()}\n\n"
        "編集提案では、関連する限りこの基準に沿って文書を改善してください。\n"
        "提案はできるだけ小さく独立して適用できる単位に分けてください。\n"
        "各 suggestion は 1 つの明確な改善意図だけを持つようにしてください。\n"
        "例えば、タイトル改善、導入改善、見出し整理、可読性改善、キーワード改善、タグ改善、リスク低減などに分けてください。\n"
        "assistant_message には、チャット欄に表示する短い案内文を日本語で簡潔に入れてください。\n"
        "navigation_label には、文書上の提案位置へ移動するための短いボタン文言を日本語で簡潔に入れてください。\n"
        "assistant_message と navigation_label は、summary の単純な繰り返しではなく、ユーザーが次に何をすればよいかが一目で分かる文にしてください。\n"
        "各 suggestion には category、summary、operations を必ず含めてください。\n"
        "可能であれば suggestion の reason や operation の reason で、どの編集基準に基づく修正かを説明してください。\n\n"
        f"{settings_block}"
        f"入力JSON:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def normalize_document_edit_result(payload: dict, result: dict) -> dict:
    normalized = deepcopy(result)
    source_blocks = {block["id"]: block for block in payload["document"]["blocks"]}

    for suggestion in normalized.get("suggestions", []):
        for operation in suggestion.get("operations", []):
            if operation["op"] == "modify":
                original = source_blocks.get(operation["block_id"])
                if original is not None and "before" not in operation:
                    operation["before"] = original
            if operation["op"] == "remove":
                original = source_blocks.get(operation["block_id"])
                if original is not None and "removed_block" not in operation:
                    operation["removed_block"] = original

    return normalized
