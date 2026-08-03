"""Build the static catalogue and optimized images for the notes gallery."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

try:
    from PIL import Image, ImageOps
except ImportError as exc:
    raise SystemExit(
        "Pillow is required. Install it with: py -m pip install Pillow"
    ) from exc


ROOT = Path(__file__).resolve().parent
GENERATED = ROOT / "_generated"
SUPPORTED = {".png", ".jpg", ".jpeg", ".webp", ".avif"}
THUMB_SIZE = (640, 640)
THUMB_LAYOUT = "top-v1"
DISPLAY_LIMIT = (1400, 1800)


def natural_key(value: str) -> list[object]:
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", value)]


def url_for(path: Path) -> str:
    return quote(path.relative_to(ROOT).as_posix(), safe="/._-")


def stable_id(path: Path) -> str:
    relative = path.relative_to(ROOT).as_posix().casefold()
    return hashlib.sha1(relative.encode("utf-8")).hexdigest()[:12]


def readable_title(path: Path) -> str:
    return re.sub(r"[_-]+", " ", path.stem).strip()


def needs_refresh(source: Path, destination: Path) -> bool:
    return not destination.exists() or destination.stat().st_mtime_ns < source.stat().st_mtime_ns


def save_webp(image: Image.Image, destination: Path, quality: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=quality, method=5)


def process_photo(
    source: Path, album_folder: str, force_thumbnail: bool = False
) -> dict[str, object]:
    photo_id = stable_id(source)
    output_name = f"{source.stem}-{photo_id}.webp"
    thumb_path = GENERATED / "thumbs" / album_folder / output_name
    display_path = GENERATED / "display" / album_folder / output_name

    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        width, height = image.size

        if force_thumbnail or needs_refresh(source, thumb_path):
            thumbnail = ImageOps.fit(
                image,
                THUMB_SIZE,
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.0),
            )
            save_webp(thumbnail, thumb_path, quality=84)

        if needs_refresh(source, display_path):
            display = image.copy()
            display.thumbnail(DISPLAY_LIMIT, Image.Resampling.LANCZOS)
            save_webp(display, display_path, quality=90)

    return {
        "id": photo_id,
        "title": readable_title(source),
        "original": url_for(source),
        "thumb": url_for(thumb_path),
        "display": url_for(display_path),
        "width": width,
        "height": height,
    }


def build_catalogue() -> dict[str, object]:
    thumb_layout_path = GENERATED / ".thumb-layout"
    current_layout = (
        thumb_layout_path.read_text(encoding="utf-8").strip()
        if thumb_layout_path.exists()
        else ""
    )
    refresh_thumbnails = current_layout != THUMB_LAYOUT

    album_directories = sorted(
        (
            path
            for path in ROOT.iterdir()
            if path.is_dir() and not path.name.startswith("_")
        ),
        key=lambda path: natural_key(path.name),
    )

    albums: list[dict[str, object]] = []
    for album_path in album_directories:
        sources = sorted(
            (
                path
                for path in album_path.iterdir()
                if path.is_file() and path.suffix.casefold() in SUPPORTED
            ),
            key=lambda path: natural_key(path.name),
        )
        photos = [
            process_photo(source, album_path.name, refresh_thumbnails)
            for source in sources
        ]
        if not photos:
            continue
        albums.append(
            {
                "id": album_path.name,
                "title": f"Album {album_path.name}",
                "count": len(photos),
                "cover": photos[0],
                "photos": photos,
            }
        )

    thumb_layout_path.parent.mkdir(parents=True, exist_ok=True)
    thumb_layout_path.write_text(THUMB_LAYOUT, encoding="utf-8")

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "albumCount": len(albums),
        "photoCount": sum(album["count"] for album in albums),
        "albums": albums,
    }


def main() -> None:
    catalogue = build_catalogue()
    data_path = ROOT / "gallery-data.js"
    payload = json.dumps(catalogue, ensure_ascii=False, separators=(",", ":"))
    data_path.write_text(f"window.GALLERY_DATA={payload};\n", encoding="utf-8")
    print(
        f"Gallery updated: {catalogue['albumCount']} albums, "
        f"{catalogue['photoCount']} photos."
    )


if __name__ == "__main__":
    main()
