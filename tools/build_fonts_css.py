#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
توليد assets/css/fonts.css من حزم @fontsource
==============================================
- يقرأ ملفات woff2 الموجودة فعليًّا في assets/fonts/
- يستخرج نطاق unicode-range الأصلي لكل مجموعة (arabic / latin) من حزم Fontsource
  (وهو أمرٌ ضروريّ: بدونه يصاد المتصفّح بمحارف مفقودة مثل «#» و«—» و««»).
- يكتب تعريفات @font-face بمسارات محلّية فقط (بلا شبكة).

ملاحظة: لا تستخدم مجلّدًا باسم build/ لحفظ هذا الملف — فهو مُستثنى من اللقطات.
هذا المجلّد (tools/) هو المكان الصحيح.

الاستخدام:
    npm i @fontsource/amiri @fontsource/aref-ruqaa @fontsource/reem-kufi \\
          @fontsource/noto-naskh-arabic @fontsource/cairo
    # انسخ ملفات woff2 المطلوبة إلى assets/fonts ثم:
    python3 tools/build_fonts_css.py --sources node_modules/@fontsource
"""
from __future__ import annotations

import argparse
import os
import re
import sys

FAMILY = {
    "aref-ruqaa": "Aref Ruqaa",
    "amiri": "Amiri",
    "noto-naskh-arabic": "Noto Naskh Arabic",
    "reem-kufi": "Reem Kufi",
    "cairo": "Cairo",
}

ORDER = ["aref-ruqaa", "amiri", "noto-naskh-arabic", "reem-kufi", "cairo"]

COMMENTS = {
    "aref-ruqaa": "Aref Ruqaa — خط الرقعة الفخم: اسم الشيخ والعناوين الكبرى",
    "amiri": "Amiri — الاقتباسات والأبيات المنقولة",
    "noto-naskh-arabic": "Noto Naskh Arabic — نصّ الأبيات (النسخ الواضح)",
    "reem-kufi": "Reem Kufi — عناوين الأقسام وواجهة الاستخدام",
    "cairo": "Cairo — النصوص الوظيفية وواجهة الاستخدام",
}

BLOCK_RE = re.compile(r"/\*\s*([\w.-]+?)\s*\*/\s*@font-face\s*\{(.*?)\}", re.S)


def parse_package(pkg_dir: str) -> dict:
    """يعيد خريطة: مفتاح «<pkg>-<subset>-<weight>» → unicode-range

    نقرأ index.css (للوزن ٤٠٠) وملفات الأوزان <weight>.css (٥٠٠/٦٠٠/٧٠٠…).
    """
    out: dict[str, str] = {}
    css_files = []
    idx = os.path.join(pkg_dir, "index.css")
    if os.path.exists(idx):
        css_files.append(idx)
    for name in sorted(os.listdir(pkg_dir)):
        if re.match(r"^\d+\.css$", name):
            css_files.append(os.path.join(pkg_dir, name))
    css = ""
    for f in css_files:
        with open(f, encoding="utf-8") as fh:
            css += fh.read() + "\n"
    for key, body in BLOCK_RE.findall(css):
        m = re.match(r"^(.+?)-(arabic|latin|latin-ext|math|symbols)-(\d+)-normal$", key)
        if not m:
            continue
        pkg, subset, weight = m.groups()
        rng = re.search(r"unicode-range:\s*([^;]+);", body)
        out[f"{pkg}-{subset}-{weight}"] = rng.group(1).strip() if rng else ""
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fonts", default="assets/fonts")
    ap.add_argument("--out", default="assets/css/fonts.css")
    ap.add_argument("--sources", default="node_modules/@fontsource")
    args = ap.parse_args()

    files = sorted(f for f in os.listdir(args.fonts) if f.endswith(".woff2"))
    entries = []
    for f in files:
        m = re.match(r"^(.+?)-(arabic|latin)-(\d+)\.woff2$", f)
        if not m:
            print(f"  ! تجاهل ملفًا لا يتبع التسمية: {f}", file=sys.stderr)
            continue
        pkg, subset, weight = m.groups()
        if pkg not in FAMILY:
            print(f"  ! حزمة غير معروفة: {pkg}", file=sys.stderr)
            continue
        entries.append({"file": f, "pkg": pkg, "subset": subset, "weight": int(weight)})

    ranges_cache: dict[str, dict] = {}
    lines = [
        "/* ==========================================================================",
        "   خطوط الموقع — مُستضافة ذاتيًّا (Self-hosted)",
        "   ملف مُولَّد آليًّا عبر tools/build_fonts_css.py — لا تُحرّره يدويًّا.",
        "   كل عائلة مقسّمة إلى مجموعتَي محارف (عربية / لاتينية) بنطاقات unicode-range",
        "   الأصلية، ليعمل الرسم العربي والترقيم اللاتيني («#»، «—»، ««»») معًا.",
        "   ========================================================================== */",
        "",
    ]

    total = 0
    for pkg in ORDER:
        group = [e for e in entries if e["pkg"] == pkg]
        if not group:
            continue
        src_dir = os.path.join(args.sources, pkg)
        if not os.path.isdir(src_dir):
            print(f"  ! لا يوجد {src_dir} — سأكتب التعريفات بلا unicode-range", file=sys.stderr)
            ranges_cache[pkg] = {}
        else:
            ranges_cache[pkg] = parse_package(src_dir)
            if not ranges_cache[pkg]:
                print(f"  ! لم أجد نطاقات في {src_dir}", file=sys.stderr)

        lines.append(f"/* ---------- {COMMENTS.get(pkg, FAMILY[pkg])} ---------- */")
        for e in sorted(group, key=lambda x: (x["subset"], x["weight"])):
            rng = ranges_cache[pkg].get(f'{pkg}-{e["subset"]}-{e["weight"]}', "")
            lines.append("@font-face {")
            lines.append(f"  font-family: '{FAMILY[pkg]}';")
            lines.append("  font-style: normal;")
            lines.append(f'  font-weight: {e["weight"]};')
            lines.append("  font-display: swap;")
            lines.append(f"  src: url('../fonts/{e['file']}') format('woff2');")
            if rng:
                lines.append(f"  unicode-range: {rng};")
            lines.append("}")
            total += 1
        lines.append("")

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")
    print(f"كُتب {args.out} — {total} تعريف @font-face لـ {len({e['pkg'] for e in entries})} عائلات")


if __name__ == "__main__":
    main()
