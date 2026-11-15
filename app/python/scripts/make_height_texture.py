"""Make the small whole-Moon height picture the website uses to draw terrain shadows on the 3D Moon.

From NASA LRO LOLA LDEM_128 (data/raw/LDEM_128.IMG, 128 pixels per degree): averaged down to
8 pixels per degree (2880 x 1440, about 3.8 km per pixel at the equator) and saved as a PNG whose
red and green channels hold a 16-bit number: height_m = (red * 256 + green) * 0.5 - 12000.
Left edge = 180 W, top = north pole (same layout as the Moon picture).

The shader in app/src/globe.js marches from each point towards the real Sun over this height map to
decide whether terrain blocks it. It is far coarser than the per-site skylines (20 m to 237 m), so
the globe's shadows are a picture of the idea, not the numbers the analysis uses.

Run (from the repo root):  .venv/bin/python app/python/scripts/make_height_texture.py
Writes app/public/data/moon_height.png. Needs numpy and the downloaded LDEM_128.
"""
import os
import struct
import sys
import zlib

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_skyline as ms  # noqa: E402

OUT = os.path.join(ms.ROOT, "app", "public", "data", "moon_height.png")
FACTOR = 16            # 128 pixels per degree -> 8
OFFSET_M = 12000.0     # stored = (height_m + OFFSET_M) / UNIT_M
UNIT_M = 0.5


def write_png_rgb(path, rgb):
    """Minimal PNG writer (8-bit RGB), so the script needs nothing beyond numpy."""
    h, w, _ = rgb.shape
    raw = np.concatenate([np.zeros((h, 1), np.uint8), rgb.reshape(h, w * 3)], axis=1).tobytes()  # filter 0 per row

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def main():
    src = ms.load_global()                                   # rows north to south, columns from 0 E eastward
    rows, cols = src.shape[0] // FACTOR, src.shape[1] // FACTOR
    out = np.empty((rows, cols), np.float32)
    for r in range(rows):                                    # block average, one output row at a time
        block = np.asarray(src[r * FACTOR:(r + 1) * FACTOR], dtype=np.float32)
        out[r] = block.reshape(FACTOR, cols, FACTOR).mean(axis=(0, 2)) * ms.GLOBAL_SCALE
    out = np.roll(out, cols // 2, axis=1)                    # left edge 0 E -> 180 W
    stored = np.clip(np.round((out + OFFSET_M) / UNIT_M), 0, 65535).astype(np.uint16)
    rgb = np.zeros((rows, cols, 3), np.uint8)
    rgb[..., 0] = stored >> 8
    rgb[..., 1] = stored & 255
    write_png_rgb(OUT, rgb)
    print(f"wrote {OUT}: {cols} x {rows}, heights {out.min():.0f} to {out.max():.0f} m, {os.path.getsize(OUT) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
