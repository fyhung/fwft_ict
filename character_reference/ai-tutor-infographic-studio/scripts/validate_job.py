from __future__ import annotations

import sys
from pathlib import Path

import yaml


REQUIRED = (
    "job.id",
    "job.series.zh",
    "job.series.en",
    "job.topic.zh",
    "job.topic.en",
    "job.objective",
    "job.coverage",
    "character.concept",
    "character.face_reference",
    "visual.aspect_ratio",
    "visual.style",
    "visual.palette",
    "visual.density",
    "visual.layout",
    "content.language",
    "output.directory",
    "output.filename",
)


def get_path(data: dict, dotted: str):
    value = data
    for part in dotted.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: validate_job.py <job.yaml>")
        return 2
    path = Path(sys.argv[1]).resolve()
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception as exc:
        print(f"ERROR: invalid YAML: {exc}")
        return 1
    missing = [field for field in REQUIRED if get_path(data, field) in (None, "", [])]
    errors = [f"Missing required field: {field}" for field in missing]
    skill_root = Path(__file__).resolve().parents[1]
    for field in ("character.face_reference", "character.full_body_reference", "character.outfit_reference", "character.outfit_design"):
        value = get_path(data, field)
        if value and not (skill_root / value).resolve().exists():
            errors.append(f"Reference not found: {field} -> {value}")
    if get_path(data, "visual.aspect_ratio") != "2:3":
        print("WARNING: this series is designed for a 2:3 aspect ratio")
    if errors:
        print("\n".join(f"ERROR: {item}" for item in errors))
        return 1
    print(f"OK: {path.name} is valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
