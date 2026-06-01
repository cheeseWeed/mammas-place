"""
Sweep deck HTML files and replace dead links:
  - https://visualhandbook.zerofatalities.com/* (subdomain dead)
  - https://drive.google.com/file/d/1n8nMqhEBKn99TZmm0NSCm9LWlqEHt9Tq/view (404)

Both get redirected to the official Utah Driver Handbook PDF:
  https://dld.utah.gov/wp-content/uploads/Driver-Handbook-REV-3.2026.pdf

Five files, multiple pattern variants per file. See pass functions below.
"""

import re
import sys
from pathlib import Path

DECKS_DIR = Path(r"C:/Users/dglazier/source/Personal/mammas-place/public/drive-assets/decks")
UTAH_PDF = "https://dld.utah.gov/wp-content/uploads/Driver-Handbook-REV-3.2026.pdf"
GDRIVE_URL = "https://drive.google.com/file/d/1n8nMqhEBKn99TZmm0NSCm9LWlqEHt9Tq/view"

FILES = ["unit-1.html", "unit-2.html", "unit-3.html", "unit-4.html", "unit-5.html"]


def pass_1_standard_learn_more(text: str) -> tuple[str, int]:
    """
    Pattern: <a Drive>label</a> &nbsp;|&nbsp; <a zerofatalities>Zero Fatalities</a>
    Result:  <a UTAH_PDF>📖 label</a>
    Works inside both <p class="learn-more"> and <div class="learn-more"> containers.
    """
    pattern = re.compile(
        r'<a\s+href="' + re.escape(GDRIVE_URL) + r'"\s+target="_blank"\s+rel="noopener"\s+style="color:#581c87;">'
        r'(?P<label>[^<]+?)'
        r'</a>\s*&nbsp;\|&nbsp;\s*'
        r'<a\s+href="https://visualhandbook\.zerofatalities\.com[^"]*"\s+target="_blank"\s+rel="noopener"\s+style="color:#581c87;">'
        r'(?:[^<]+?)'  # "Zero Fatalities" link text
        r'</a>'
    )
    count = 0
    def repl(m):
        nonlocal count
        count += 1
        label = m.group("label")
        return f'<a href="{UTAH_PDF}" target="_blank" rel="noopener" style="color:#581c87;">&#128214; {label}</a>'
    return pattern.sub(repl, text), count


def pass_2_drive_only(text: str) -> tuple[str, int]:
    """
    Any remaining bare Drive URL references — redirect to Utah PDF.
    """
    count = text.count(GDRIVE_URL)
    text = text.replace(GDRIVE_URL, UTAH_PDF)
    return text, count


def pass_3_inline_zerofatalities_text_link(text: str) -> tuple[str, int]:
    """
    Pattern: <a href="https://visualhandbook.zerofatalities.com...">zerofatalities</a>
       or:   <a href="...">zerofatalities.com</a>
    These are inline text-link variants in <p class="learn-more"> where the
    link text is literally "zerofatalities" or "zerofatalities.com".
    Replace with link to Utah handbook PDF, relabel as "Utah Driver Handbook".
    """
    pattern = re.compile(
        r'<a\s+href="https://visualhandbook\.zerofatalities\.com[^"]*"(?:\s+target="_blank")?>'
        r'zerofatalities(?:\.com)?'
        r'</a>'
    )
    count = 0
    def repl(m):
        nonlocal count
        count += 1
        return f'<a href="{UTAH_PDF}" target="_blank" rel="noopener">Utah Driver Handbook</a>'
    return pattern.sub(repl, text), count


def pass_4_open_zerofatalities_cta(text: str) -> tuple[str, int]:
    """
    Pattern: <a href="...zerofatalities..." ...big purple button styling...>Open Zerofatalities →</a>
    These are the call-to-action buttons inside data-go-look slides.
    Redirect to Utah PDF, relabel "Open Utah Handbook".
    """
    pattern = re.compile(
        r'<a\s+href="https://visualhandbook\.zerofatalities\.com[^"]*"\s+target="_blank"\s+rel="noopener"\s+style="display:inline-block;\s*background:#581c87;\s*color:white;\s*text-decoration:none;\s*padding:8px 16px;\s*border-radius:6px;\s*margin:\s*0\.5em 0;\s*font-size:0\.8em;">'
        r'Open Zerofatalities\s*(?:&rarr;|&#8594;|→)'
        r'</a>'
    )
    count = 0
    def repl(m):
        nonlocal count
        count += 1
        return (
            f'<a href="{UTAH_PDF}" target="_blank" rel="noopener" '
            'style="display:inline-block; background:#581c87; color:white; text-decoration:none; '
            'padding:8px 16px; border-radius:6px; margin: 0.5em 0; font-size:0.8em;">'
            'Open Utah Handbook &rarr;</a>'
        )
    return pattern.sub(repl, text), count


