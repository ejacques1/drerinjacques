#!/usr/bin/env python3
"""Archive a Senja CSV export and every media URL referenced by it."""

from __future__ import annotations

import csv
import hashlib
import json
import mimetypes
import shutil
import ssl
import sys
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

import certifi


def safe_name(value: str) -> str:
    value = "".join(c.lower() if c.isalnum() else "-" for c in value).strip("-")
    return "-".join(part for part in value.split("-") if part)[:60] or "unknown"


def extension(url: str, content_type: str | None) -> str:
    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if 1 < len(suffix) <= 6:
        return suffix
    guessed = mimetypes.guess_extension((content_type or "").split(";", 1)[0].strip())
    return guessed or ".bin"


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: archive_senja_export.py INPUT.csv OUTPUT_DIR")

    source = Path(sys.argv[1]).expanduser().resolve()
    output = Path(sys.argv[2]).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    (output / "media" / "videos").mkdir(parents=True, exist_ok=True)
    (output / "media" / "avatars").mkdir(parents=True, exist_ok=True)

    copied_csv = output / "senja-testimonials.csv"
    shutil.copy2(source, copied_csv)
    with source.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    (output / "senja-testimonials.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    jobs: dict[str, dict[str, object]] = {}
    fields = {
        "video_mp4_url": "videos",
        "customer_avatar": "avatars",
        "customer_company_logo": "avatars",
        "attachments": "attachments",
    }
    for index, row in enumerate(rows, 1):
        for field, folder in fields.items():
            raw = (row.get(field) or "").strip()
            if not raw:
                continue
            for url in [item.strip() for item in raw.split(",") if item.strip()]:
                if not url.startswith(("http://", "https://")):
                    continue
                job = jobs.setdefault(url, {"field": field, "folder": folder, "rows": []})
                job["rows"].append(index)

    manifest = []
    failures = []
    for number, (url, info) in enumerate(jobs.items(), 1):
        digest = hashlib.sha256(url.encode()).hexdigest()[:12]
        first_row = rows[info["rows"][0] - 1]
        person = safe_name(first_row.get("customer_name") or "customer")
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            tls = ssl.create_default_context(cafile=certifi.where())
            with urllib.request.urlopen(request, timeout=90, context=tls) as response:
                data = response.read()
                ext = extension(url, response.headers.get("content-type"))
                target_dir = output / "media" / str(info["folder"])
                target_dir.mkdir(parents=True, exist_ok=True)
                target = target_dir / f"{person}-{digest}{ext}"
                target.write_bytes(data)
            record = {
                "source_url": url,
                "local_file": str(target.relative_to(output)),
                "sha256": hashlib.sha256(data).hexdigest(),
                "bytes": len(data),
                "csv_field": info["field"],
                "csv_rows": info["rows"],
            }
            manifest.append(record)
            print(f"[{number}/{len(jobs)}] saved {record['local_file']} ({len(data)} bytes)", flush=True)
        except Exception as exc:  # keep the rest of the archive moving
            failures.append({"source_url": url, "error": str(exc), **info})
            print(f"[{number}/{len(jobs)}] FAILED {type(exc).__name__}", flush=True)

    (output / "media-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output / "download-failures.json").write_text(
        json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    summary = {
        "testimonial_rows": len(rows),
        "types": Counter(row.get("type", "") for row in rows),
        "ratings": Counter(row.get("rating", "") for row in rows),
        "unique_media_urls": len(jobs),
        "media_downloaded": len(manifest),
        "media_failures": len(failures),
        "total_media_bytes": sum(item["bytes"] for item in manifest),
    }
    (output / "archive-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, default=dict, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
