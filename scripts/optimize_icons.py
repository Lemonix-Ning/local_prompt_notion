from PIL import Image
import os
import subprocess

# 目标目录
icon_dir = os.path.join(os.path.dirname(__file__), '../src-tauri/icons')

# 支持的图片格式
image_exts = ['.png']

# 检查是否安装了 pngquant
has_pngquant = False
try:
    subprocess.run(['pngquant', '--version'], capture_output=True, check=True)
    has_pngquant = True
    print("Using pngquant for aggressive compression")
except:
    print("pngquant not found, using PIL optimize only")

def optimize_png(fpath):
    """优化单个 PNG 文件"""
    if has_pngquant:
        # 使用 pngquant 进行有损压缩（质量 80-95，视觉上无损）
        try:
            subprocess.run([
                'pngquant',
                '--quality=80-95',
                '--speed=1',
                '--force',
                '--output', fpath,
                fpath
            ], check=True, capture_output=True)
            return True
        except:
            pass
    
    # 回退到 PIL 优化
    img = Image.open(fpath)
    img.save(fpath, optimize=True, compress_level=9)
    return False

total_saved = 0
for fname in os.listdir(icon_dir):
    if any(fname.lower().endswith(ext) for ext in image_exts):
        fpath = os.path.join(icon_dir, fname)
        original_size = os.path.getsize(fpath)
        
        used_pngquant = optimize_png(fpath)
        
        new_size = os.path.getsize(fpath)
        saved = original_size - new_size
        total_saved += saved
        
        method = "pngquant" if used_pngquant else "PIL"
        print(f"Optimized ({method}): {fname} - Saved {saved/1024:.1f} KB")

print(f"\nTotal saved: {total_saved/1024/1024:.2f} MB")
