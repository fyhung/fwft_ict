from __future__ import annotations

from collections import deque
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "sweetchie-bust-source.png"
ATLAS = ROOT / "assets" / "sweetchie-bust-atlas.png"
CONTACT = ROOT / "qa" / "expression-contact-sheet.png"
REPORT = ROOT / "qa" / "artwork-validation.json"
STATE_NAMES = ["Neutral", "Blink", "Talk small", "Talk wide", "Happy", "Surprised"]
FRAME_COUNT = 6
CELL_WIDTH = 440
CELL_HEIGHT = 560


def is_edge_background(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, _alpha = pixel
    return min(red, green, blue) >= 202 and max(red, green, blue) - min(red, green, blue) <= 24


def remove_connected_checkerboard(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    background = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        index = y * width + x
        if not background[index] and is_edge_background(pixels[x, y]):
            background[index] = 1
            queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                index = ny * width + nx
                if not background[index] and is_edge_background(pixels[nx, ny]):
                    background[index] = 1
                    queue.append((nx, ny))

    output = rgba.copy()
    data = bytearray(output.tobytes())
    for index, is_background in enumerate(background):
        if is_background:
            offset = index * 4
            data[offset : offset + 4] = b"\x00\x00\x00\x00"
    return Image.frombytes("RGBA", output.size, bytes(data))


def remove_small_boundary_fragments(image: Image.Image) -> Image.Image:
    """Remove narrow pieces of a neighbouring sprite caught at a slot boundary."""
    output = image.copy()
    alpha = output.getchannel("A")
    width, height = output.size
    seen = bytearray(width * height)
    pixels = alpha.load()

    for seed_y in range(height):
        for seed_x in (0, width - 1):
            seed_index = seed_y * width + seed_x
            if seen[seed_index] or pixels[seed_x, seed_y] == 0:
                continue
            component = []
            queue = deque([(seed_x, seed_y)])
            seen[seed_index] = 1
            min_x = max_x = seed_x
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                min_x, max_x = min(min_x, x), max(max_x, x)
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < width and 0 <= ny < height:
                        index = ny * width + nx
                        if not seen[index] and pixels[nx, ny] > 0:
                            seen[index] = 1
                            queue.append((nx, ny))
            if max_x - min_x < 24 and len(component) < 5000:
                for x, y in component:
                    output.putpixel((x, y), (0, 0, 0, 0))
    return output


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    keyed = remove_connected_checkerboard(source)
    atlas = Image.new("RGBA", (CELL_WIDTH * FRAME_COUNT, CELL_HEIGHT), (0, 0, 0, 0))
    frames: list[Image.Image] = []
    metrics = []

    slots = []
    for index in range(FRAME_COUNT):
        left = round(index * source.width / FRAME_COUNT)
        right = round((index + 1) * source.width / FRAME_COUNT)
        slot = remove_small_boundary_fragments(keyed.crop((left, 0, right, source.height)))
        bbox = slot.getbbox()
        if bbox is None:
            raise SystemExit(f"Expression slot {index} is empty")
        slots.append((slot.crop(bbox), bbox))

    max_width = max(sprite.width for sprite, _bbox in slots)
    max_height = max(sprite.height for sprite, _bbox in slots)
    scale = min((CELL_WIDTH - 30) / max_width, (CELL_HEIGHT - 18) / max_height)

    for index, ((sprite, source_bbox), name) in enumerate(zip(slots, STATE_NAMES)):
        size = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
        sprite = sprite.resize(size, Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
        x = (CELL_WIDTH - sprite.width) // 2
        y = CELL_HEIGHT - sprite.height - 8
        frame.alpha_composite(sprite, (x, y))
        atlas.alpha_composite(frame, (index * CELL_WIDTH, 0))
        frames.append(frame)
        bbox = frame.getbbox()
        metrics.append({
            "index": index,
            "state": name,
            "source_bbox": list(source_bbox),
            "normalized_bbox": list(bbox) if bbox else None,
            "edge_touch": bool(bbox and (bbox[0] <= 1 or bbox[1] <= 1 or bbox[2] >= CELL_WIDTH - 1)),
        })

    ATLAS.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(ATLAS, optimize=True)

    preview_width = 220
    preview_height = 280
    contact = Image.new("RGB", (preview_width * 3, (preview_height + 28) * 2), (241, 231, 247))
    draw = ImageDraw.Draw(contact)
    font = ImageFont.load_default()
    for index, (frame, name) in enumerate(zip(frames, STATE_NAMES)):
        x = (index % 3) * preview_width
        y = (index // 3) * (preview_height + 28)
        tile = Image.new("RGBA", (preview_width, preview_height), (246, 237, 250, 255))
        tile.alpha_composite(frame.resize((preview_width, preview_height), Image.Resampling.LANCZOS))
        contact.paste(tile.convert("RGB"), (x, y))
        draw.text((x + 8, y + preview_height + 8), name, fill=(70, 45, 82), font=font)
    CONTACT.parent.mkdir(parents=True, exist_ok=True)
    contact.save(CONTACT)

    report = {
        "ok": all(not item["edge_touch"] for item in metrics),
        "source_size": list(source.size),
        "atlas_size": list(atlas.size),
        "cell_size": [CELL_WIDTH, CELL_HEIGHT],
        "frame_count": FRAME_COUNT,
        "real_alpha": atlas.getchannel("A").getextrema() == (0, 255),
        "states": metrics,
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
