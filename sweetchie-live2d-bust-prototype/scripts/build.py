from __future__ import annotations

import base64
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "src" / "sweetchie-bust.template.html"
ATLAS = ROOT / "assets" / "sweetchie-bust-atlas.png"
OUTPUT = ROOT / "sweetchie-bust.html"


def main() -> None:
    html = TEMPLATE.read_text(encoding="utf-8")
    payload = base64.b64encode(ATLAS.read_bytes()).decode("ascii")
    html = html.replace("__BUST_ATLAS__", f"data:image/png;base64,{payload}")
    if "__BUST_ATLAS__" in html:
        raise SystemExit("Artwork placeholder was not replaced")
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"Built {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
