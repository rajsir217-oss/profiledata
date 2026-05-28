#!/usr/bin/env python3
"""
Generate Play Store assets for L3V3L Matches Messenger.
Run: python3 generate-play-store-assets.py
Requires: pip install pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Brand colors (from your theme)
PRIMARY = (233, 69, 96)       # Pink/magenta
SECONDARY = (102, 126, 234)   # Purple
DARK_BG = (30, 30, 46)        # Dark background
LIGHT_BG = (255, 245, 247)    # Light pinkish background
WHITE = (255, 255, 255)

def draw_butterfly(draw, cx, cy, size, color):
    """Draw a simple butterfly shape at center (cx, cy)."""
    s = size
    # Left wing
    draw.polygon([
        (cx, cy - s//4),
        (cx - s//2, cy - s//2),
        (cx - s//3, cy),
        (cx - s//2, cy + s//2),
        (cx, cy + s//4),
    ], fill=color)
    # Right wing
    draw.polygon([
        (cx, cy - s//4),
        (cx + s//2, cy - s//2),
        (cx + s//3, cy),
        (cx + s//2, cy + s//2),
        (cx, cy + s//4),
    ], fill=color)
    # Body
    draw.ellipse([cx - s//12, cy - s//3, cx + s//12, cy + s//3], fill=color)


def generate_app_icon(output_path="play-store-icon.png"):
    """Generate 512x512 app icon."""
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded square background with gradient simulation
    radius = size // 8
    # Main background
    draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=PRIMARY)

    # Subtle highlight at top
    draw.rounded_rectangle([0, 0, size, size//2], radius=radius, fill=(255, 255, 255, 30))

    # Butterfly in center
    butterfly_size = size // 3
    draw_butterfly(draw, size // 2, size // 2 - 20, butterfly_size, WHITE)

    # App name text
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 42)
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
    except:
        font = ImageFont.load_default()
        font_small = font

    text = "L3V3L"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((size - tw) // 2, size - 110), text, font=font, fill=WHITE)

    text2 = "Messenger"
    bbox2 = draw.textbbox((0, 0), text2, font=font_small)
    tw2 = bbox2[2] - bbox2[0]
    draw.text(((size - tw2) // 2, size - 60), text2, font=font_small, fill=(255, 255, 255, 200))

    img.save(output_path, "PNG")
    print(f"  App icon: {output_path} ({size}x{size})")
    return output_path


def generate_feature_graphic(output_path="play-store-feature-graphic.png"):
    """Generate 1024x500 feature graphic."""
    w, h = 1024, 500
    img = Image.new("RGBA", (w, h), DARK_BG)
    draw = ImageDraw.Draw(img)

    # Subtle gradient background (simulate with layered rectangles)
    for i in range(h):
        alpha = int(30 * (1 - i / h))
        draw.line([(0, i), (w, i)], fill=(PRIMARY[0], PRIMARY[1], PRIMARY[2], alpha))

    # Decorative circles
    draw.ellipse([w - 200, -100, w + 100, 200], fill=(PRIMARY[0], PRIMARY[1], PRIMARY[2], 40))
    draw.ellipse([-100, h - 200, 200, h + 100], fill=(SECONDARY[0], SECONDARY[1], SECONDARY[2], 40))

    # Butterfly logo
    butterfly_size = 120
    draw_butterfly(draw, w // 2, h // 2 - 60, butterfly_size, WHITE)

    # Title
    try:
        font_title = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 64)
        font_sub = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 32)
        font_tag = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
    except:
        font_title = ImageFont.load_default()
        font_sub = font_title
        font_tag = font_title

    title = "L3V3L Matches Messenger"
    bbox = draw.textbbox((0, 0), title, font=font_title)
    tw = bbox[2] - bbox[0]
    draw.text(((w - tw) // 2, h // 2 + 40), title, font=font_title, fill=WHITE)

    subtitle = "Real-time chat for your matchmaking journey"
    bbox2 = draw.textbbox((0, 0), subtitle, font=font_sub)
    tw2 = bbox2[2] - bbox2[0]
    draw.text(((w - tw2) // 2, h // 2 + 120), subtitle, font=font_sub, fill=(255, 255, 255, 200))

    tag = "Download on Google Play"
    bbox3 = draw.textbbox((0, 0), tag, font=font_tag)
    tw3 = bbox3[2] - bbox3[0]
    # Tag pill background
    tag_pad = 16
    draw.rounded_rectangle(
        [((w - tw3) // 2 - tag_pad, h // 2 + 180 - tag_pad),
         ((w + tw3) // 2 + tag_pad, h // 2 + 180 + tag_pad + 20)],
        radius=20, fill=PRIMARY
    )
    draw.text(((w - tw3) // 2, h // 2 + 180), tag, font=font_tag, fill=WHITE)

    img.save(output_path, "PNG")
    print(f"  Feature graphic: {output_path} ({w}x{h})")
    return output_path


if __name__ == "__main__":
    print("Generating Play Store assets for L3V3L Matches Messenger...")
    print()

    os.makedirs("generated-assets", exist_ok=True)

    icon = generate_app_icon("generated-assets/play-store-icon-512.png")
    graphic = generate_feature_graphic("generated-assets/play-store-feature-graphic-1024x500.png")

    print()
    print("Done! Files created:")
    print(f"  1. {icon}")
    print(f"  2. {graphic}")
    print()
    print("Next steps:")
    print("  - Review the generated images")
    print("  - Replace with professional designer assets when ready")
    print("  - Copy icon-512.png to messenger-web/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png")
    print("    (and regenerate all densities using capacitor-assets or Android Studio)")
