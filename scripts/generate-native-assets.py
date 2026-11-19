#!/usr/bin/env python3
import base64
import os
import shutil
import struct
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

MAP_PNG = os.path.join(PROJECT_ROOT, "public/images/uganda-osm-map.png")
b64_map = ""
if os.path.exists(MAP_PNG):
    with open(MAP_PNG, "rb") as f:
        b64_map = base64.b64encode(f.read()).decode("ascii")

ICON_SVG = os.path.join(PROJECT_ROOT, "src/app/icon.svg")

if not os.path.exists(ICON_SVG):
    print("Icon SVG not found:", ICON_SVG)
    exit(1)

with open(ICON_SVG, "r") as f:
    icon_content = f.read()

start_defs = icon_content.find("<defs>")
end_svg = icon_content.rfind("</svg>")
inner_content = icon_content[start_defs:end_svg]

def render_svg(svg_code, out_png, width, height):
    tmp_svg = f"/tmp/render_tmp_{width}_{height}_{os.path.basename(out_png)}.svg"
    with open(tmp_svg, "w") as f:
        f.write(svg_code)
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    subprocess.run(["rsvg-convert", "-w", str(width), "-h", str(height), "-f", "png", tmp_svg, "-o", out_png], check=True)
    if os.path.exists(tmp_svg):
        os.remove(tmp_svg)

def make_icon_svg(bg_shape, emblem_scale, tx, ty):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  {bg_shape}
  <g transform="translate({tx} {ty}) scale({emblem_scale})">
    {inner_content}
  </g>
</svg>"""

foreground_svg = make_icon_svg("", 0.44, 143.36, 143.36)
round_svg = make_icon_svg('<circle cx="256" cy="256" r="256" fill="#1a1524"/>', 0.50, 128.0, 128.0)
squircle_svg = make_icon_svg('<rect width="512" height="512" rx="115" fill="#1a1524"/>', 0.52, 122.88, 122.88)
square_svg = make_icon_svg('<rect width="512" height="512" fill="#1a1524"/>', 0.52, 122.88, 122.88)
raw_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  {inner_content}
</svg>"""

# Android
if os.path.exists(os.path.join(PROJECT_ROOT, "android")):
    print("Generating Android mipmap icons...")
    densities = {
        "mdpi": {"legacy": 48, "round": 48, "fg": 108},
        "hdpi": {"legacy": 72, "round": 72, "fg": 162},
        "xhdpi": {"legacy": 96, "round": 96, "fg": 216},
        "xxhdpi": {"legacy": 144, "round": 144, "fg": 324},
        "xxxhdpi": {"legacy": 192, "round": 192, "fg": 432},
    }
    for density, sizes in densities.items():
        dir_path = os.path.join(PROJECT_ROOT, f"android/app/src/main/res/mipmap-{density}")
        render_svg(squircle_svg, os.path.join(dir_path, "ic_launcher.png"), sizes["legacy"], sizes["legacy"])
        render_svg(round_svg, os.path.join(dir_path, "ic_launcher_round.png"), sizes["round"], sizes["round"])
        render_svg(foreground_svg, os.path.join(dir_path, "ic_launcher_foreground.png"), sizes["fg"], sizes["fg"])

    v24_xml = os.path.join(PROJECT_ROOT, "android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml")
    if os.path.exists(v24_xml):
        os.remove(v24_xml)

    print("Generating Android splash screens...")
    splashes = [
        ("android/app/src/main/res/drawable/splash.png", 480, 320),
        ("android/app/src/main/res/drawable-land-mdpi/splash.png", 480, 320),
        ("android/app/src/main/res/drawable-land-hdpi/splash.png", 800, 480),
        ("android/app/src/main/res/drawable-land-xhdpi/splash.png", 1280, 720),
        ("android/app/src/main/res/drawable-land-xxhdpi/splash.png", 1600, 960),
        ("android/app/src/main/res/drawable-land-xxxhdpi/splash.png", 1920, 1280),
        ("android/app/src/main/res/drawable-port-mdpi/splash.png", 320, 480),
        ("android/app/src/main/res/drawable-port-hdpi/splash.png", 480, 800),
        ("android/app/src/main/res/drawable-port-xhdpi/splash.png", 720, 1280),
        ("android/app/src/main/res/drawable-port-xxhdpi/splash.png", 960, 1600),
        ("android/app/src/main/res/drawable-port-xxxhdpi/splash.png", 1280, 1920),
    ]
    def make_splash_svg(w, h):
        map_scale = max(w / 1280.0, h / 1280.0)
        map_w = 1280.0 * map_scale
        map_h = 1280.0 * map_scale
        map_tx = (w - map_w) / 2.0
        map_ty = (h - map_h) / 2.0

        icon_scale = (min(w, h) * 0.40) / 512.0
        icon_w = 512.0 * icon_scale
        icon_h = 512.0 * icon_scale
        icon_tx = (w - icon_w) / 2.0
        icon_ty = (h - icon_h) / 2.0

        map_layer = f'<g transform="translate({map_tx} {map_ty}) scale({map_scale})"><image href="data:image/png;base64,{b64_map}" width="1280" height="1280"/></g>' if b64_map else '<rect width="100%" height="100%" fill="#e8ece9"/>'

        return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none">
  <defs>
    <filter id="iconShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#e8ece9"/>
  {map_layer}
  <g transform="translate({icon_tx} {icon_ty}) scale({icon_scale})" filter="url(#iconShadow)">
    {inner_content}
  </g>
