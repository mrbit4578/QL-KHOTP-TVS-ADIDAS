#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-1file.py — SINH BẢN GỘP 1 FILE  TVS-ADIDAS-1FILE.html
===========================================================
Gộp index.html + assets/css/style.css + toàn bộ assets/js/**.js thành
MỘT file HTML duy nhất (mở là chạy, tiện gửi Zalo/Email/USB).

Cách dùng (đứng ở thư mục gốc dự án):
    python3 tools/build-1file.py
    python3 tools/build-1file.py --version v5.0 --out TVS-ADIDAS-1FILE.html

Nguyên tắc:
• Thứ tự script GIỮ ĐÚNG như trong index.html (rất quan trọng: data.js →
  data-packing.js → store.js → … → app.js → collapsible.js)
• Không thay đổi 1 dòng logic nào — chỉ nhúng nội dung file vào thẻ
  <script> / <style>
• Link Google Fonts vẫn giữ (khi có internet thì đẹp hơn, offline vẫn chạy)
"""
import argparse
import os
import re
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="v5.0")
    ap.add_argument("--out", default="TVS-ADIDAS-1FILE.html")
    ap.add_argument("--src", default="index.html")
    a = ap.parse_args()

    html = read(a.src)

    # 1. CSS: <link rel="stylesheet" href="assets/css/style.css"> → <style>…</style>
    css_links = re.findall(r'[ \t]*<link[^>]+href="(assets/[^"]+\.css)"[^>]*>\s*\n?', html)
    if not css_links:
        sys.exit("Không tìm thấy link CSS nội bộ trong " + a.src)
    for href in css_links:
        css = read(href)
        html = re.sub(r'[ \t]*<link[^>]+href="' + re.escape(href) + r'"[^>]*>\s*\n?',
                      "<style>\n" + css + "\n</style>\n", html, count=1)

    # 2. JS: mọi <script src="assets/js/…"> → <script>…</script> (giữ nguyên thứ tự)
    js_srcs = re.findall(r'<script[^>]+src="(assets/js/[^"]+\.js)"[^>]*>\s*</script>', html)
    if not js_srcs:
        sys.exit("Không tìm thấy thẻ script nội bộ trong " + a.src)
    for src in js_srcs:
        code = read(src)
        block = ("<!-- ── " + src + " ── -->\n<script>\n" + code + "\n</script>\n")
        html = re.sub(r'[ \t]*<script[^>]+src="' + re.escape(src) + r'"[^>]*>\s*</script>\s*\n?',
                      lambda m: block, html, count=1)

    # 3. Favicon: nhúng luôn logo.svg dạng data URI để file chạy độc lập 100%
    m = re.search(r'<link[^>]+rel="icon"[^>]+href="(assets/[^"]+\.svg)"[^>]*>', html)
    if m:
        import base64
        b64 = base64.b64encode(read(m.group(1)).encode("utf-8")).decode("ascii")
        html = html.replace(m.group(0), '<link rel="icon" href="data:image/svg+xml;base64,' + b64 + '" type="image/svg+xml">', 1)

    # 4. Đánh dấu bản gộp + phiên bản + thời điểm build
    stamp = ("<!-- BẢN GỘP 1 FILE — sinh tự động bởi tools/build-1file.py ("
             + a.version + " · " + datetime.now().strftime("%d/%m/%Y %H:%M") + ") -->")
    html = html.replace("<title>", stamp + "\n<title>", 1)

    out = os.path.join(ROOT, a.out)
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)

    kb = os.path.getsize(out) / 1024
    print("✓ Đã sinh %s (%.1f KB) — gộp %d CSS + %d JS · phiên bản %s"
          % (a.out, kb, len(css_links), len(js_srcs), a.version))
    for s in js_srcs:
        print("   ·", s)


if __name__ == "__main__":
    main()
