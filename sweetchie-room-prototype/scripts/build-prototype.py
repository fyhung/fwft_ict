import base64
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "src" / "sweetchie-room.template.html"
OUTPUT = ROOT / "sweetchie-room.html"
TEST_OUTPUT = ROOT / "sweetchie-room-test.html"
QUESTION_BANK = ROOT / "ICT_E" / "ict-topic-e-all.js"
QUESTION_BANK_MARKER = "__ICT_TOPIC_E_BANK_SCRIPT__"
TEST_PANEL_START = "<!-- __TEST_PANEL_START__ -->"
TEST_PANEL_END = "<!-- __TEST_PANEL_END__ -->"
ROOM_VARIANT_MARKER = "__ROOM_VARIANT__"

ASSETS = {
    "__SWEETCHIE_ATLAS__": ROOT / "assets" / "sweetchie-atlas.png",
    "__SWEETCHIE_EXTRA_ACTIONS__": ROOT / "assets" / "sweetchie-extra-actions.png",
    "__SWEETCHIE_BACK_WALK__": ROOT / "assets" / "sweetchie-back-walk.png",
}


def data_url(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def embed_payloads() -> str:
    html = TEMPLATE.read_text(encoding="utf-8")
    for marker, path in ASSETS.items():
        if not path.exists():
            raise FileNotFoundError(path)
        html = html.replace(marker, data_url(path))

    if not QUESTION_BANK.exists():
        raise FileNotFoundError(QUESTION_BANK)
    bank_script = QUESTION_BANK.read_text(encoding="utf-8").replace("</script", "<\\/script")
    html = html.replace(QUESTION_BANK_MARKER, bank_script)

    leftovers = [marker for marker in [*ASSETS, QUESTION_BANK_MARKER] if marker in html]
    if leftovers:
        raise RuntimeError(f"Unreplaced asset markers: {leftovers}")

    return html


def remove_test_panel(html: str) -> str:
    start = html.find(TEST_PANEL_START)
    end = html.find(TEST_PANEL_END)
    if start < 0 or end < 0 or end < start:
        raise RuntimeError("Unable to find the animation-test panel markers")
    return html[:start] + html[end + len(TEST_PANEL_END):]


def main() -> None:
    embedded_html = embed_payloads()
    test_html = embedded_html.replace(TEST_PANEL_START, "").replace(TEST_PANEL_END, "").replace(ROOM_VARIANT_MARKER, "test")
    production_html = remove_test_panel(embedded_html).replace(ROOM_VARIANT_MARKER, "production")

    OUTPUT.write_text(production_html, encoding="utf-8", newline="\n")
    TEST_OUTPUT.write_text(test_html, encoding="utf-8", newline="\n")
    print(f"Built {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
    print(f"Built {TEST_OUTPUT} ({TEST_OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
