from __future__ import annotations

import sys
from pathlib import Path

import yaml


def load_yaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: build_prompt.py <job.yaml>")
        return 2
    skill_root = Path(__file__).resolve().parents[1]
    project = load_yaml(skill_root / "project.yaml")
    job = load_yaml(Path(sys.argv[1]).resolve())
    j, c, v, content = job["job"], job["character"], job["visual"], job["content"]
    quality = project["quality"]
    coverage = "、".join(j["coverage"])
    refs = [c.get(key) for key in ("face_reference", "full_body_reference", "outfit_reference", "outfit_design") if c.get(key)]
    prompt = f"""製作一張 ICT 教學資訊圖表。

系列：{j['series']['zh']}（{j['series']['en']}）
主題：{j['topic']['zh']}（{j['topic']['en']}）
學習目標：{j['objective']}
必須涵蓋：{coverage}

畫面比例：{v['aspect_ratio']} 直向。
語言：繁體中文解說；重要名詞同時標示中文及英文，格式為「中文（English）」。
角色：AI Tutor，打扮成「{c['concept']}」。嚴格保持參考圖中的臉型、黑色長髮、編髮細節、圓框眼鏡與人物年齡感。
角色參考：{'; '.join(refs)}
視覺風格：{v['style']}；氣氛 {v.get('mood', 'cute')}；配色 {v['palette']}；資訊密度 {v['density']}。
版面：{v['layout']}；角色位置 {v.get('character_position', 'right')}；角色約佔畫面 {v.get('character_area_percent', 30)}%。
內容要求：簡潔易明、準確、有清晰資訊層級。{'使用流程圖或小圖解。' if content.get('use_diagrams') else ''}{'加入簡短例子。' if content.get('use_examples') else ''}
避免：簡體中文、錯字、無意義文字、重複標籤、過小文字、人物外貌漂移、未經來源支持的內容。
品質門檻：character drift={quality['reject_character_drift']}；gibberish={quality['reject_gibberish']}；mobile readability={quality['minimum_text_size']}。
"""
    print(prompt.strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
