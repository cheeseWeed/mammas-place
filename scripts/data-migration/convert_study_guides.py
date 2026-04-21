"""
Convert markdown study guides to styled HTML pages.
Also generates product entries for products.json.
"""

import os
import re
import json
import sys
from pathlib import Path

SOURCE_DIR = Path(r"C:\Users\dglazier\source\Personal\BedtimeExplorers\faith-builders\topicStudy")
OUTPUT_DIR = Path(r"C:\Users\dglazier\source\Personal\mammas-place\public\guides")
PRODUCTS_FILE = Path(r"C:\Users\dglazier\source\Personal\mammas-place\data\products.json")

TOPIC_META = {
    "faith": {"emoji": "🕊️", "display": "Faith", "order": 1},
    "repentance": {"emoji": "🔄", "display": "Repentance", "order": 2},
    "atonement": {"emoji": "✝️", "display": "The Atonement", "order": 3},
    "charity": {"emoji": "❤️", "display": "Charity", "order": 4},
    "service": {"emoji": "🤝", "display": "Service", "order": 5},
    "easter": {"emoji": "🌅", "display": "Easter", "order": 6},
    "patriarchalBlessings": {"emoji": "📜", "display": "Patriarchal Blessings", "order": 7},
}

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

    * {{ margin: 0; padding: 0; box-sizing: border-box; }}

    body {{
      font-family: 'Nunito', sans-serif;
      background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #ede9fe 100%);
      color: #1e1b4b;
      line-height: 1.8;
      padding: 0;
    }}

    .header {{
      background: linear-gradient(135deg, #7c3aed, #6d28d9, #5b21b6);
      color: white;
      padding: 2rem 1.5rem;
      text-align: center;
      position: sticky;
      top: 0;
      z-index: 10;
      box-shadow: 0 4px 20px rgba(109, 40, 217, 0.3);
    }}

    .header h1 {{
      font-size: 1.6rem;
      font-weight: 900;
      margin-bottom: 0.25rem;
    }}

    .header .topic-badge {{
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 700;
    }}

    .content {{
      max-width: 720px;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }}

    h2 {{
      font-size: 1.4rem;
      font-weight: 900;
      color: #5b21b6;
      margin-top: 2.5rem;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 3px solid #ddd6fe;
    }}

    h3 {{
      font-size: 1.15rem;
      font-weight: 800;
      color: #6d28d9;
      margin-top: 1.75rem;
      margin-bottom: 0.5rem;
    }}

    p {{
      margin-bottom: 1rem;
      font-size: 1.05rem;
    }}

    blockquote {{
      background: linear-gradient(135deg, #ede9fe, #ddd6fe);
      border-left: 4px solid #7c3aed;
      padding: 1.25rem 1.5rem;
      margin: 1.5rem 0;
      border-radius: 0 12px 12px 0;
      font-style: italic;
      font-size: 1.1rem;
      color: #3b0764;
    }}

    blockquote p {{
      margin-bottom: 0.25rem;
    }}

    blockquote p:last-child {{
      margin-bottom: 0;
    }}

    a {{
      color: #7c3aed;
      font-weight: 700;
      text-decoration: none;
      border-bottom: 2px solid #ddd6fe;
      transition: all 0.2s;
    }}

    a:hover {{
      color: #5b21b6;
      border-bottom-color: #7c3aed;
    }}

    ul, ol {{
      margin: 1rem 0 1.5rem 1.5rem;
    }}

    li {{
      margin-bottom: 0.5rem;
      font-size: 1.05rem;
    }}

    strong {{
      color: #5b21b6;
      font-weight: 800;
    }}

    em {{
      color: #6d28d9;
    }}

    hr {{
      border: none;
      height: 2px;
      background: linear-gradient(90deg, transparent, #c4b5fd, transparent);
      margin: 2.5rem 0;
    }}

    .read-box {{
      background: white;
      border: 2px solid #ddd6fe;
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      margin: 1.25rem 0;
      box-shadow: 0 2px 8px rgba(109, 40, 217, 0.08);
    }}

    .read-box strong {{
      color: #7c3aed;
    }}

    .discuss-box {{
      background: linear-gradient(135deg, #fefce8, #fef9c3);
      border: 2px solid #fde68a;
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      margin: 1.25rem 0;
    }}

    .discuss-box ul {{
      margin-left: 1rem;
    }}

    .bookmark {{
      background: linear-gradient(135deg, #ecfdf5, #d1fae5);
      border: 2px solid #6ee7b7;
      border-radius: 16px;
      padding: 1rem 1.5rem;
      margin: 1.5rem 0;
      text-align: center;
      font-weight: 700;
      color: #065f46;
    }}

    .nav-footer {{
      background: white;
      border-radius: 16px;
      padding: 1.25rem;
      margin-top: 3rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(109, 40, 217, 0.08);
      border: 2px solid #ede9fe;
    }}

    .nav-footer a {{
      background: #7c3aed;
      color: white;
      padding: 0.5rem 1.25rem;
      border-radius: 999px;
      font-weight: 800;
      border: none;
      text-decoration: none;
      font-size: 0.9rem;
    }}

    .nav-footer a:hover {{
      background: #5b21b6;
    }}

    .back-link {{
      display: inline-block;
      margin-top: 1rem;
      font-weight: 800;
      color: white;
      opacity: 0.9;
    }}

    @media (max-width: 640px) {{
      .header h1 {{ font-size: 1.3rem; }}
      .content {{ padding: 1.5rem 1rem 3rem; }}
      h2 {{ font-size: 1.2rem; }}
      blockquote {{ padding: 1rem; }}
    }}
  </style>
</head>
<body>
  <div class="header">
    <span class="topic-badge">{topic_emoji} {topic_display}</span>
    <h1>{title}</h1>
    <a href="/shop?category=study-guides" class="back-link">← Back to Study Guides</a>
  </div>
  <div class="content">
    {body_html}
  </div>
</body>
</html>"""


def md_to_html(md_text: str) -> str:
    """Convert markdown to HTML with study-guide-aware formatting."""
    lines = md_text.split('\n')
    html_parts = []
    in_blockquote = False
    in_list = False
    in_ordered_list = False
    list_items = []

    def flush_list():
        nonlocal in_list, in_ordered_list, list_items
        if list_items:
            tag = 'ol' if in_ordered_list else 'ul'
            items_html = ''.join(f'<li>{item}</li>' for item in list_items)
            html_parts.append(f'<{tag}>{items_html}</{tag}>')
            list_items = []
        in_list = False
        in_ordered_list = False

    def inline_fmt(text: str) -> str:
        # Bold
        text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
        # Italic
        text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
        # Inline code
        text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
        # Links
        text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2" target="_blank">\1</a>', text)
        return text

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()

        # Skip the title (first # line) — we use it in the header
        if i == 0 and line.startswith('# '):
            i += 1
            continue

        # Bookmark section
        if '→ BOOKMARK' in line or 'BOOKMARK' in line.upper() and 'move this' in lines[i+1].lower() if i+1 < len(lines) else False:
            # Skip bookmark lines
            while i < len(lines) and lines[i].strip() not in ('---', ''):
                i += 1
            i += 1
            continue

        # Horizontal rule
        if line.strip() == '---':
            flush_list()
            if in_blockquote:
                html_parts.append('</blockquote>')
                in_blockquote = False
            html_parts.append('<hr>')
            i += 1
            continue

        # Headers
        if line.startswith('## '):
            flush_list()
            if in_blockquote:
                html_parts.append('</blockquote>')
                in_blockquote = False
            html_parts.append(f'<h2>{inline_fmt(line[3:])}</h2>')
            i += 1
            continue

        if line.startswith('### '):
            flush_list()
            if in_blockquote:
                html_parts.append('</blockquote>')
                in_blockquote = False
            html_parts.append(f'<h3>{inline_fmt(line[4:])}</h3>')
            i += 1
            continue

        # Blockquote
        if line.startswith('> '):
            flush_list()
            if not in_blockquote:
                html_parts.append('<blockquote>')
                in_blockquote = True
            html_parts.append(f'<p>{inline_fmt(line[2:])}</p>')
            i += 1
            continue
        elif in_blockquote and line.strip() == '':
            html_parts.append('</blockquote>')
            in_blockquote = False
            i += 1
            continue

        # Unordered list
        if line.startswith('- '):
            if not in_list:
                in_list = True
                in_ordered_list = False
            list_items.append(inline_fmt(line[2:]))
            i += 1
            continue

        # Ordered list
        m = re.match(r'^(\d+)\.\s+(.+)', line)
        if m:
            if not in_list:
                in_list = True
                in_ordered_list = True
            list_items.append(inline_fmt(m.group(2)))
            i += 1
            continue

        # End of list
        if in_list and line.strip() == '':
            flush_list()
            i += 1
            continue

        # Empty line
        if line.strip() == '':
            if in_blockquote:
                html_parts.append('</blockquote>')
                in_blockquote = False
            i += 1
            continue

        # Regular paragraph
        flush_list()
        if in_blockquote:
            html_parts.append('</blockquote>')
            in_blockquote = False
        html_parts.append(f'<p>{inline_fmt(line)}</p>')
        i += 1

    flush_list()
    if in_blockquote:
        html_parts.append('</blockquote>')

    return '\n    '.join(html_parts)


def extract_title(md_text: str) -> str:
    """Extract the title from the first # heading."""
    for line in md_text.split('\n'):
        if line.startswith('# '):
            # Remove the prefix code like "FATH-01 — "
            title = line[2:].strip()
            if ' — ' in title:
                title = title.split(' — ', 1)[1]
            elif ' - ' in title:
                title = title.split(' - ', 1)[1]
            return title
    return "Study Guide"


def extract_short_desc(md_text: str) -> str:
    """Extract a short description from the first meaningful paragraph."""
    lines = md_text.split('\n')
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#') or line.startswith('>') or line.startswith('---') or 'BOOKMARK' in line.upper():
            continue
        # Strip markdown formatting
        desc = re.sub(r'\*\*(.+?)\*\*', r'\1', line)
        desc = re.sub(r'\*(.+?)\*', r'\1', desc)
        desc = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', desc)
        if len(desc) > 20:
            return desc[:120].rsplit(' ', 1)[0] + ('...' if len(desc) > 120 else '')
    return "A guided scripture study on this topic"


def process_guides():
    """Process all study guides and generate HTML + product entries."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    new_products = []
    guide_count = 0

    for topic_dir in sorted(SOURCE_DIR.iterdir()):
        if not topic_dir.is_dir():
            continue

        topic_name = topic_dir.name
        meta = TOPIC_META.get(topic_name, {"emoji": "📖", "display": topic_name.title(), "order": 99})

        # Create topic output dir
        topic_out = OUTPUT_DIR / topic_name
        topic_out.mkdir(parents=True, exist_ok=True)

        # Process each guide file
        guide_files = sorted([f for f in topic_dir.glob("*.md") if not f.name.startswith('_')])

        for gf in guide_files:
            md_text = gf.read_text(encoding='utf-8')
            title = extract_title(md_text)
            body_html = md_to_html(md_text)

            # Generate HTML file
            html_content = HTML_TEMPLATE.format(
                title=title,
                topic_emoji=meta["emoji"],
                topic_display=meta["display"],
                body_html=body_html,
            )

            html_filename = gf.stem + '.html'
            (topic_out / html_filename).write_text(html_content, encoding='utf-8')

            # Parse episode number from filename
            m = re.match(r'[A-Z]+-(\d+)', gf.stem)
            ep_num = int(m.group(1)) if m else guide_count + 1

            # Generate product ID
            prefix_map = {
                "faith": "fath",
                "repentance": "rpnt",
                "atonement": "atnmt",
                "charity": "chrt",
                "service": "srvs",
                "easter": "estr",
                "patriarchalBlessings": "ptbl",
            }
            prefix = prefix_map.get(topic_name, topic_name[:4].lower())
            product_id = f"sg-{prefix}-{ep_num:02d}"

            short_desc = extract_short_desc(md_text)

            product = {
                "id": product_id,
                "name": f"{meta['display']}: {title}",
                "price": 0.0,
                "originalPrice": None,
                "discount": 0,
                "description": short_desc,
                "shortDescription": f"Study guide on {meta['display'].lower()}",
                "category": "study-guides",
                "subcategory": topic_name,
                "tags": ["study guide", topic_name, "scripture", "faith", "educational"],
                "imageUrl": "/images/audio-003.png",
                "images": ["/images/audio-003.svg"],
                "inStock": True,
                "stockCount": 999,
                "rating": 4.9,
                "reviewCount": 3,
                "isSale": False,
                "isFeatured": False,
                "isComingSoon": False,
                "availableOnWebsite": True,
                "isAudiobook": False,
                "isStudyGuide": True,
                "studyGuideUrl": f"/guides/{topic_name}/{html_filename}",
                "sku": f"SG-{prefix.upper()}-{ep_num:03d}",
                "createdAt": "2026-04-09T00:00:00Z",
                "downloadUrl": f"/guides/{topic_name}/{html_filename}",
                "series": meta["display"],
                "episode": ep_num,
            }
            new_products.append(product)
            guide_count += 1

    print(f"Generated {guide_count} HTML study guides")

    # Update products.json
    with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
        products = json.load(f)

    # Remove any existing study guide products
    products = [p for p in products if p.get('category') != 'study-guides']

    # Find insertion point (before classic cars)
    insert_idx = len(products)
    for i, p in enumerate(products):
        if p['id'] == 'classic-car-001':
            insert_idx = i
            break

    # Insert new products
    for j, sp in enumerate(new_products):
        products.insert(insert_idx + j, sp)

    with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=2, ensure_ascii=False)

    print(f"Added {len(new_products)} study guide products to products.json")


if __name__ == '__main__':
    process_guides()
