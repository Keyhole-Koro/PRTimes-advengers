from typing import Any

from registry import build_task_registry
from services.adk_runner import AdkRunner, AdkRunnerError
from services.validator import SchemaStore


class TaskNotFoundError(KeyError):
    pass


class TaskExecutionError(RuntimeError):
    def __init__(self, message: str, *, code: str, status_code: int):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class TaskService:
    def __init__(self, schema_dir: str, adk_runner: AdkRunner | None = None):
        self.schema_store = SchemaStore(schema_dir)
        self.tasks = build_task_registry()
        self.adk_runner = adk_runner or AdkRunner()

    def list_tasks(self) -> list[str]:
        return sorted(self.tasks.keys())

    def describe_tasks(self) -> list[dict[str, str]]:
        descriptions = []
        for task in self.tasks.values():
            descriptions.append(
                {
                    "name": task.name,
                    "description": task.description,
                    "input_schema": task.input_schema,
                    "output_schema": task.output_schema,
                }
            )
        return descriptions

    def run_task(self, task_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        task = self.tasks.get(task_name)
        if task is None:
            raise TaskNotFoundError(f"Task '{task_name}' is not registered.")

        self.schema_store.validate(task.input_schema, payload)
        output_schema = self.schema_store.load(task.output_schema)
        prompt = task.prompt_builder(payload)

        try:
            result = self.adk_runner.run_structured_task(
                task_name=task.name,
                prompt=prompt,
                output_schema=output_schema,
            )
        except AdkRunnerError as exc:
            raise TaskExecutionError(
                str(exc),
                code="AGENT_EXECUTION_ERROR",
                status_code=503,
            ) from exc

        self.schema_store.validate(task.output_schema, result)

        if task.post_processor is not None:
            result = task.post_processor(payload, result)
            self.schema_store.validate(task.output_schema, result)

        return {
            "task": {
                "name": task.name,
                "description": task.description,
            },
            "result": result,
            "meta": {
                "input_schema": task.input_schema,
                "output_schema": task.output_schema,
            },
        }
