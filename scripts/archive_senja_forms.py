#!/usr/bin/env python3
"""Download public Senja form HTML so copy and embedded configuration survive."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import requests


def safe_name(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:70] or "form"


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: archive_senja_forms.py FORMS.json OUTPUT_DIR")
    forms = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    output = Path(sys.argv[2]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    manifest = []
    failures = []
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0"
    for index, form in enumerate(forms, 1):
        url = f"https://senja.io/p/drerin-jacques/r/{form['slug']}"
        try:
            response = session.get(url, timeout=60)
            response.raise_for_status()
            target = output / f"{index:02d}-{safe_name(form['name'])}-{form['slug']}.html"
            target.write_bytes(response.content)
            manifest.append({**form, "url": url, "file": target.name, "bytes": len(response.content)})
            print(f"[{index}/{len(forms)}] saved {target.name}", flush=True)
        except Exception as exc:
            failures.append({**form, "url": url, "error": str(exc)})
            print(f"[{index}/{len(forms)}] FAILED", flush=True)
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (output / "failures.json").write_text(json.dumps(failures, indent=2), encoding="utf-8")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
