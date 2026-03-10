import asyncio
import json
import os
from typing import Any


class AdkRunnerError(RuntimeError):
    pass


class AdkRunner:
    def __init__(self, model: str | None = None):
        self.model = model or os.getenv("AGENT_MODEL", "gemini-3-flash-preview")
        self.app_name = os.getenv("AGENT_APP_NAME", "press-release-agent")

    def run_structured_task(self, *, task_name: str, prompt: str, output_schema: dict[str, Any]) -> dict[str, Any]:
        return asyncio.run(
            self._run_structured_task(
                task_name=task_name,
                prompt=prompt,
                output_schema=output_schema,
            )
        )

    async def _run_structured_task(
        self,
        *,
        task_name: str,
        prompt: str,
        output_schema: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            from google.adk.agents.llm_agent import Agent
            from google.adk.runners import InMemoryRunner
            from google.genai import types
        except ImportError as exc:
            raise AdkRunnerError(
                "google-adk is not installed. Add it to requirements and rebuild the container."
            ) from exc

        if not os.getenv("GOOGLE_API_KEY"):
            raise AdkRunnerError("GOOGLE_API_KEY is not set.")

        instruction = (
            "You are a schema-driven backend agent. "
            "Return exactly one JSON object that satisfies the provided response schema. "
            "Do not wrap the JSON in markdown. "
            "Do not include explanations outside the JSON."
        )

        agent = Agent(
            model=self.model,
            name=f"{task_name}_agent",
            description=f"Structured task runner for {task_name}.",
            instruction=instruction,
        )

        runner = InMemoryRunner(agent=agent, app_name=self.app_name)
        session = await runner.session_service.create_session(
            app_name=self.app_name,
            user_id="flask-api",
        )

        new_message = types.Content(
            role="user",
            parts=[
                types.Part(
                    text=(
                        "Response JSON schema:\n"
                        f"{json.dumps(output_schema, ensure_ascii=False)}\n\n"
                        "Task prompt:\n"
                        f"{prompt}"
                    )
                )
            ],
        )

        final_text = ""
        try:
            async for event in runner.run_async(
                user_id="flask-api",
                session_id=session.id,
                new_message=new_message,
            ):
                if not getattr(event, "content", None):
                    continue
                for part in getattr(event.content, "parts", []) or []:
                    text = getattr(part, "text", None)
                    if text:
                        final_text = text
        except Exception as exc:
            raise AdkRunnerError(f"ADK request failed: {exc}") from exc

        if not final_text:
            raise AdkRunnerError("ADK returned an empty response.")

        try:
            return json.loads(final_text)
        except json.JSONDecodeError as exc:
            raise AdkRunnerError("ADK response was not valid JSON.") from exc