</svg>"""

    def make_splash_icon_svg():
        return f"""<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
  <defs>
    <filter id="iconDropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>
  <g transform="translate(82 82) scale(0.68)" filter="url(#iconDropShadow)">
    {inner_content}
  </g>
</svg>"""

    for rel_path, w, h in splashes:
        splash_svg = make_splash_svg(w, h)
        out_path = os.path.join(PROJECT_ROOT, rel_path)
        render_svg(splash_svg, out_path, w, h)

    print("Generating Android 12+ splash icon with Uganda map...")
    splash_icon_svg = make_splash_icon_svg()
    render_svg(splash_icon_svg, os.path.join(PROJECT_ROOT, "android/app/src/main/res/drawable/splash_icon.png"), 512, 512)
    render_svg(splash_icon_svg, os.path.join(PROJECT_ROOT, "android/app/src/main/res/drawable-nodpi/splash_icon.png"), 512, 512)

# iOS
if os.path.exists(os.path.join(PROJECT_ROOT, "ios")):
    print("Generating iOS assets...")
    ios_icon = os.path.join(PROJECT_ROOT, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
    render_svg(square_svg, ios_icon, 1024, 1024)

    ios_splashes = [
        "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
        "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png",
        "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png",
    ]
    ios_splash_svg = make_splash_svg(2732, 2732)
    for rel_path in ios_splashes:
        out_path = os.path.join(PROJECT_ROOT, rel_path)
        render_svg(ios_splash_svg, out_path, 2732, 2732)

# Web & PWA
print("Generating Web / PWA PNG icons...")
web_icons = [
    ("public/icons/icon-192.png", raw_svg, 192, 192),
    ("public/icons/icon-512.png", raw_svg, 512, 512),
    ("public/icons/icon-maskable-512.png", raw_svg, 512, 512),
    ("public/icons/apple-touch-icon.png", square_svg, 180, 180),
    ("public/apple-touch-icon.png", square_svg, 180, 180),
]
for rel_path, svg_data, w, h in web_icons:
    out_path = os.path.join(PROJECT_ROOT, rel_path)
    render_svg(svg_data, out_path, w, h)

print("Generating favicon.ico...")
ico_sizes = [16, 32, 48]
png_blobs = []
for s in ico_sizes:
    tmp_png = f"/tmp/ico_{s}.png"
    render_svg(raw_svg, tmp_png, s, s)
    with open(tmp_png, "rb") as f:
        png_blobs.append((s, f.read()))
    os.remove(tmp_png)

ico_header = struct.pack("<HHH", 0, 1, len(png_blobs))
ico_dir = b""
offset = 6 + 16 * len(png_blobs)
for s, data in png_blobs:
    w_byte = 0 if s >= 256 else s
    h_byte = 0 if s >= 256 else s
    entry = struct.pack("<BBBBHHII", w_byte, h_byte, 0, 0, 1, 32, len(data), offset)
    ico_dir += entry
    offset += len(data)

ico_data = ico_header + ico_dir + b"".join(d for _, d in png_blobs)
with open(os.path.join(PROJECT_ROOT, "public/favicon.ico"), "wb") as f:
    f.write(ico_data)

if shutil.which("iconutil"):
    print("Generating native desktop UgandaWeather.icns...")
    tmp_iconset = "/tmp/UgandaWeather.iconset"
    shutil.rmtree(tmp_iconset, ignore_errors=True)
    os.makedirs(tmp_iconset, exist_ok=True)
    icns_sizes = [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]
    for name, sz in icns_sizes:
        render_svg(raw_svg, os.path.join(tmp_iconset, name), sz, sz)
    subprocess.run(["iconutil", "-c", "icns", tmp_iconset, "-o", os.path.join(PROJECT_ROOT, "public/icons/UgandaWeather.icns")], check=True)
    shutil.rmtree(tmp_iconset, ignore_errors=True)

print("Native and web asset generation complete.")

