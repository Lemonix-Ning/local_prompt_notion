from PIL import Image
import os

# 目标目录
icon_dir = os.path.join(os.path.dirname(__file__), '../src-tauri/icons')

# 支持的图片格式
image_exts = ['.png']

for fname in os.listdir(icon_dir):
    if any(fname.lower().endswith(ext) for ext in image_exts):
        fpath = os.path.join(icon_dir, fname)
        img = Image.open(fpath)
        # PNG无损压缩
        img.save(fpath, optimize=True)
        print(f"Optimized: {fname}")
