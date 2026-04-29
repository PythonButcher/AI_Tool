"""Validate an Agent Council JSON artifact against the local schema.

This validator is intentionally lightweight and dependency-free. It implements
the subset of JSON Schema used by `council_output_schema.json`, which keeps the
planning workflow easy to run from a fresh checkout without installing tooling.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


SCHEMA_PATH = Path(__file__).with_name("council_output_schema.json")


class ValidationError(Exception):
    """Raised when the council artifact does not match the expected structure."""


def load_json(path: Path) -> Any:
    """Load a JSON file and include the file path in parse errors."""

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValidationError(f"{path}: invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}") from exc


def resolve_ref(schema: dict[str, Any], ref: str) -> dict[str, Any]:
    """Resolve the local `$defs` references used by the council schema."""

    prefix = "#/$defs/"
    if not ref.startswith(prefix):
        raise ValidationError(f"Unsupported schema reference: {ref}")
    name = ref[len(prefix) :]
    try:
        target = schema["$defs"][name]
    except KeyError as exc:
        raise ValidationError(f"Schema reference not found: {ref}") from exc
    if not isinstance(target, dict):
        raise ValidationError(f"Schema reference does not point to an object: {ref}")
    return target


def json_type(value: Any) -> str:
    """Return the JSON Schema type name for a Python value."""

    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int) and not isinstance(value, bool):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def type_matches(value: Any, expected: str | list[str]) -> bool:
    """Handle the basic scalar and compound types used in the schema."""

    expected_types = expected if isinstance(expected, list) else [expected]
    actual = json_type(value)
    if actual in expected_types:
        return True
    return actual == "integer" and "number" in expected_types


def validate_node(value: Any, node: dict[str, Any], root_schema: dict[str, Any], path: str) -> None:
    """Recursively validate one value against one schema node."""

    if "$ref" in node:
        validate_node(value, resolve_ref(root_schema, node["$ref"]), root_schema, path)
        return

    expected_type = node.get("type")
    if expected_type is not None and not type_matches(value, expected_type):
        raise ValidationError(f"{path}: expected {expected_type}, got {json_type(value)}")

    if "enum" in node and value not in node["enum"]:
        allowed = ", ".join(repr(item) for item in node["enum"])
        raise ValidationError(f"{path}: expected one of {allowed}, got {value!r}")

    if isinstance(value, str) and node.get("minLength") and len(value) < node["minLength"]:
        raise ValidationError(f"{path}: string is shorter than minLength {node['minLength']}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        minimum = node.get("minimum")
        maximum = node.get("maximum")
        if minimum is not None and value < minimum:
            raise ValidationError(f"{path}: number is below minimum {minimum}")
        if maximum is not None and value > maximum:
            raise ValidationError(f"{path}: number is above maximum {maximum}")

    if isinstance(value, list):
        min_items = node.get("minItems")
        if min_items is not None and len(value) < min_items:
            raise ValidationError(f"{path}: array has fewer than {min_items} items")
        item_schema = node.get("items")
        if item_schema:
            for index, item in enumerate(value):
                validate_node(item, item_schema, root_schema, f"{path}[{index}]")

    if isinstance(value, dict):
        required = node.get("required", [])
        missing = [key for key in required if key not in value]
        if missing:
            raise ValidationError(f"{path}: missing required field(s): {', '.join(missing)}")

        properties = node.get("properties", {})
        if node.get("additionalProperties") is False:
            extra = sorted(set(value) - set(properties))
            if extra:
                raise ValidationError(f"{path}: unexpected field(s): {', '.join(extra)}")

        for key, child_schema in properties.items():
            if key in value:
                validate_node(value[key], child_schema, root_schema, f"{path}.{key}")


def validate_council_file(artifact_path: Path) -> None:
    """Load schema and artifact, then validate the artifact structure."""

    schema = load_json(SCHEMA_PATH)
    artifact = load_json(artifact_path)
    validate_node(artifact, schema, schema, "$")


def main(argv: list[str]) -> int:
    """Command-line entry point used by agents and humans."""

    if len(argv) != 2:
        print("Usage: python project_docs/active/agent_council/validate_council_json.py <council-output.json>")
        return 2

    artifact_path = Path(argv[1])
    try:
        validate_council_file(artifact_path)
    except ValidationError as exc:
        print(f"Council JSON validation failed: {exc}")
        return 1

    print(f"Council JSON validation passed: {artifact_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
