import json
import os
from typing import Any

from jsonschema import Draft202012Validator


class SchemaValidationError(ValueError):
    def __init__(self, schema_name: str, errors: list[dict[str, Any]]):
        self.schema_name = schema_name
        self.errors = errors
        message = f"Schema validation failed for {schema_name}."
        if errors:
            message = f"{message} {errors[0]['message']}"
        super().__init__(message)


class SchemaStore:
    def __init__(self, schema_dir: str):
        self.schema_dir = schema_dir
        self._cache: dict[str, dict[str, Any]] = {}

    def load(self, schema_name: str) -> dict[str, Any]:
        if schema_name not in self._cache:
            schema_path = os.path.join(self.schema_dir, schema_name)
            with open(schema_path, "r", encoding="utf-8") as schema_file:
                self._cache[schema_name] = json.load(schema_file)
        return self._cache[schema_name]

    def validate(self, schema_name: str, payload: dict[str, Any]) -> None:
        schema = self.load(schema_name)
        validator = Draft202012Validator(schema)
        errors = []
        for error in validator.iter_errors(payload):
            path = "$"
            if error.absolute_path:
                path += "." + ".".join(str(part) for part in error.absolute_path)
            errors.append({"path": path, "message": error.message})

        if errors:
            raise SchemaValidationError(schema_name, errors)
