"""Builds the pixel-office sprites in apps/web/public/office from the Pixel Agents art pack (MIT).

The art pack ships its characters and floors as gray layers that the upstream app colours at
runtime. We bake the colours here instead so the web app only loads small finished PNGs.

Usage (needs Pillow and a checkout of https://github.com/pixel-agents-hq/pixel-agents):
    python3 scripts/build-office-sprites.py /path/to/pixel-agents
"""

import shutil
import sys
from pathlib import Path

from PIL import Image

UPSTREAM = Path(sys.argv[1])
ART = UPSTREAM / "webview-ui/src/characters/art"
ASSETS = UPSTREAM / "webview-ui/public/assets"
OUT = Path(__file__).resolve().parent.parent / "apps/web/public/office"


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def tint(im: Image.Image, color: str) -> Image.Image:
    """Colour a gray layer, keeping its shading: its main gray tone becomes `color`."""
    im = im.convert("RGBA")
    px = im.load()
    grays = sorted(px[x, y][0] for x in range(im.width) for y in range(im.height) if px[x, y][3])
    if not grays:
        return im
    ref = max(grays[len(grays) * 3 // 5], 40)  # main tone sits above the outline
    tr, tg, tb = hex_rgb(color)
    out = im.copy()
    op = out.load()
    for x in range(im.width):
        for y in range(im.height):
            r, g, b, a = px[x, y]
            if not a or not (r == g == b):
                continue  # already coloured (e.g. eye whites)
            t = r / ref
            if t <= 1:
                c = (int(tr * t), int(tg * t), int(tb * t))
            else:
                k = min(1, (t - 1) / max(255 / ref - 1, 0.01))
                c = tuple(int(v + (255 - v) * k * 0.8) for v in (tr, tg, tb))
            op[x, y] = (*c, a)
    return out


def skin(im: Image.Image, factor: float) -> Image.Image:
    """Darken or lighten the body layer's skin tones (outline stays put)."""
    out = im.convert("RGBA").copy()
    px = out.load()
    for x in range(out.width):
        for y in range(out.height):
            r, g, b, a = px[x, y]
            if a and r > 100:
                px[x, y] = (min(255, int(r * factor)), min(255, int(g * factor * 0.98)), min(255, int(b * factor * 0.96)), a)
    return out


def layer(path: str) -> Image.Image | None:
    p = ART / f"{path}.png"
    return Image.open(p).convert("RGBA") if p.exists() else None


# Each look: (layer path, colour or None). Drawn in the upstream LAYERS order.
def person(*, hair, hair_c, top=None, top_c="#ffffff", pants="jeans", pants_c="#34405a", shoes="sneakers",
           shoes_c="#2b2b2b", full=None, full_c=None, jacket=None, jacket_c=None, lashes=False, beard=None,
           glasses=False, lanyard=None, necklace=False, earrings=False, hat=None, hat_c=None, tone=1.0):
    eyes = "lashes" if lashes else "plain"
    parts: list[tuple[str, str | None]] = [
        (f"eyes/{eyes}/whites", None),
        (f"eyes/{eyes}/iris.both", "#3b2a20"),
    ]
    if lashes:
        parts.append(("eyes/lashes/lashes", "#1d1716"))
    if pants:
        parts.append((f"pants/{pants}", pants_c))
    if top:
        parts.append((f"top/{top}", top_c))
    if full:
        parts.append((f"full/{full}", full_c))
        parts.append((f"tie/{full}", "#a33a3a"))
    if jacket:
        parts.append((f"jacket/{jacket}", jacket_c))
    if lanyard:
        parts.append(("lanyard/lanyard", lanyard))
    if necklace:
        parts.append(("necklace/necklace_chain", "#d9b44a"))
    parts.append((f"shoes/{shoes}", shoes_c))
    parts.append((f"hair/{hair}", hair_c))
    if earrings:
        parts.append(("earrings/earrings", "#e6c35c"))
    if beard:
        parts.append((f"beard/{beard}", hair_c))
    if glasses:
        parts.append(("shades/glasses", "#2a2a2a"))
    if hat:
        parts.append((f"hat/{hat}", hat_c))

    sheet = skin(layer("body/flat"), tone)
    for path, color in parts:
        im = layer(path)
        if im is None:
            continue
        sheet.alpha_composite(tint(im, color) if color else im)
    return sheet


BLACK, DARK_BROWN, BROWN, GRAYING = "#231c1a", "#3a2a22", "#5a3d2b", "#6b6460"
PEOPLE = {
    # Engineering
    "VX004": person(hair="parted", hair_c=BLACK, top="tshirt", top_c="#3f9e86", glasses=True, tone=0.92),
    "VX007": person(hair="high_ponytail", hair_c=BLACK, top="long_sleeved_shirt", top_c="#5b8f4e", lashes=True, earrings=True, tone=0.98),
    "VX009": person(hair="mop", hair_c=DARK_BROWN, top="tshirt", top_c="#4b5563", beard="stubble", tone=0.85),
    "VX012": person(hair="low_ponytail", hair_c=BLACK, top="turtleneck", top_c="#8c7ac9", lashes=True, glasses=True, tone=1.0),
    "VX018": person(hair="short", hair_c=BROWN, top="tshirt", top_c="#c4473a", lanyard="#2f6bd8", tone=0.9),
    # Finance
    "VX003": person(hair="long", hair_c=BLACK, top="long_sleeved_shirt", top_c="#9c4f86", pants="long_skirt", pants_c="#2c2f3a", lashes=True, earrings=True, tone=0.95),
    "VX010": person(hair="slicked_back", hair_c=BLACK, full="suit_and_tie", full_c="#3a4150", pants=None, tone=0.86),
    "VX014": person(hair="shoulder_length", hair_c=DARK_BROWN, top="tshirt", top_c="#f1efe6", jacket="blazer", jacket_c="#2f7a5c", lashes=True, tone=0.97),
    # People & Ops
    "VX005": person(hair="bob", hair_c=BLACK, top="turtleneck", top_c="#d9a331", pants="skirt", pants_c="#3a3f4f", lashes=True, earrings=True, tone=0.9),
    "VX015": person(hair="side_swept", hair_c=BROWN, top="tshirt", top_c="#e8e4da", jacket="open_shirt", jacket_c="#6aa2c9", beard="moustache", tone=0.95),
    "VX017": person(hair="long_bangs", hair_c=GRAYING, full="dress", full_c="#e08a2c", pants=None, lashes=True, necklace=True, tone=0.82),
    # Marketing
    "VX006": person(hair="spiky", hair_c=DARK_BROWN, top="tshirt", top_c="#262626", jacket="bomber", jacket_c="#e0703f", tone=0.93),
    "VX011": person(hair="long_waves", hair_c=DARK_BROWN, full="fitted_dress", full_c="#d65f6f", pants=None, lashes=True, earrings=True, tone=0.88),
    # Sales
    "VX002": person(hair="short", hair_c=BLACK, top="tshirt", top_c="#f3f3f3", jacket="blazer", jacket_c="#2b4a7a", pants_c="#2d2f36", beard="full_beard", tone=0.88),
}
EXTRAS = {
    "default": person(hair="short", hair_c=DARK_BROWN, top="tshirt", top_c="#7a8aa0", tone=0.92),
    "courier": person(hair="short", hair_c=BLACK, top="tshirt", top_c="#d43d2f", hat="plain_cap", hat_c="#d43d2f", pants="shorts", pants_c="#2b2f3a", tone=0.85),
}

FURNITURE = [
    "DESK/DESK_FRONT", "PC/PC_FRONT_ON_1", "PC/PC_FRONT_ON_2", "PC/PC_FRONT_ON_3", "PC/PC_FRONT_OFF",
    "CUSHIONED_CHAIR/CUSHIONED_CHAIR_BACK", "CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT", "WOODEN_CHAIR/WOODEN_CHAIR_SIDE",
    "BOOKSHELF/BOOKSHELF", "DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF", "CLOCK/CLOCK", "WHITEBOARD/WHITEBOARD",
    "LARGE_PLANT/LARGE_PLANT", "PLANT/PLANT", "PLANT_2/PLANT_2", "CACTUS/CACTUS", "HANGING_PLANT/HANGING_PLANT", "POT/POT",
    "LARGE_PAINTING/LARGE_PAINTING", "SMALL_PAINTING/SMALL_PAINTING", "SMALL_PAINTING_2/SMALL_PAINTING_2",
    "SOFA/SOFA_FRONT", "SOFA/SOFA_BACK", "SOFA/SOFA_SIDE", "COFFEE_TABLE/COFFEE_TABLE", "COFFEE/COFFEE",
    "SMALL_TABLE/SMALL_TABLE_FRONT", "TABLE_FRONT/TABLE_FRONT", "BIN/BIN", "CUSHIONED_BENCH/CUSHIONED_BENCH",
    "WOODEN_BENCH/WOODEN_BENCH",
]
# Floor tiles per room: (upstream floor, colour).
FLOORS = {
    "engineering": ("floor_5", "#7a5536"),
    "finance": ("floor_3", "#b9b09a"),
    "people": ("floor_2", "#8fa98a"),
    "marketing": ("floor_4", "#c98d78"),
    "sales": ("floor_1", "#7f95b8"),
    "corridor": ("floor_1", "#8a7d6b"),
    "lobby": ("floor_4", "#a89a86"),
    "break": ("floor_8", "#c3c9cf"),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()
    (OUT / "people").mkdir(exist_ok=True)
    for name, sheet in {**PEOPLE, **EXTRAS}.items():
        sheet.save(OUT / "people" / f"{name}.png")
    for f in FURNITURE:
        shutil.copy(ASSETS / "furniture" / f"{f}.png", OUT / f"{f.split('/')[1]}.png")
    for room, (tile, color) in FLOORS.items():
        tint(Image.open(ASSETS / "floors" / f"{tile}.png"), color).save(OUT / f"floor-{room}.png")
    shutil.copy(ASSETS / "pets/gitcat/pet.png", OUT / "cat.png")
    shutil.copy(UPSTREAM / "LICENSE", OUT / "LICENSE.txt")
    print(f"Wrote sprites to {OUT}")


main()
