from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "images"


def optimize(name: str, max_edge: int) -> None:
    path = IMAGES / name
    with Image.open(path) as source:
        image = source.convert("RGBA")
        image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        # Palette conversion keeps the launcher artwork compact while retaining alpha.
        compact = image.convert("P", palette=Image.Palette.ADAPTIVE, colors=256)
        compact.save(path, format="PNG", optimize=True)


def main() -> None:
    for file_name in ("icon.png", "splash-icon.png", "android-icon-foreground.png"):
        optimize(file_name, 1024)
    optimize("favicon.png", 64)


if __name__ == "__main__":
    main()
