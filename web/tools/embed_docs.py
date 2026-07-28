#!/usr/bin/env python3
"""
embed_docs.py - embed docs/wagon-scheme-format.md and docs/developer-guide.md
into web/js/docs.js as string constants, so the Docs tab can render them
without a fetch() call.

Why embedded rather than fetched: opening web/index.html directly via file:// (the
whole point of this prototype - no server needed) hits Chrome's CORS restriction on
fetch() reading other local files. Embedding sidesteps that entirely.

Usage (run from repo root):
    python3 web/tools/embed_docs.py
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPEC_SRC = os.path.join(ROOT, "docs", "wagon-scheme-format.md")
GUIDE_SRC = os.path.join(ROOT, "docs", "developer-guide.md")
OUT = os.path.join(ROOT, "web", "js", "docs.js")


def escape(md):
    return md.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def main():
    spec = escape(open(SPEC_SRC, encoding="utf-8").read())
    guide = escape(open(GUIDE_SRC, encoding="utf-8").read())
    js = (
        '/* Generated from docs/wagon-scheme-format.md and docs/developer-guide.md -\n'
        '   regenerate with `python3 web/tools/embed_docs.py` after editing either file. */\n'
        '"use strict";\n\n'
        f'var DOCS_MARKDOWN = `{spec}`;\n'
        f'var DOCS_GUIDE_MARKDOWN = `{guide}`;\n'
    )
    open(OUT, "w", encoding="utf-8").write(js)
    print(f"wrote {OUT} ({len(js)} bytes) from {SPEC_SRC} and {GUIDE_SRC}")


if __name__ == "__main__":
    main()
