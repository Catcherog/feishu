#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _changes(before: dict[str, Any], after: dict[str, Any], excluded: set[str]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key in sorted((set(before) | set(after)) - excluded):
        if before.get(key) != after.get(key):
            result[key] = {"from": before.get(key), "to": after.get(key)}
    return result


def _named_map(items: list[dict[str, Any]], key: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for item in items:
        name = item.get(key)
        if not isinstance(name, str) or not name:
            raise ValueError(f"Missing stable key {key}: {item!r}")
        if name in result:
            raise ValueError(f"Duplicate stable key {key}={name}")
        result[name] = item
    return result


def _mapping_changes(before: dict[str, Any], after: dict[str, Any]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for key in sorted(set(before) | set(after)):
        if before.get(key) != after.get(key):
            result.append({"key": key, "from": before.get(key), "to": after.get(key)})
    return result


def build_diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    added_fields: list[dict[str, Any]] = []
    removed_fields: list[dict[str, Any]] = []
    changed_fields: list[dict[str, Any]] = []
    enum_changes: list[dict[str, Any]] = []
    required_changes: list[dict[str, Any]] = []
    view_changes: list[dict[str, Any]] = []

    before_tables = before.get("tables", {})
    after_tables = after.get("tables", {})
    for table_key in sorted(set(before_tables) | set(after_tables)):
        before_table = before_tables.get(table_key, {})
        after_table = after_tables.get(table_key, {})
        before_fields = _named_map(before_table.get("fields", []), "field_key")
        after_fields = _named_map(after_table.get("fields", []), "field_key")

        for field_key in sorted(set(after_fields) - set(before_fields)):
            added_fields.append({"table": table_key, "field_key": field_key, "definition": after_fields[field_key]})
        for field_key in sorted(set(before_fields) - set(after_fields)):
            removed_fields.append({"table": table_key, "field_key": field_key, "definition": before_fields[field_key]})
        for field_key in sorted(set(before_fields) & set(after_fields)):
            old_field = before_fields[field_key]
            new_field = after_fields[field_key]
            field_delta = _changes(old_field, new_field, {"field_key", "required", "options"})
            if field_delta:
                changed_fields.append({"table": table_key, "field_key": field_key, "changes": field_delta})
            if old_field.get("options") != new_field.get("options"):
                enum_changes.append({"table": table_key, "field_key": field_key, "from": old_field.get("options"), "to": new_field.get("options")})
            if old_field.get("required") != new_field.get("required"):
                required_changes.append({"table": table_key, "field_key": field_key, "from": old_field.get("required"), "to": new_field.get("required")})

        before_views = _named_map(before_table.get("views", []), "view_name")
        after_views = _named_map(after_table.get("views", []), "view_name")
        for view_name in sorted(set(after_views) - set(before_views)):
            view_changes.append({"table": table_key, "view_name": view_name, "action": "added", "definition": after_views[view_name]})
        for view_name in sorted(set(before_views) - set(after_views)):
            view_changes.append({"table": table_key, "view_name": view_name, "action": "removed", "definition": before_views[view_name]})
        for view_name in sorted(set(before_views) & set(after_views)):
            delta = _changes(before_views[view_name], after_views[view_name], {"view_name"})
            if delta:
                view_changes.append({"table": table_key, "view_name": view_name, "action": "changed", "changes": delta})

    state_machine_changes = _mapping_changes(before.get("state_machines", {}), after.get("state_machines", {}))
    global_enum_changes = _mapping_changes(before.get("enums", {}), after.get("enums", {}))

    result: dict[str, Any] = {
        "source_schema_version": before.get("schema_version"),
        "target_schema_version": after.get("schema_version"),
        "generator": "scripts/generate_schema_diff.py",
        "added_fields": added_fields,
        "removed_fields": removed_fields,
        "changed_fields": changed_fields,
        "enum_changes": enum_changes,
        "required_changes": required_changes,
        "view_changes": view_changes,
        "state_machine_changes": state_machine_changes,
        "global_enum_changes": global_enum_changes,
    }
    result["summary"] = {
        key: len(result[key])
        for key in (
            "added_fields", "removed_fields", "changed_fields", "enum_changes",
            "required_changes", "view_changes", "state_machine_changes", "global_enum_changes"
        )
    }
    return result


def render_diff(result: dict[str, Any]) -> str:
    return json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a deterministic V2 schema diff")
    parser.add_argument("--before", type=Path, default=Path("schemas/v2-schema-v1.0.json"))
    parser.add_argument("--after", type=Path, default=Path("schemas/v2-schema-v1.1.json"))
    parser.add_argument("--output", type=Path, default=Path("schemas/schema-diff-v1.0-to-v1.1.json"))
    args = parser.parse_args()
    result = build_diff(load_json(args.before), load_json(args.after))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_diff(result), encoding="utf-8", newline="\n")
    print(json.dumps(result["summary"], ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
