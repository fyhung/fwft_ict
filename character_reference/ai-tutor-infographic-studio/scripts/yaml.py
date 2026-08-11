"""Small dependency-free YAML reader for this skill's maps and scalar lists."""

from __future__ import annotations

import json
import re


class YAMLError(ValueError):
    pass


def _scalar(value: str):
    value = value.strip()
    if value == "[]":
        return []
    if value == "{}":
        return {}
    if value in ("true", "false"):
        return value == "true"
    if value in ("null", "~"):
        return None
    if value.startswith('"'):
        try:
            return json.loads(value)
        except json.JSONDecodeError as exc:
            raise YAMLError(str(exc)) from exc
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1].replace("''", "'")
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    if re.fullmatch(r"-?\d+\.\d+", value):
        return float(value)
    return value


def safe_load(source):
    if hasattr(source, "read"):
        source = source.read()
    rows = []
    for number, raw in enumerate(str(source).splitlines(), 1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if "\t" in raw[: len(raw) - len(raw.lstrip())]:
            raise YAMLError(f"tabs are not allowed for indentation at line {number}")
        rows.append((len(raw) - len(raw.lstrip(" ")), raw.strip(), number))
    if not rows:
        return None

    def parse(index: int, indent: int):
        is_list = rows[index][1].startswith("- ")
        container = [] if is_list else {}
        while index < len(rows):
            current_indent, text, number = rows[index]
            if current_indent < indent:
                break
            if current_indent > indent:
                raise YAMLError(f"unexpected indentation at line {number}")
            if is_list:
                if not text.startswith("- "):
                    break
                container.append(_scalar(text[2:].strip()))
                index += 1
                continue
            if text.startswith("- ") or ":" not in text:
                raise YAMLError(f"expected key: value at line {number}")
            key, value = text.split(":", 1)
            key = key.strip()
            if not key:
                raise YAMLError(f"empty key at line {number}")
            value = value.strip()
            index += 1
            if value:
                container[key] = _scalar(value)
            elif index < len(rows) and rows[index][0] > indent:
                container[key], index = parse(index, rows[index][0])
            else:
                container[key] = None
        return container, index

    result, end = parse(0, rows[0][0])
    if end != len(rows):
        raise YAMLError(f"could not parse line {rows[end][2]}")
    return result

