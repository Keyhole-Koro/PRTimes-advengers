import os
import unittest

from app import create_app
from tasks.checklist_generate import build_prompt as build_checklist_prompt
from tasks.document_edit import build_prompt as build_document_edit_prompt
from tasks.tag_suggest import build_prompt as build_tag_suggest_prompt
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
                        "assistant_message": "本文の改善案を追加しました。気になる箇所から確認してください。",
                        "navigation_label": "本文提案を確認する",
                        "suggestions": [
                            {
                                "id": "suggestion-1",
                                "presentation": "block",
                                "category": "body",
                                "summary": "本文を分かりやすく修正しました。",
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
                        ]
                    }
                }
            ),
        )

        payload = {
            "context": {
                "reference_docs": [],
                "uploaded_materials": [],
                "edit_history": [],
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
        operation = result["result"]["suggestions"][0]["operations"][0]

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
        self.assertIn("tag_suggest", task_names)

    def test_document_edit_prompt_contains_global_editorial_policy(self):
        prompt = build_document_edit_prompt(
            {
                "context": {
                    "reference_docs": [],
                    "uploaded_materials": [],
                    "edit_history": [],
                },
                "document": {
                    "title": "テスト文書",
                    "blocks": [],
                },
                "instructions": {
                    "goal": "改善する",
                },
            }
        )

        self.assertIn("強いプレスリリースにするための共通編集基準", prompt)
        self.assertIn("タイトル:", prompt)
        self.assertIn("メタデータ:", prompt)
        self.assertIn("リスク:", prompt)
        self.assertIn("assistant_message", prompt)
        self.assertIn("navigation_label", prompt)

    def test_document_edit_prompt_contains_frontend_settings_when_provided(self):
        prompt = build_document_edit_prompt(
            {
                "context": {
                    "reference_docs": [],
                    "uploaded_materials": [],
                    "edit_history": [],
                },
                "document": {
                    "title": "テスト文書",
                    "blocks": [
                        {
                            "id": "p-1",
                            "type": "paragraph",
                            "text": "本文",
                        }
                    ],
                },
                "instructions": {
                    "goal": "改善する",
                    "audience": "記者",
                    "style": "ニュースライク",
                    "tone": "簡潔",
                    "brand_voice": "信頼感重視",
                    "focus_points": ["導入文", "CTA"],
                    "priority_checks": ["誤字脱字", "リスク表現"],
                },
            }
        )

        self.assertIn("依頼者がフロントで指定した編集方針", prompt)
        self.assertIn("想定読者: 記者", prompt)
        self.assertIn("文章スタイル: ニュースライク", prompt)
        self.assertIn("優先的に確認する項目: 誤字脱字 / リスク表現", prompt)

    def test_checklist_prompt_contains_global_editorial_policy(self):
        prompt = build_checklist_prompt(
            {
                "context": {
                    "reference_docs": [],
                    "uploaded_materials": [],
                },
                "document": {
                    "title": "テスト文書",
                    "blocks": [],
                },
                "instructions": {
                    "goal": "チェックリストを作る",
                },
            }
        )

        self.assertIn("強いプレスリリースにするための共通編集基準", prompt)
        self.assertIn("読者価値:", prompt)
        self.assertIn("リスク:", prompt)

    def test_tag_suggest_prompt_contains_tag_rules(self):
        prompt = build_tag_suggest_prompt(
            {
                "document": {
                    "title": "AI新機能を公開",
                    "blocks": [
                        {
                            "id": "p-1",
                            "type": "paragraph",
                            "text": "生成AIを活用した新機能を提供開始しました。",
                        }
                    ],
                },
                "instructions": {
                    "goal": "タグ候補を作る",
                    "audience": "記者",
                },
            }
        )

        self.assertIn("タグ提案エージェント", prompt)
        self.assertIn("# から始め", prompt)
        self.assertIn("想定読者: 記者", prompt)


if __name__ == "__main__":
    unittest.main()
