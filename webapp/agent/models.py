from dataclasses import dataclass
from typing import Any, Callable


PostProcessor = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]
PromptBuilder = Callable[[dict[str, Any]], str]


@dataclass(frozen=True)
class TaskDefinition:
    name: str
    description: str
    input_schema: str
    output_schema: str
    prompt_builder: PromptBuilder
    post_processor: PostProcessor | None = None
