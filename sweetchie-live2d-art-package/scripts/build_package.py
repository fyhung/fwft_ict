from __future__ import annotations

from collections import deque
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source" / "sweetchie-cut-parts-source-bustlab.png"
LAYERS = ROOT / "layers"
PREVIEW = ROOT / "preview"
DOCS = ROOT / "docs"
PSD = ROOT / "Sweetchie-Live2D-Cut-Art.psd"
EXACT_ATLAS = ROOT / "source" / "sweetchie-bustlab-atlas.png"
EXACT_DIR = ROOT / "bustlab-exact"
CANVAS = (1024, 1024)


def is_checker(pixel):
    r, g, b, _ = pixel
    return min(r, g, b) >= 205 and max(r, g, b) - min(r, g, b) <= 22


def remove_checker(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    seen = bytearray(w * h)
    q = deque()

    def seed(x, y):
        i = y * w + x
        if not seen[i] and is_checker(px[x, y]):
            seen[i] = 1
            q.append((x, y))

    for x in range(w):
        seed(x, 0); seed(x, h - 1)
    for y in range(h):
        seed(0, y); seed(w - 1, y)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not seen[i] and is_checker(px[nx, ny]):
                    seen[i] = 1
                    q.append((nx, ny))
    data = bytearray(rgba.tobytes())
    for i, bg in enumerate(seen):
        if bg:
            data[i * 4:i * 4 + 4] = b"\0\0\0\0"
    return Image.frombytes("RGBA", rgba.size, bytes(data))


def crop_part(source, box):
    part = source.crop(box)
    bbox = part.getbbox()
    if not bbox:
        raise RuntimeError(f"Empty crop {box}")
    return part.crop(bbox)


def remove_all_checker(image):
    rgba = image.copy()
    pixels = list(rgba.getdata())
    rgba.putdata([(0, 0, 0, 0) if is_checker(pixel) else pixel for pixel in pixels])
    return rgba


def placed(part, size, xy, opacity=255):
    part = part.resize(size, Image.Resampling.LANCZOS)
    if opacity != 255:
        part.putalpha(part.getchannel("A").point(lambda a: a * opacity // 255))
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.alpha_composite(part, xy)
    return canvas


def masked_section(image, box, feather=0):
    mask = Image.new("L", CANVAS, 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle(box, fill=255)
    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    result = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    result.paste(image, mask=ImageChops.multiply(image.getchannel("A"), mask))
    return result


def alpha_tint(base, color, blur=0, offset=(0, 0)):
    alpha = base.getchannel("A")
    if blur:
        alpha = alpha.filter(ImageFilter.GaussianBlur(blur))
    if offset != (0, 0):
        moved = Image.new("L", CANVAS, 0)
        moved.paste(alpha, offset)
        alpha = moved
    tint = Image.new("RGBA", CANVAS, color)
    tint.putalpha(ImageChops.multiply(alpha, Image.new("L", CANVAS, color[3])))
    return tint


def eye_white(box):
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.ellipse(box, fill=(255, 252, 250, 255), outline=(92, 49, 55, 255), width=4)
    return canvas


def closed_lid(side):
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    if side == "left":
        points = [(407, 579), (419, 590), (435, 595), (451, 593), (467, 585), (479, 574)]
        lashes = [((408, 579), (399, 572)), ((412, 585), (401, 582))]
    else:
        points = [(545, 574), (557, 585), (573, 593), (589, 595), (605, 590), (617, 579)]
        lashes = [((616, 579), (625, 572)), ((612, 585), (623, 582))]
    draw.line(points, fill=(55, 31, 37, 255), width=7, joint="curve")
    for start, end in lashes:
        draw.line((start, end), fill=(55, 31, 37, 255), width=5)
    return canvas


def save_layer(name, image):
    path = LAYERS / f"{name}.png"
    image.save(path, optimize=True)
    return path


def build_layers(source):
    parts = {
        "back_hair": crop_part(source, (20, 0, 445, 475)),
        "side_left": crop_part(source, (440, 20, 555, 475)),
        "side_right": crop_part(source, (535, 20, 665, 475)),
        "front_hair": crop_part(source, (665, 20, 1020, 475)),
        "face": crop_part(source, (1015, 20, 1285, 300)),
        "neck": crop_part(source, (1050, 275, 1180, 350)),
        "brow_l": crop_part(source, (1220, 275, 1325, 335)),
        "brow_r": crop_part(source, (1345, 275, 1455, 335)),
        "eye_white_l": crop_part(source, (1015, 340, 1105, 430)),
        "iris_l": crop_part(source, (1095, 340, 1175, 430)),
        "iris_r": crop_part(source, (1165, 340, 1245, 430)),
        "eye_white_r": crop_part(source, (1230, 340, 1320, 430)),
        "lid_open_l": crop_part(source, (1300, 340, 1385, 425)),
        "lid_open_r": crop_part(source, (1365, 340, 1460, 425)),
        "lid_closed_l": crop_part(source, (1430, 340, 1520, 425)),
        "lid_closed_r": crop_part(source, (1500, 340, 1610, 425)),
        "mouth_closed": crop_part(source, (1025, 425, 1105, 500)),
        "mouth_small": crop_part(source, (1100, 425, 1185, 500)),
        "mouth_wide": crop_part(source, (1170, 425, 1275, 505)),
        "mouth_o": crop_part(source, (1260, 425, 1345, 500)),
        "mouth_happy": crop_part(source, (1335, 425, 1430, 500)),
        "torso_shape": crop_part(source, (75, 465, 420, 790)),
        "blouse": crop_part(source, (455, 475, 700, 695)),
        "collar": crop_part(source, (770, 485, 1115, 685)),
        "bow": crop_part(source, (1180, 505, 1370, 695)),
        "earring_l": crop_part(source, (440, 660, 535, 790)),
        "earring_r": crop_part(source, (525, 660, 625, 790)),
        "glasses": crop_part(source, (665, 655, 935, 800)),
        "hair_highlight": crop_part(source, (40, 790, 345, 940)),
        "skirt": crop_part(source, (1310, 780, 1585, 960)),
    }
    for key in ("back_hair", "side_left", "side_right", "front_hair", "glasses", "hair_highlight"):
        parts[key] = remove_all_checker(parts[key])

    layers = {}
    # Register the neutral assembly to the canonical Bust Lab bust: a low, wide
    # head silhouette with the shoulders beginning directly beneath the chin.
    layers["01_Back_Hair"] = placed(parts["back_hair"], (690, 800), (167, 220))
    layers["02_Hair_Shadow"] = alpha_tint(layers["01_Back_Hair"], (28, 12, 35, 52), blur=5, offset=(0, 16))
    body_mask = placed(parts["torso_shape"], (390, 370), (317, 720))
    body_alpha = body_mask.getchannel("A")
    # Neutral underlay prevents holes during deformation without exposing skin-coloured shoulders.
    body = Image.new("RGBA", CANVAS, (242, 235, 248, 255)); body.putalpha(body_alpha)
    layers["03_Torso_Underlay"] = body
    full_outfit = placed(parts["torso_shape"], (390, 370), (317, 720))
    layers["04_Skirt"] = masked_section(full_outfit, (0, 800, 1024, 1024), 1)
    layers["05_Blouse"] = masked_section(full_outfit, (0, 700, 1024, 940), 1)
    layers["06_Sailor_Collar"] = placed(parts["collar"], (320, 185), (352, 715))
    layers["07_Clothing_Shadow"] = alpha_tint(layers["05_Blouse"], (99, 64, 142, 34), blur=4, offset=(0, 10))

    full_face = placed(parts["face"], (290, 310), (367, 410))
    layers["08_Neck"] = placed(parts["neck"], (105, 64), (460, 690))
    layers["09_Left_Ear"] = masked_section(full_face, (355, 505, 405, 645), 2)
    layers["10_Right_Ear"] = masked_section(full_face, (619, 505, 669, 645), 2)
    face_mask = Image.new("L", CANVAS, 0)
    ImageDraw.Draw(face_mask).ellipse((370, 412, 654, 715), fill=255)
    layers["11_Face_Base"] = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    layers["11_Face_Base"].paste(full_face, mask=ImageChops.multiply(full_face.getchannel("A"), face_mask))
    layers["12_Face_Shadow"] = alpha_tint(layers["11_Face_Base"], (206, 104, 111, 25), blur=8, offset=(0, 14))

    layers["13_Left_Eye_White"] = eye_white((410, 548, 477, 626))
    layers["14_Right_Eye_White"] = eye_white((547, 548, 614, 626))
    layers["15_Left_Iris"] = placed(parts["iris_l"], (42, 58), (423, 557))
    layers["16_Right_Iris"] = placed(parts["iris_r"], (42, 58), (560, 557))
    layers["17_Left_Upper_Lid"] = placed(parts["lid_open_l"], (74, 33), (406, 540))
    layers["18_Right_Upper_Lid"] = placed(parts["lid_open_r"], (74, 33), (544, 540))
    layers["19_Left_Closed_Lid"] = closed_lid("left")
    layers["20_Right_Closed_Lid"] = closed_lid("right")
    layers["21_Left_Eyebrow"] = placed(parts["brow_l"], (66, 22), (410, 522))
    layers["22_Right_Eyebrow"] = placed(parts["brow_r"], (66, 22), (548, 522))

    mouth_specs = [
        ("23_Mouth_Closed", "mouth_closed", (58, 34), (483, 651)),
        ("24_Mouth_Small_Open", "mouth_small", (40, 29), (492, 651)),
        ("25_Mouth_Wide_Open", "mouth_wide", (54, 37), (485, 646)),
        ("26_Mouth_Surprised_O", "mouth_o", (24, 27), (500, 652)),
        ("27_Mouth_Happy", "mouth_happy", (55, 37), (484, 646)),
    ]
    for name, key, size, xy in mouth_specs:
        layers[name] = placed(parts[key], size, xy)

    layers["28_Left_Side_Hair"] = placed(parts["side_left"], (145, 515), (258, 185))
    layers["29_Right_Side_Hair"] = placed(parts["side_right"], (145, 515), (621, 185))
    layers["30_Front_Hair_Bangs"] = placed(parts["front_hair"], (535, 675), (245, 225))
    layers["31_Hair_Highlights"] = placed(parts["hair_highlight"], (350, 170), (337, 80), opacity=90)
    layers["32_Glasses"] = placed(parts["glasses"], (218, 116), (403, 535))
    layers["33_Left_Earring"] = placed(parts["earring_l"], (27, 65), (382, 602))
    layers["34_Right_Earring"] = placed(parts["earring_r"], (27, 65), (615, 602))
    full_bow = placed(parts["bow"], (132, 132), (446, 735))
    star_mask = Image.new("L", CANVAS, 0)
    ImageDraw.Draw(star_mask).ellipse((490, 740, 535, 790), fill=255)
    layers["36_Star_Brooch"] = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    layers["36_Star_Brooch"].paste(full_bow, mask=ImageChops.multiply(full_bow.getchannel("A"), star_mask))
    bow_alpha = full_bow.getchannel("A")
    ImageDraw.Draw(bow_alpha).ellipse((490, 740, 535, 790), fill=0)
    full_bow.putalpha(bow_alpha)
    layers["35_Bow"] = full_bow
    return layers


VISIBLE_DEFAULT = {
    "01_Back_Hair", "02_Hair_Shadow", "04_Skirt", "05_Blouse",
    "06_Sailor_Collar", "07_Clothing_Shadow", "08_Neck", "09_Left_Ear", "10_Right_Ear",
    "11_Face_Base", "12_Face_Shadow", "13_Left_Eye_White", "14_Right_Eye_White",
    "15_Left_Iris", "16_Right_Iris", "17_Left_Upper_Lid", "18_Right_Upper_Lid",
    "21_Left_Eyebrow", "22_Right_Eyebrow", "23_Mouth_Closed",
    "30_Front_Hair_Bangs", "32_Glasses",
    "33_Left_Earring", "34_Right_Earring", "35_Bow", "36_Star_Brooch"
}


def composite(layers, visible=None):
    result = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    visible = VISIBLE_DEFAULT if visible is None else visible
    order = [
        "01_Back_Hair", "02_Hair_Shadow", "28_Left_Side_Hair", "29_Right_Side_Hair",
        "03_Torso_Underlay", "04_Skirt", "05_Blouse", "06_Sailor_Collar", "07_Clothing_Shadow",
        "08_Neck", "09_Left_Ear", "10_Right_Ear", "11_Face_Base", "12_Face_Shadow",
        "13_Left_Eye_White", "14_Right_Eye_White", "15_Left_Iris", "16_Right_Iris",
        "17_Left_Upper_Lid", "18_Right_Upper_Lid", "19_Left_Closed_Lid", "20_Right_Closed_Lid",
        "21_Left_Eyebrow", "22_Right_Eyebrow",
        "23_Mouth_Closed", "24_Mouth_Small_Open", "25_Mouth_Wide_Open",
        "26_Mouth_Surprised_O", "27_Mouth_Happy", "30_Front_Hair_Bangs",
        "31_Hair_Highlights", "33_Left_Earring",
        "34_Right_Earring", "32_Glasses", "35_Bow", "36_Star_Brooch"
    ]
    for name in order:
        layer = layers[name]
        if name in visible:
            result.alpha_composite(layer)
    return result


def write_expression_contact(layers):
    states = [
        ("Neutral", "23_Mouth_Closed", False),
        ("Blink", "23_Mouth_Closed", True),
        ("Talk small", "24_Mouth_Small_Open", False),
        ("Talk wide", "25_Mouth_Wide_Open", False),
        ("Surprised", "26_Mouth_Surprised_O", False),
        ("Happy", "27_Mouth_Happy", True),
    ]
    sheet = Image.new("RGB", (768, 2 * 286), "#f1e8f5")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=16)
    mouth_names = {f"{number:02d}_" for number in range(23, 28)}
    for index, (label, mouth, blink) in enumerate(states):
        visible = {name for name in VISIBLE_DEFAULT if not any(name.startswith(prefix) for prefix in mouth_names)}
        visible.add(mouth)
        if blink:
            visible -= {"13_Left_Eye_White", "14_Right_Eye_White", "15_Left_Iris", "16_Right_Iris",
                        "17_Left_Upper_Lid", "18_Right_Upper_Lid"}
            visible |= {"19_Left_Closed_Lid", "20_Right_Closed_Lid"}
        full = composite(layers, visible)
        image = full.crop((270, 95, 754, 695)).resize((256, 256), Image.Resampling.LANCZOS)
        x, y = (index % 3) * 256, (index // 3) * 286
        tile = Image.new("RGBA", (256, 256), "#faf6fc")
        tile.alpha_composite(image)
        sheet.paste(tile.convert("RGB"), (x, y))
        draw.text((x + 9, y + 262), label, fill="#4b3155", font=font)
    sheet.save(PREVIEW / "expression-alignment-contact-sheet.png")


def write_exact_bustlab_frames():
    atlas = Image.open(EXACT_ATLAS).convert("RGBA")
    names = ["neutral", "blink", "talk-small", "talk-wide", "happy", "surprised"]
    EXACT_DIR.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(names):
        left = index * atlas.width // 6
        right = (index + 1) * atlas.width // 6
        frame = atlas.crop((left, 0, right, atlas.height))
        frame = frame.resize((750, 955), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        canvas.alpha_composite(frame, (137, 78))
        canvas.save(EXACT_DIR / f"{name}.png", optimize=True)


def write_psd(layers):
    wheel = next((ROOT / "vendor").glob("pytoshop-*.whl"))
    sys.path.insert(0, str(wheel))
    from pytoshop import enums
    from pytoshop.user.nested_layers import Group, Image as PsdImage, nested_layers_to_psd

    groups = {
        "Accessories": [], "Hair Front": [], "Face Controls": [], "Face Base": [],
        "Clothing": [], "Hair Back": []
    }
    for name, rgba in layers.items():
        arr = np.asarray(rgba)
        channels = {0: arr[:, :, 0], 1: arr[:, :, 1], 2: arr[:, :, 2], -1: arr[:, :, 3]}
        item = PsdImage(name=name, visible=name in VISIBLE_DEFAULT, channels=channels,
                        color_mode=enums.ColorMode.rgb)
        number = int(name[:2])
        if number >= 32: group = "Accessories"
        elif number in (28, 29): group = "Hair Back"
        elif number >= 30: group = "Hair Front"
        elif number >= 13: group = "Face Controls"
        elif number >= 8: group = "Face Base"
        elif number >= 3: group = "Clothing"
        else: group = "Hair Back"
        groups[group].append(item)
    hierarchy = [Group(name=name, layers=items) for name, items in groups.items()]
    # ZIP storage avoids pytoshop's optional compiled PackBits extension and keeps the PSD compact.
    psd = nested_layers_to_psd(hierarchy, enums.ColorMode.rgb,
                               compression=enums.Compression.zip,
                               size=(CANVAS[1], CANVAS[0]))
    with PSD.open("wb") as handle:
        psd.write(handle)


def write_map(layers):
    map_data = {
        "canvas": list(CANVAS),
        "coordinate_policy": "Every PNG is full-canvas and registration-aligned.",
        "default_visible": sorted(VISIBLE_DEFAULT),
        "alternate_hidden": sorted(set(layers) - VISIBLE_DEFAULT),
        "groups": {
            "Hair Back": [n for n in layers if int(n[:2]) <= 2 or int(n[:2]) in (28, 29)],
            "Clothing": [n for n in layers if 3 <= int(n[:2]) <= 7],
            "Face Base": [n for n in layers if 8 <= int(n[:2]) <= 12],
            "Face Controls": [n for n in layers if 13 <= int(n[:2]) <= 27],
            "Hair Front": [n for n in layers if 30 <= int(n[:2]) <= 31],
            "Accessories": [n for n in layers if int(n[:2]) >= 32],
        }
    }
    (DOCS / "layer-map.json").write_text(json.dumps(map_data, indent=2) + "\n", encoding="utf-8")

    diagram = Image.new("RGB", (1400, 900), "#f7f0fb")
    d = ImageDraw.Draw(diagram)
    font = ImageFont.load_default(size=22)
    small = ImageFont.load_default(size=17)
    d.text((45, 30), "Sweetchie Live2D Cut-Art Layer Map", fill="#42264f", font=font)
    columns = [(45, "BACK", ["Back Hair", "Side Hair L/R", "Hair Shadow", "Torso Underlay", "Skirt", "Blouse", "Collar"]),
               (360, "FACE", ["Neck / Ears", "Face Base", "Face Shadow", "Eye Whites", "Irises", "Lids", "Brows", "Mouth Sets"]),
               (700, "FRONT", ["Front Hair + Bangs", "Hair Highlights", "Glasses", "Earrings", "Bow", "Star Brooch"]),
               (1040, "CUBISM LINKS", ["Angle X/Y -> hair + face", "Eye Open -> lid sets", "Eye Ball X/Y -> irises", "Mouth Open/Form -> mouths", "Breath -> torso + bow", "Physics -> side hair + earrings"])]
    for x, title, items in columns:
        d.rounded_rectangle((x, 95, x + 285, 820), 20, fill="white", outline="#b897cb", width=3)
        d.text((x + 20, 120), title, fill="#6c3483", font=font)
        y = 175
        for item in items:
            d.rounded_rectangle((x + 18, y, x + 267, y + 58), 12, fill="#eee0f7", outline="#d0b3df")
            d.text((x + 32, y + 18), item, fill="#42264f", font=small)
            y += 78
    diagram.save(DOCS / "layer-map.png")


def main():
    preview_only = "--preview-only" in sys.argv
    for folder in (LAYERS, PREVIEW, DOCS): folder.mkdir(parents=True, exist_ok=True)
    cleaned = remove_checker(Image.open(SOURCE))
    cleaned.save(ROOT / "source" / "sweetchie-cut-parts-clean.png", optimize=True)
    write_exact_bustlab_frames()
    layers = build_layers(cleaned)
    for name, layer in layers.items(): save_layer(name, layer)
    preview = composite(layers)
    preview.save(PREVIEW / "sweetchie-assembled-preview.png", optimize=True)
    checker = Image.new("RGB", CANVAS, "white")
    draw = ImageDraw.Draw(checker)
    for y in range(0, 1024, 32):
        for x in range(0, 1024, 32):
            if (x // 32 + y // 32) % 2: draw.rectangle((x, y, x + 31, y + 31), fill="#eee8f1")
    checker.paste(preview, mask=preview.getchannel("A"))
    checker.save(PREVIEW / "sweetchie-assembled-checkerboard.png")
    write_expression_contact(layers)
    if not preview_only:
        write_psd(layers)
    write_map(layers)
    alpha_ok = all(img.getchannel("A").getextrema()[0] == 0 for img in layers.values())
    report = {"ok": alpha_ok and len(layers) == 36 and (preview_only or PSD.exists()), "layer_count": len(layers),
              "canvas": list(CANVAS), "all_layers_have_transparency": alpha_ok,
              "psd_bytes": PSD.stat().st_size, "preview_bbox": list(preview.getbbox() or ())}
    (DOCS / "validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
