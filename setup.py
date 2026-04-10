"""
LocalNote setup script
Generates PNG icons from the SVG for PWA / iOS home screen.
Run once before `npm run build`.

  python setup.py
"""
import subprocess
import sys
from pathlib import Path

PUBLIC = Path(__file__).parent / "frontend" / "public"


def make_icons_with_pillow():
    from PIL import Image, ImageDraw

    def draw_icon(size: int) -> Image.Image:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        r = size // 8               # corner radius

        # Background
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill="#1e1e2e")

        # Notebook body
        bx, by = int(size * 0.23), int(size * 0.15)
        bw, bh = int(size * 0.53), int(size * 0.70)
        d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=max(4, size // 32), fill="#6b8fff")

        # Spine
        d.rounded_rectangle([bx, by, bx + int(size * 0.08), by + bh], radius=max(3, size // 48), fill="#4a6fe8")

        # Rings
        cx = bx + int(size * 0.04)
        for fy in (0.34, 0.50, 0.66):
            cy = int(size * fy)
            rr = max(3, size // 36)
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill="#1e1e2e")

        # Lines
        lx = bx + int(size * 0.14)
        lw = int(size * 0.35)
        lh = max(2, size // 42)
        for fy, w in ((0.33, 1.0), (0.40, 0.78), (0.47, 0.88), (0.54, 0.67)):
            ly = int(size * fy)
            d.rounded_rectangle([lx, ly, lx + int(lw * w), ly + lh], radius=lh // 2, fill=(255, 255, 255, 178))

        return img

    for sz, fname in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
        img = draw_icon(sz)
        out = PUBLIC / fname
        img.save(str(out), "PNG")
        print(f"  ✓ {out.name}  ({sz}×{sz})")


def main():
    print("LocalNote — generating PWA icons …")
    PUBLIC.mkdir(parents=True, exist_ok=True)
    try:
        make_icons_with_pillow()
    except ImportError:
        print("  Pillow not installed — run:  pip install Pillow")
        sys.exit(1)
    print("\nDone. Now run:\n  cd frontend && npm install && npm run dev")


if __name__ == "__main__":
    main()
