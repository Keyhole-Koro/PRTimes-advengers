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
        "各 suggestion には category、summary、operations を必ず含めてください。\n"
        "可能であれば suggestion の reason や operation の reason で、どの編集基準に基づく修正かを説明してください。\n\n"
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
