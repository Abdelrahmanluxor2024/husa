#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
خادم تطوير لموقع منصّة الشيخ حسين الشعار
=========================================
ميزاته عن `python3 -m http.server`:

  1) **يُعطّل التخزين المؤقّت تمامًا** (Cache-Control: no-store) — فلا تظهر
     نسخة قديمة من CSS/JS في المتصفّح أثناء التعديل، وهي السبب الأشهر
     لظهور تنسيقٍ قديم بعد إصلاحه.
  2) أنواع MIME صحيحة لكل الأصول (woff2 / mjs / json / svg ...).
  3) ترميز Unicode في المسارات العربية + منع الخروج من مجلّد الموقع.
  4) خيوط متعدّدة (تحميل متوازٍ للخطوط والصور).
  5) يدعم 0.0.0.0 للعمل خلف وكيل المعاينة.

الاستخدام:
    python3 tools/serve.py                 # المنفذ ٨٠٨٠
    python3 tools/serve.py --port 9000 --open
"""

from __future__ import annotations

import argparse
import os
import posixpath
import sys
import urllib.parse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".txt": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json",
}


class NoCacheHandler(SimpleHTTPRequestHandler):
    server_version = "HusaDev/1.0"
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **MIME}
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        # تعطيل أيّ تخزين مؤقّت — يضمن رؤية آخر نسخة دائمًا
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def send_head(self):
        """يعالج المسارات العربية ويُعيد index.html عند طلب مجلّد"""
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            for index in ("index.html", "index.htm"):
                candidate = os.path.join(path, index)
                if os.path.exists(candidate):
                    self.path = urllib.parse.quote(
                        posixpath.join(urllib.parse.urlparse(self.path).path, index)
                    )
                    break
        return super().send_head()

    def log_message(self, fmt, *args):
        if getattr(self.server, "verbose", False):
            sys.stderr.write("  %s - %s\n" % (self.address_string(), fmt % args))


def main():
    ap = argparse.ArgumentParser(description="خادم تطوير بلا تخزين مؤقّت")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--dir", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument("--verbose", action="store_true", help="إظهار سجلّ الطلبات")
    args = ap.parse_args()

    handler = partial(NoCacheHandler, directory=args.dir)
    httpd = ThreadingHTTPServer((args.host, args.port), handler)
    httpd.daemon_threads = True
    httpd.verbose = args.verbose

    print(f"→ خادم التطوير يعمل على http://{args.host}:{args.port}")
    print(f"  المجلّد: {args.dir}")
    print("  التخزين المؤقّت: معطّل (no-store)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nإيقاف…")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
