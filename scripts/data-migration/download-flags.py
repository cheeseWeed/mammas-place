"""
Download US state flag SVGs from Wikimedia Commons.

For each of the 50 states + DC, fetches the file-info page from
Wikimedia Commons, extracts the direct SVG upload URL, and saves
it to public/geography/flags/<postal>.svg.

Usage: python download-flags.py
"""

import os
import re
import sys
import time
import urllib.request
import urllib.error

OUT_DIR = r"C:/Users/dglazier/source/Personal/mammas-place/public/geography/flags"

# postal -> Wikimedia file name (without "File:" prefix)
STATES = {
    "AL": "Flag_of_Alabama.svg",
    "AK": "Flag_of_Alaska.svg",
    "AZ": "Flag_of_Arizona.svg",
    "AR": "Flag_of_Arkansas.svg",
    "CA": "Flag_of_California.svg",
    "CO": "Flag_of_Colorado.svg",
    "CT": "Flag_of_Connecticut.svg",
    "DE": "Flag_of_Delaware.svg",
    "DC": "Flag_of_the_District_of_Columbia.svg",
    "FL": "Flag_of_Florida.svg",
    "GA": "Flag_of_Georgia_(U.S._state).svg",
    "HI": "Flag_of_Hawaii.svg",
    "ID": "Flag_of_Idaho.svg",
    "IL": "Flag_of_Illinois.svg",
    "IN": "Flag_of_Indiana.svg",
    "IA": "Flag_of_Iowa.svg",
    "KS": "Flag_of_Kansas.svg",
    "KY": "Flag_of_Kentucky.svg",
    "LA": "Flag_of_Louisiana.svg",
    "ME": "Flag_of_Maine.svg",
    "MD": "Flag_of_Maryland.svg",
    "MA": "Flag_of_Massachusetts.svg",
    "MI": "Flag_of_Michigan.svg",
    "MN": "Flag_of_Minnesota.svg",
    "MS": "Flag_of_Mississippi.svg",
    "MO": "Flag_of_Missouri.svg",
    "MT": "Flag_of_Montana.svg",
    "NE": "Flag_of_Nebraska.svg",
    "NV": "Flag_of_Nevada.svg",
    "NH": "Flag_of_New_Hampshire.svg",
    "NJ": "Flag_of_New_Jersey.svg",
    "NM": "Flag_of_New_Mexico.svg",
    "NY": "Flag_of_New_York.svg",
    "NC": "Flag_of_North_Carolina.svg",
    "ND": "Flag_of_North_Dakota.svg",
    "OH": "Flag_of_Ohio.svg",
    "OK": "Flag_of_Oklahoma.svg",
    "OR": "Flag_of_Oregon.svg",
    "PA": "Flag_of_Pennsylvania.svg",
    "RI": "Flag_of_Rhode_Island.svg",
    "SC": "Flag_of_South_Carolina.svg",
    "SD": "Flag_of_South_Dakota.svg",
    "TN": "Flag_of_Tennessee.svg",
    "TX": "Flag_of_Texas.svg",
    "UT": "Flag_of_Utah.svg",
    "VT": "Flag_of_Vermont.svg",
    "VA": "Flag_of_Virginia.svg",
    "WA": "Flag_of_Washington.svg",
    "WV": "Flag_of_West_Virginia.svg",
    "WI": "Flag_of_Wisconsin.svg",
    "WY": "Flag_of_Wyoming.svg",
}

UA = "MammasPlaceFlagFetch/1.0 (educational; contact malvaneglecta@gmail.com)"


def http_get(url, accept=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    if accept:
        req.add_header("Accept", accept)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def resolve_direct_url(filename):
    """
    Hit the MediaWiki API on commons.wikimedia.org and ask for the
    direct file URL for the given file title. Avoids HTML scraping.
    Returns the upload.wikimedia.org URL or None.
    """
    api = (
        "https://commons.wikimedia.org/w/api.php"
        "?action=query&format=json&prop=imageinfo&iiprop=url"
        f"&titles=File:{urllib.parse.quote(filename)}"
    )
    raw = http_get(api, accept="application/json")
    import json as _json
    data = _json.loads(raw)
    pages = data.get("query", {}).get("pages", {})
    for _, page in pages.items():
        ii = page.get("imageinfo")
        if ii:
            return ii[0].get("url")
    return None


def download_flag(postal, filename):
    out_path = os.path.join(OUT_DIR, f"{postal.lower()}.svg")
    if os.path.exists(out_path) and os.path.getsize(out_path) > 500:
        return ("skip", out_path, os.path.getsize(out_path), None)
    try:
        direct = resolve_direct_url(filename)
        if not direct:
            return ("fail", out_path, 0, f"no imageinfo for File:{filename}")
        raw = http_get(direct)
        # Sanity check: must be SVG
        head = raw[:200].lstrip()
        if not (head.startswith(b"<?xml") or head.startswith(b"<svg")):
            return ("fail", out_path, len(raw), f"non-svg response from {direct}")
        with open(out_path, "wb") as f:
            f.write(raw)
        return ("ok", out_path, len(raw), direct)
    except urllib.error.HTTPError as e:
        return ("fail", out_path, 0, f"HTTP {e.code} {filename}")
    except Exception as e:
        return ("fail", out_path, 0, f"{type(e).__name__}: {e}")


def main():
    import urllib.parse  # noqa: needed by resolve_direct_url
    os.makedirs(OUT_DIR, exist_ok=True)
    results = []
    for postal, filename in STATES.items():
        status, path, size, info = download_flag(postal, filename)
        print(f"[{status:4}] {postal} {filename} -> {size} bytes  {info or ''}")
        results.append((status, postal, filename, size, info))
        # Be polite to Wikimedia
        time.sleep(0.2)

    print("\n=== Summary ===")
    ok = [r for r in results if r[0] == "ok"]
    skip = [r for r in results if r[0] == "skip"]
    fail = [r for r in results if r[0] == "fail"]
    print(f"downloaded: {len(ok)}   skipped: {len(skip)}   failed: {len(fail)}")
    if fail:
        print("FAILURES:")
        for _, postal, filename, _, info in fail:
            print(f"  {postal}  File:{filename}  -- {info}")
        sys.exit(1)


if __name__ == "__main__":
    import urllib.parse  # noqa
    main()
