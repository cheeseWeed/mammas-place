"""
Add #page=N anchors to Utah Driver Handbook PDF links in deck HTML files.

For each <a href="...Driver-Handbook-REV-3.2026.pdf"...>LABEL</a> link:
  - Find the FIRST occurrence of "p.NUMBER" or "pp.NUMBER" (case-insensitive,
    optional space after the dot) inside the link text. If found, append
    "#page=NUMBER" to the href.
  - If no page reference is in the LINK TEXT, also try the surrounding paragraph
    text within ~120 chars before the link (e.g. "Handbook p. 37 &middot; <a>...").
  - If still no page reference, leave the href unchanged (e.g. "Open Utah Handbook",
    tour topic links like "Flex lanes", "Full handbook index").

The dashboard/index.html link is NOT touched (different directory).
"""

import re
from pathlib import Path

DECKS_DIR = Path(r"C:/Users/dglazier/source/Personal/mammas-place/public/drive-assets/decks")
UTAH_PDF = "https://dld.utah.gov/wp-content/uploads/Driver-Handbook-REV-3.2026.pdf"
FILES = ["unit-1.html", "unit-2.html", "unit-3.html", "unit-4.html", "unit-5.html"]

# Match <a href="...PDF" ...>LABEL</a>  -- captures pre-href attrs, href tail (already
# anchored or not), label.
# We rebuild the href cleanly. Don't double-anchor if #page= already present.
LINK_RE = re.compile(
    r'<a\s+href="' + re.escape(UTAH_PDF) + r'(?P<frag>#page=\d+)?"(?P<attrs>[^>]*)>(?P<label>[^<]*)</a>'
)

# Page-reference patterns. First match wins.
# Matches p.17 / p. 17 / pp.17 / pp.17-19 / P.17 / "pages 61"  / "page 17". Captures the first number.
PAGE_IN_TEXT_RE = re.compile(r'\b(?:pp?\.\s*|pages?\s+)(\d{1,3})', re.IGNORECASE)


def parse_first_page(label: str) -> int | None:
    m = PAGE_IN_TEXT_RE.search(label)
    if m:
        return int(m.group(1))
    return None


def process_file(path: Path) -> dict:
    original = path.read_text(encoding="utf-8")
    text = original

    anchored = 0
    bare_left = 0
    skipped_already_anchored = 0
    samples: list[tuple[str, str]] = []  # (before, after) capped to 2

    def repl(m: re.Match) -> str:
        nonlocal anchored, bare_left, skipped_already_anchored
        already = m.group("frag")  # not None if already #page=N
        attrs = m.group("attrs")
        label = m.group("label")
        original_anchor = m.group(0)

        if already:
            skipped_already_anchored += 1
            return original_anchor  # leave as-is

        # First: try the link label itself.
        page = parse_first_page(label)

        # Second: try preceding ~140 chars in the source (catches the
        # "Handbook p. 37 &middot; <a>Utah Driver Handbook</a>" pattern).
        if page is None:
            link_start = m.start()
            window_start = max(0, link_start - 140)
            preceding = text[window_start:link_start]
            # only the chunk after the last '>' so we look at the surrounding
            # paragraph text, not back through other tags
            chunk = preceding.rsplit('>', 1)[-1]
            page = parse_first_page(chunk)

        if page is None:
            bare_left += 1
            return original_anchor

        new_anchor = f'<a href="{UTAH_PDF}#page={page}"{attrs}>{label}</a>'
        anchored += 1
        if len(samples) < 2:
            samples.append((original_anchor, new_anchor))
        return new_anchor

    new_text = LINK_RE.sub(repl, text)

    wrote = False
    if new_text != original:
        path.write_text(new_text, encoding="utf-8")
        wrote = True

    return {
        "file": path.name,
        "wrote": wrote,
        "anchored": anchored,
        "bare_left": bare_left,
        "skipped_already_anchored": skipped_already_anchored,
        "samples": samples,
    }


def main() -> None:
    print(f"Deck dir: {DECKS_DIR}")
    print(f"Target PDF: {UTAH_PDF}\n")
    total_anchored = 0
    total_bare = 0
    for name in FILES:
        r = process_file(DECKS_DIR / name)
        print(f"=== {r['file']} ===")
        print(f"  wrote: {r['wrote']}")
        print(f"  anchored: {r['anchored']}")
        print(f"  bare_left: {r['bare_left']}")
        print(f"  already_anchored: {r['skipped_already_anchored']}")
        for before, after in r["samples"]:
            print(f"  before: {before}")
            print(f"  after:  {after}")
        print()
        total_anchored += r["anchored"]
        total_bare += r["bare_left"]
    print(f"TOTAL anchored: {total_anchored}")
    print(f"TOTAL left bare: {total_bare}")


if __name__ == "__main__":
    main()
