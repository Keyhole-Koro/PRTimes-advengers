import os
import unittest

from app import create_app
from services.task_service import TaskService


class FakeAdkRunner:
    def __init__(self, responses):
        self.responses = responses

    def run_structured_task(self, *, task_name, prompt, output_schema):
        return self.responses[task_name]


class TaskServiceTestCase(unittest.TestCase):
    def setUp(self):
        self.schema_dir = os.path.join(
            os.path.dirname(__file__),
            "..",
            "schemas",
        )

    def test_document_edit_task_validates_and_normalizes_output(self):
        service = TaskService(
            schema_dir=self.schema_dir,
            adk_runner=FakeAdkRunner(
                {
                    "document_edit": {
                        "summary": "文書を整理しました。",
                        "operations": [
                            {
                                "op": "modify",
                                "block_id": "p-1",
                                "after": {
                                    "id": "p-1",
                                    "type": "paragraph",
                                    "text": "更新後の本文です。"
                                }
                            }
                        ]
                    }
                }
            ),
        )

        payload = {
            "context": {
                "reference_docs": [],
                "uploaded_materials": [],
            },
            "document": {
                "title": "テスト文書",
                "blocks": [
                    {
                        "id": "p-1",
                        "type": "paragraph",
                        "text": "元の本文です。"
                    }
                ]
            },
            "instructions": {
                "goal": "本文を改善する"
            }
        }

        result = service.run_task("document_edit", payload)
        operation = result["result"]["operations"][0]

        self.assertEqual(operation["before"]["text"], "元の本文です。")
        self.assertEqual(operation["after"]["text"], "更新後の本文です。")

    def test_flask_route_returns_available_tasks(self):
        app = create_app()
        client = app.test_client()

        response = client.get("/agent/tasks")

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        task_names = {task["name"] for task in body["tasks"]}
        self.assertIn("document_edit", task_names)
        self.assertIn("checklist_generate", task_names)


if __name__ == "__main__":
    unittest.main()