def pass_5_open_zerofatalities_prose(text: str) -> tuple[str, int]:
    """
    The data-go-look slide intro <p> says: "Open Zerofatalities and look at <strong>...</strong>".
    Rephrase to "Open the Utah Handbook PDF and look at" so the activity still reads cleanly.
    """
    pattern = re.compile(r'Open Zerofatalities and look at')
    count = len(pattern.findall(text))
    text = pattern.sub('Open the Utah Handbook PDF and look at', text)
    return text, count


def pass_6_visual_concepts_tour_links(text: str) -> tuple[str, int]:
    """
    In <section data-tour="true">, each <li> has a topic-labeled zerofatalities link.
    The PDF has no per-topic anchors, so keep the descriptive label and point them all
    at the Utah PDF (kid still gets a working reference).
    Match the specific sidebar-style anchor:
      <a href="...zerofatalities..." target="_blank" rel="noopener"
         style="color: #581c87; text-decoration: none; font-weight: 600;">Label</a>
    """
    pattern = re.compile(
        r'<a\s+href="https://visualhandbook\.zerofatalities\.com[^"]*"\s+target="_blank"\s+rel="noopener"\s+style="color:\s*#581c87;\s*text-decoration:\s*none;\s*font-weight:\s*600;">'
        r'(?P<label>[^<]+?)'
        r'</a>'
    )
    count = 0
    def repl(m):
        nonlocal count
        count += 1
        label = m.group("label")
        return (
            f'<a href="{UTAH_PDF}" target="_blank" rel="noopener" '
            'style="color: #581c87; text-decoration: none; font-weight: 600;">'
            f'{label}</a>'
        )
    return pattern.sub(repl, text), count


def pass_7_tour_intro_text(text: str) -> tuple[str, int]:
    """
    Soften the tour-section intro that references Zerofatalities' Visual Driver Handbook,
    since the replacement is the plain Utah handbook PDF.
    """
    count = 0
    needle1 = "Zerofatalities&apos; Visual Driver Handbook covers what you just studied with animations, photos, and real Utah locations. Each link opens a specific topic."
    repl1 = "The official Utah Driver Handbook PDF covers what you just studied. Each link below opens the handbook."
    if needle1 in text:
        text = text.replace(needle1, repl1)
        count += 1

    needle2 = "Zerofatalities&apos; Visual Driver Handbook covers what you just studied with animations, photos, and real Utah locations. Most impairment content is text &mdash; see the index for the chapters that cover it."
    repl2 = "The official Utah Driver Handbook PDF covers what you just studied. Open the handbook below to read the chapters."
    if needle2 in text:
        text = text.replace(needle2, repl2)
        count += 1
    return text, count


PASSES = [
    ("standard_learn_more (Drive+ZF pair)", pass_1_standard_learn_more),
    ("drive_only (any remaining)", pass_2_drive_only),
    ("inline_zerofatalities_text_link", pass_3_inline_zerofatalities_text_link),
    ("open_zerofatalities_cta", pass_4_open_zerofatalities_cta),
    ("open_zerofatalities_prose", pass_5_open_zerofatalities_prose),
    ("visual_concepts_tour_links", pass_6_visual_concepts_tour_links),
    ("tour_intro_text", pass_7_tour_intro_text),
]


def process_file(path: Path) -> dict:
    original = path.read_text(encoding="utf-8")
    text = original
    counts = {}
    for name, fn in PASSES:
        text, n = fn(text)
        counts[name] = n

    # Diagnostics: count remaining zerofatalities/Drive refs (ignoring CSS rule)
    remaining_zf = text.count("zerofatalities")
    remaining_drive = text.count("1n8nMqhEBKn99TZmm0NSCm9LWlqEHt9Tq")
    new_utah = text.count("Driver-Handbook-REV-3.2026.pdf")

    if text != original:
        path.write_text(text, encoding="utf-8")
        wrote = True
    else:
        wrote = False

    return {
        "file": path.name,
        "wrote": wrote,
        "passes": counts,
        "remaining_zerofatalities": remaining_zf,
        "remaining_gdrive": remaining_drive,
        "new_utah_pdf_links": new_utah,
    }


def main():
    print(f"Deck dir: {DECKS_DIR}")
    print(f"Replacing dead refs with: {UTAH_PDF}\n")
    for name in FILES:
        result = process_file(DECKS_DIR / name)
        print(f"=== {result['file']} ===")
        print(f"  wrote: {result['wrote']}")
        for pname, n in result["passes"].items():
            print(f"    {pname}: {n}")
        print(f"  remaining 'zerofatalities' refs: {result['remaining_zerofatalities']}")
        print(f"  remaining gdrive refs: {result['remaining_gdrive']}")
        print(f"  new Utah PDF link count in file: {result['new_utah_pdf_links']}")
        print()


if __name__ == "__main__":
    main()
