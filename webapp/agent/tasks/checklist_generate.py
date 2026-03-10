import json

from models import TaskDefinition


def build_checklist_generate_task() -> TaskDefinition:
    return TaskDefinition(
        name="checklist_generate",
        description="Generate a structured checklist from a document and reference context.",
        input_schema="checklist_generate_request.schema.json",
        output_schema="checklist_generate_response.schema.json",
        prompt_builder=build_prompt,
    )


def build_prompt(payload: dict) -> str:
    return (
        "Generate a checklist from the provided context.\n"
        "Checklist items must be concrete, concise, and actionable.\n"
        "Use the request language when possible.\n\n"
        f"Input JSON:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )
