"""Generate TimeTracker icons and mobile splash screens."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SPLASH = ASSETS / "splash"

ICON_SIZES = (16, 48, 128, 192, 512)
MASKABLE_SIZE = 512

SPLASH_SCREENS = (
    (1290, 2796, "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"),
    (1179, 2556, "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"),
    (1170, 2532, "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"),
    (1284, 2778, "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"),
    (828, 1792, "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"),
    (750, 1334, "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"),
    (1668, 2388, "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"),
    (2048, 2732, "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"),
)

# TimeTracker palette (matches assets/icon.svg)
BG_APP = (5, 7, 15)
BG_SURFACE = (7, 11, 20)  # #070b14 outer rounded rect
SLATE_800 = (30, 41, 57)  # #1e293b inner rounded rect
BG_CARD = (17, 24, 39)
SLATE_700 = (51, 65, 85)
SLATE_500 = (100, 116, 139)
SLATE_400 = (148, 163, 184)
BLUE_400 = (96, 165, 250)  # #60a5fa clock ring and hands
BLUE_500 = (59, 130, 246)  # #3b82f6 center dot
GREEN_400 = (52, 211, 153)
RED_400 = (248, 113, 113)
WHITE = (255, 255, 255, 255)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def blend(bg: tuple[int, int, int], fg: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    fr, fg_c, fb, fa = fg
    if fa <= 0:
        return (*bg, 255)
    alpha = fa / 255
    inv = 1 - alpha
    return (
        int(fr * alpha + bg[0] * inv),
        int(fg_c * alpha + bg[1] * inv),
        int(fb * alpha + bg[2] * inv),
        255,
    )


def rounded_rect_mask(x: float, y: float, w: float, h: float, r: float, px: float, py: float) -> bool:
    if px < x or py < y or px > x + w or py > y + h:
        return False
    r = min(r, w / 2, h / 2)
    if px < x + r and py < y + r:
        return (px - (x + r)) ** 2 + (py - (y + r)) ** 2 <= r ** 2
    if px > x + w - r and py < y + r:
        return (px - (x + w - r)) ** 2 + (py - (y + r)) ** 2 <= r ** 2
    if px < x + r and py > y + h - r:
        return (px - (x + r)) ** 2 + (py - (y + h - r)) ** 2 <= r ** 2
    if px > x + w - r and py > y + h - r:
        return (px - (x + w - r)) ** 2 + (py - (y + h - r)) ** 2 <= r ** 2
    return True


def in_ring(px: float, py: float, cx: float, cy: float, inner: float, outer: float) -> bool:
    dist = math.hypot(px - cx, py - cy)
    return inner <= dist <= outer


def in_disk(px: float, py: float, cx: float, cy: float, radius: float) -> bool:
    return math.hypot(px - cx, py - cy) <= radius


def dist_to_segment(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return math.hypot(px - proj_x, py - proj_y)


def render_icon(size: int, *, on_dark: bool = False) -> list[tuple[int, int, int, int]]:
    """Rasterize assets/icon.svg at the given size."""
    pixels: list[tuple[int, int, int, int]] = []
    scale = size / 512

    def s(v: float) -> float:
        return v * scale

    outer_box = (s(0), s(0), s(512), s(512), s(112))
    icon_box = (s(108), s(108), s(296), s(296), s(56))

    cx = s(256)
    cy = s(256)
    clock_radius = s(118)
    ring_half = s(10)
    hour_half = max(s(10), 0.75)
    minute_half = max(s(7.5), 0.75)
    center_radius = s(6)

    hour_end = (cx, s(194))
    minute_end = (s(295), s(217))

    canvas_bg = BG_APP if on_dark else BG_SURFACE

    for py in range(size):
        for px in range(size):
            px_f = px + 0.5
            py_f = py + 0.5

            if not rounded_rect_mask(*outer_box, px_f, py_f):
                pixels.append((*canvas_bg, 255))
                continue

            color = (*BG_SURFACE, 255)

            if rounded_rect_mask(*icon_box, px_f, py_f):
                color = (*SLATE_800, 255)

            ring_inner = clock_radius - ring_half
            ring_outer = clock_radius + ring_half
            if in_ring(px_f, py_f, cx, cy, ring_inner, ring_outer):
                color = (*BLUE_400, 255)
            elif in_disk(px_f, py_f, cx, cy, center_radius):
                color = (*BLUE_500, 255)
            elif dist_to_segment(px_f, py_f, cx, cy, *hour_end) <= hour_half:
                color = (*BLUE_400, 255)
            elif dist_to_segment(px_f, py_f, cx, cy, *minute_end) <= minute_half:
                color = (*BLUE_400, 255)

            pixels.append(color)
    return pixels


def render_maskable_icon(size: int) -> list[tuple[int, int, int, int]]:
    icon_size = int(size * 0.62)
    icon = render_icon(icon_size, on_dark=True)
    offset = (size - icon_size) // 2
    pixels = [(*BG_APP, 255)] * (size * size)

    for y in range(icon_size):
        for x in range(icon_size):
            pixels[(offset + y) * size + offset + x] = icon[y * icon_size + x]
    return pixels


def fill_rect(
    pixels: list[tuple[int, int, int, int]],
    width: int,
    x: int,
    y: int,
    w: int,
    h: int,
    color: tuple[int, int, int, int],
    *,
    radius: float = 0,
) -> None:
    img_height = len(pixels) // width
    x2 = x + w
    y2 = y + h
    for py in range(max(0, y), min(img_height, y2)):
        for px in range(max(0, x), min(width, x2)):
            if radius <= 0 or rounded_rect_mask(x, y, w, h, radius, px + 0.5, py + 0.5):
                pixels[py * width + px] = color


def render_splash(width: int, height: int) -> list[tuple[int, int, int, int]]:
    icon_size = min(width, height) // 4
    icon = render_icon(icon_size)
    center_x = width // 2
    center_y = int(height * 0.42)
    offset_x = center_x - icon_size // 2
    offset_y = center_y - icon_size // 2

    pixels = [(*BG_APP, 255)] * (width * height)

    for y in range(icon_size):
        for x in range(icon_size):
            ix = offset_x + x
            iy = offset_y + y
            if 0 <= ix < width and 0 <= iy < height:
                pixels[iy * width + ix] = icon[y * icon_size + x]

    return pixels


def write_svg(path: Path) -> None:
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="TimeTracker">
  <rect width="512" height="512" rx="112" fill="#070b14"/>
  <rect x="108" y="108" width="296" height="296" rx="56" fill="#1e293b"/>
  <circle cx="256" cy="256" r="118" fill="none" stroke="#60a5fa" stroke-width="20"/>
  <circle cx="256" cy="256" r="6" fill="#3b82f6"/>
  <line x1="256" y1="256" x2="256" y2="194" stroke="#60a5fa" stroke-width="20" stroke-linecap="round"/>
  <line x1="256" y1="256" x2="295" y2="217" stroke="#60a5fa" stroke-width="15" stroke-linecap="round"/>
</svg>
"""
    path.write_text(svg, encoding="utf-8")


def write_png(
    path: Path,
    width: int,
    height: int,
    pixels: list[tuple[int, int, int, int]],
    *,
    rgb: bool = False,
) -> None:
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        start = y * width
        for x in range(width):
            r, g, b, a = pixels[start + x]
            if rgb:
                raw.extend((r, g, b))
            else:
                raw.extend((r, g, b, a))

    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    color_type = 2 if rgb else 6
    ihdr = struct.pack(">IIBBBBB", width, height, 8, color_type, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    SPLASH.mkdir(parents=True, exist_ok=True)

    svg_out = ASSETS / "icon.svg"
    write_svg(svg_out)
    print(f"Wrote {svg_out.relative_to(ROOT)}")

    for size in ICON_SIZES:
        out = ASSETS / f"icon-{size}.png"
        write_png(out, size, size, render_icon(size))
        print(f"Wrote {out.relative_to(ROOT)}")

    maskable = ASSETS / "icon-512-maskable.png"
    write_png(maskable, MASKABLE_SIZE, MASKABLE_SIZE, render_maskable_icon(MASKABLE_SIZE))
    print(f"Wrote {maskable.relative_to(ROOT)}")

    splash_links: list[str] = []
    for width, height, media in SPLASH_SCREENS:
        filename = f"splash-{width}x{height}.png"
        out = SPLASH / filename
        write_png(out, width, height, render_splash(width, height))
        splash_links.append(
            f'    <link rel="apple-touch-startup-image" media="{media}" href="./assets/splash/{filename}" />'
        )
        print(f"Wrote {out.relative_to(ROOT)}")

    snippet = ASSETS / "splash-links.html"
    snippet.write_text("\n".join(splash_links) + "\n", encoding="utf-8")
    print(f"Wrote {snippet.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
