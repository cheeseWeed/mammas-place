"""
Extract per-state silhouette geometry from the political SVG.

For each `<path id="XX">` (postal-keyed) in
public/geography/us-states-political.svg, write:

  - d:       the raw `d` attribute (same coordinate space as the political SVG)
  - bbox:    [minX, minY, width, height] computed by walking the path commands
  - center:  [centerX, centerY] = midpoint of bbox

DC is a <circle> (not a path) in the source SVG. We emit it with a
synthesized `d` (single M+a+a+z arc-pair circle) so the silhouette engine
can render it as a tray tile if it ever wants to, but the round picker
already excludes DC from the quiz pool so this is mostly insurance.

Output: public/geography/state-silhouettes.json — one entry per postal,
sorted alphabetically for stable diffs.

Usage: python extract-state-silhouettes.py
"""

import json
import re
import sys
from collections import OrderedDict
from pathlib import Path

SVG_IN = Path(r"C:/Users/dglazier/source/Personal/mammas-place/public/geography/us-states-political.svg")
JSON_OUT = Path(r"C:/Users/dglazier/source/Personal/mammas-place/public/geography/state-silhouettes.json")

# Matches the opening tag of every <path id="XX" ... d="..."> element.
# Tolerant of attribute order: we capture id and d via two named groups.
PATH_RE = re.compile(
    r'<path\b[^>]*?\bid="(?P<id>[A-Z]{2})"[^>]*?\bd="(?P<d>[^"]+)"',
    re.DOTALL,
)
# Same path tag but with d listed BEFORE id (just in case the source ever flips).
PATH_RE_ALT = re.compile(
    r'<path\b[^>]*?\bd="(?P<d>[^"]+)"[^>]*?\bid="(?P<id>[A-Z]{2})"',
    re.DOTALL,
)
# DC's circle element.
CIRCLE_RE = re.compile(
    r'<circle\b[^>]*?\bid="(?P<id>[A-Z]{2})"[^>]*?\bcx="(?P<cx>[\d.\-]+)"[^>]*?\bcy="(?P<cy>[\d.\-]+)"[^>]*?\br="(?P<r>[\d.\-]+)"'
)


def parse_path_bbox(d: str):
    """Walk the SVG path commands and compute the bounding box.

    Supports M/m L/l H/h V/v C/c S/s Q/q T/t A/a Z/z. For curves we use the
    endpoint (not the true Bezier extrema) which over-tightens the bbox by a
    pixel or two on a few curvy states — fine for snap-tolerance use.
    Coordinates come in pairs (or singletons for H/V) and commands repeat.
    """
    # Tokenize: command letters split, then floats inside each chunk.
    tokens = re.findall(r"[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?", d)

    cx, cy = 0.0, 0.0           # current point
    sx, sy = 0.0, 0.0           # subpath start (for Z)
    min_x = float("inf")
    min_y = float("inf")
    max_x = float("-inf")
    max_y = float("-inf")
    cmd = None
    i = 0

    def touch(x, y):
        nonlocal min_x, min_y, max_x, max_y
        if x < min_x: min_x = x
        if y < min_y: min_y = y
        if x > max_x: max_x = x
        if y > max_y: max_y = y

    def take_num():
        nonlocal i
        v = float(tokens[i])
        i += 1
        return v

    while i < len(tokens):
        tok = tokens[i]
        if tok.isalpha():
            cmd = tok
            i += 1
            # M with extra coordinate pairs implicitly becomes L (per SVG spec).
            # Same for m → l. We handle by leaving cmd set and letting the
            # loop re-enter the same branch; for the second iteration we swap
            # M→L / m→l.
            first_iter = True
        else:
            first_iter = False  # extra pair following an earlier command letter

        if cmd in ("M", "m"):
            x = take_num(); y = take_num()
            if cmd == "m":
                cx += x; cy += y
            else:
                cx, cy = x, y
            sx, sy = cx, cy
            touch(cx, cy)
            # Subsequent implicit pairs become L/l.
            cmd = "L" if cmd == "M" else "l"
        elif cmd in ("L", "l"):
            x = take_num(); y = take_num()
            if cmd == "l":
                cx += x; cy += y
            else:
                cx, cy = x, y
            touch(cx, cy)
        elif cmd in ("H", "h"):
            x = take_num()
            cx = cx + x if cmd == "h" else x
            touch(cx, cy)
        elif cmd in ("V", "v"):
            y = take_num()
            cy = cy + y if cmd == "v" else y
            touch(cx, cy)
        elif cmd in ("C", "c"):
            # 3 control points (6 numbers) — only endpoint matters for bbox.
            x1 = take_num(); y1 = take_num()
            x2 = take_num(); y2 = take_num()
            x  = take_num(); y  = take_num()
            if cmd == "c":
                cx += x; cy += y
            else:
                cx, cy = x, y
            touch(cx, cy)
        elif cmd in ("S", "s", "Q", "q"):
            # 2 control points (4 numbers).
            x1 = take_num(); y1 = take_num()
            x  = take_num(); y  = take_num()
            if cmd in ("s", "q"):
                cx += x; cy += y
            else:
                cx, cy = x, y
            touch(cx, cy)
        elif cmd in ("T", "t"):
            x = take_num(); y = take_num()
            if cmd == "t":
                cx += x; cy += y
            else:
                cx, cy = x, y
            touch(cx, cy)
        elif cmd in ("A", "a"):
            # rx, ry, x-axis-rot, large-arc, sweep, x, y — 7 numbers.
            take_num(); take_num(); take_num(); take_num(); take_num()
            x = take_num(); y = take_num()
            if cmd == "a":
                cx += x; cy += y
            else:
                cx, cy = x, y
            touch(cx, cy)
        elif cmd in ("Z", "z"):
            cx, cy = sx, sy
            # No new bbox contribution (we already touched sx/sy at M).
        else:
            # Unknown command — bail rather than loop forever.
            raise ValueError(f"Unsupported SVG path command: {cmd!r}")

    if min_x == float("inf"):
        raise ValueError("Empty path — no coords found")

    return (min_x, min_y, max_x - min_x, max_y - min_y)


