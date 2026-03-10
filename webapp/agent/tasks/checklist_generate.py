import json

from editorial_policy import render_editorial_policy
from models import TaskDefinition


def build_checklist_generate_task() -> TaskDefinition:
    return TaskDefinition(
        name="checklist_generate",
        description="文書と参考コンテクストから構造化されたチェックリストを生成します。",
        input_schema="checklist_generate_request.schema.json",
        output_schema="checklist_generate_response.schema.json",
        prompt_builder=build_prompt,
    )


def build_prompt(payload: dict) -> str:
    return (
        "与えられたコンテクストからチェックリストを生成してください。\n"
        "チェック項目は具体的で、簡潔で、行動可能である必要があります。\n"
        "可能であれば依頼文と同じ言語を使ってください。\n\n"
        "強いプレスリリースにするための共通編集基準:\n"
        f"{render_editorial_policy()}\n\n"
        "チェックリストは、この基準に照らしてプレスリリースを評価・改善できる内容にしてください。\n\n"
        f"入力JSON:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )
