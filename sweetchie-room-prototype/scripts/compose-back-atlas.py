from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / "assets" / "backwalk-frames"
OUTPUT = ROOT / "assets" / "sweetchie-back-walk.png"
CELL_WIDTH = 192
CELL_HEIGHT = 208


def main() -> None:
    atlas = Image.new("RGBA", (CELL_WIDTH * 8, CELL_HEIGHT * 2), (0, 0, 0, 0))
    for row, state in enumerate(("running-right", "running-left")):
        for column in range(8):
            frame_path = FRAMES / state / f"{column:02d}.png"
            frame = Image.open(frame_path).convert("RGBA")
            if frame.size != (CELL_WIDTH, CELL_HEIGHT):
                raise ValueError(f"Unexpected frame size for {frame_path}: {frame.size}")
            atlas.alpha_composite(frame, (column * CELL_WIDTH, row * CELL_HEIGHT))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUTPUT, optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
