#!/usr/bin/env python3
"""Snapshot the server-rendered PauperPilot meta table for static hosting."""
from html.parser import HTMLParser
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
import json
import re

ROOT = Path(__file__).resolve().parents[1]
RANGES = {"30d": "", "7d": "7d/", "90d": "90d/", "bnr": "bnr/", "set": "set/"}


class MetaTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.current = None
        self.cell = None
        self.in_link = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "tr" and attrs.get("data-meta-row"):
            price = attrs.get("data-price")
            self.current = {"id": attrs["data-meta-row"], "share": float(attrs.get("data-share", 0)), "price": float(price) if price else None, "href": None, "name": ""}
        elif self.current is not None:
            if tag == "td":
                self.cell = ""
            elif tag == "a" and re.fullmatch(r"/(?:7d/|90d/|bnr/|set/)?archetypes/[^/]+/", attrs.get("href", "")):
                self.current["href"] = attrs["href"]
                self.in_link = True

    def handle_data(self, data):
        if self.current is None:
            return
        if self.cell is not None:
            self.cell += data
        if self.in_link:
            self.current["name"] += data

    def handle_endtag(self, tag):
        if self.current is None:
            return
        if tag == "a":
            self.in_link = False
        elif tag == "td" and self.cell is not None:
            text = " ".join(self.cell.split())
            if re.search(r"(?:€|≥)", text):
                match = re.search(r"(?:€|≥\s*€)\s*([\d,.]+)", text)
                if match:
                    self.current["price"] = float(match.group(1).replace(",", ""))
            self.cell = None
        elif tag == "tr":
            if self.current.get("href") and self.current.get("name"):
                self.current["name"] = " ".join(self.current["name"].split())
                self.rows.append(self.current)
            self.current = None


def fetch(path):
    request = Request("https://pauperpilot.com/" + path, headers={"User-Agent": "PauperPilotMobileMeta/1.0 (+GitHub Pages snapshot)"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def main():
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for key, route in RANGES.items():
        parser = MetaTable()
        parser.feed(fetch(route))
        if len(parser.rows) < 10:
            raise RuntimeError(f"Only found {len(parser.rows)} archetypes for {key}; refusing to publish bad data")
        payload = {"source": "https://pauperpilot.com/" + route, "label": key, "updated": now, "archetypes": parser.rows}
        destination = ROOT / "data" / f"{key}.json"
        destination.parent.mkdir(exist_ok=True)
        destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {len(parser.rows)} archetypes to {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
