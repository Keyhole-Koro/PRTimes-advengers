import json
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from services.task_service import TaskExecutionError, TaskNotFoundError, TaskService
from services.validator import SchemaValidationError


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)
    app.config["JSON_SORT_KEYS"] = False

    task_service = TaskService(
        schema_dir=os.path.join(os.path.dirname(__file__), "schemas"),
    )

    @app.get("/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "service": "agent",
                "tasks": task_service.list_tasks(),
            }
        )

    @app.get("/agent/tasks")
    def list_tasks():
        return jsonify({"tasks": task_service.describe_tasks()})

    @app.post("/agent/tasks/<task_name>:run")
    def run_task(task_name: str):
        payload = request.get_json(silent=True)
        if payload is None:
            return jsonify({"code": "INVALID_JSON", "message": "Request body must be valid JSON."}), 400

        try:
            result = task_service.run_task(task_name, payload)
        except TaskNotFoundError as exc:
            return jsonify({"code": "TASK_NOT_FOUND", "message": str(exc)}), 404
        except SchemaValidationError as exc:
            return (
                jsonify(
                    {
                        "code": "SCHEMA_VALIDATION_ERROR",
                        "message": str(exc),
                        "details": exc.errors,
                    }
                ),
                400,
            )
        except TaskExecutionError as exc:
            return jsonify({"code": exc.code, "message": str(exc)}), exc.status_code
        except Exception:
            return jsonify({"code": "INTERNAL_ERROR", "message": "Internal server error"}), 500

        return app.response_class(
            response=json.dumps(result, ensure_ascii=False),
            mimetype="application/json",
        )

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
