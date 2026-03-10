import json
from copy import deepcopy

from models import TaskDefinition


def build_document_edit_task() -> TaskDefinition:
    return TaskDefinition(
        name="document_edit",
        description="Propose block-level edits for a TipTap document using add/remove/modify operations.",
        input_schema="document_edit_request.schema.json",
        output_schema="document_edit_response.schema.json",
        prompt_builder=build_prompt,
        post_processor=normalize_document_edit_result,
    )


def build_prompt(payload: dict) -> str:
    return (
        "You are editing a TipTap-style document.\n"
        "Return only block-level delta operations.\n"
        "Allowed operations are add, remove, and modify.\n"
        "Prefer modify over remove+add when a block is still semantically the same block.\n"
        "Do not invent unsupported node types.\n"
        "Each operation must target a block id from the source document or create a new block with a unique id.\n\n"
        f"Input JSON:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def normalize_document_edit_result(payload: dict, result: dict) -> dict:
    normalized = deepcopy(result)
    source_blocks = {block["id"]: block for block in payload["document"]["blocks"]}

    for operation in normalized.get("operations", []):
        if operation["op"] == "modify":
            original = source_blocks.get(operation["block_id"])
            if original is not None and "before" not in operation:
                operation["before"] = original
        if operation["op"] == "remove":
            original = source_blocks.get(operation["block_id"])
            if original is not None and "removed_block" not in operation:
                operation["removed_block"] = original

    return normalized