def circle_to_path_d(cx: float, cy: float, r: float) -> str:
    """Express a circle as a tiny path so silhouette tiles can render it."""
    # Two arcs sweep the full circle. Standard SVG circle-as-path trick.
    return f"M {cx - r},{cy} a {r},{r} 0 1,0 {2 * r},0 a {r},{r} 0 1,0 {-2 * r},0 z"


def main():
    if not SVG_IN.exists():
        print(f"missing source SVG: {SVG_IN}", file=sys.stderr)
        sys.exit(1)

    raw = SVG_IN.read_text(encoding="utf-8")
    found: dict[str, dict] = {}

    # Path elements (states + DC if it were a path, which it isn't here).
    seen_paths = set()
    for rx in (PATH_RE, PATH_RE_ALT):
        for m in rx.finditer(raw):
            postal = m.group("id")
            if postal in seen_paths:
                continue
            seen_paths.add(postal)
            d = m.group("d").strip()
            try:
                bbox = parse_path_bbox(d)
            except Exception as e:
                print(f"WARN {postal}: bbox parse failed: {e}", file=sys.stderr)
                continue
            found[postal] = {
                "d": d,
                "bbox": [round(v, 2) for v in bbox],
                "center": [round(bbox[0] + bbox[2] / 2, 2), round(bbox[1] + bbox[3] / 2, 2)],
            }

    # DC circle → synthesize a path so the tray can render it uniformly.
    for m in CIRCLE_RE.finditer(raw):
        postal = m.group("id")
        if postal in found:
            continue
        cx = float(m.group("cx"))
        cy = float(m.group("cy"))
        r  = float(m.group("r"))
        d = circle_to_path_d(cx, cy, r)
        bbox = (cx - r, cy - r, 2 * r, 2 * r)
        found[postal] = {
            "d": d,
            "bbox": [round(v, 2) for v in bbox],
            "center": [round(cx, 2), round(cy, 2)],
        }

    # Alphabetical-key dict for stable diffs.
    sorted_out = OrderedDict()
    for postal in sorted(found.keys()):
        sorted_out[postal] = found[postal]

    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(
        json.dumps(sorted_out, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"wrote {JSON_OUT}")
    print(f"  postals: {len(sorted_out)}")
    print(f"  keys: {', '.join(sorted_out.keys())}")


if __name__ == "__main__":
    main()
