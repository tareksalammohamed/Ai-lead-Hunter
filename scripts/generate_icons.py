from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/upload/file_000000007b2c8210b4363aa42753f1a4.png')
root = Path('/home/ubuntu/github-sync/public')
icons = root / 'icons'
icons.mkdir(parents=True, exist_ok=True)
img = Image.open(source).convert('RGBA')
# Preserve the supplied identity and keep the full artwork inside every square.
for size in (72, 96, 128, 144, 152, 180, 192, 384, 512):
    img.resize((size, size), Image.Resampling.LANCZOS).save(icons / f'app-icon-{size}.png', optimize=True)
img.resize((16, 16), Image.Resampling.LANCZOS).save(root / 'favicon-16x16.png', optimize=True)
img.resize((32, 32), Image.Resampling.LANCZOS).save(root / 'favicon-32x32.png', optimize=True)
# Pillow can write a valid multi-size ICO.
img.save(root / 'favicon.ico', sizes=[(16,16), (32,32), (48,48)])
# Capacitor Android asset generation can use these source layers.
android = root / 'android-icons'
android.mkdir(parents=True, exist_ok=True)
img.resize((432, 432), Image.Resampling.LANCZOS).save(android / 'ic_launcher_foreground.png', optimize=True)
Image.new('RGBA', (432, 432), '#081B33').save(android / 'ic_launcher_background.png', optimize=True)
