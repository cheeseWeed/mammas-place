"""
Download SVG flags for all 195 UN-recognized countries (193 members + 2 observers:
Vatican City and Palestine) from Wikimedia Commons.

For each country, this script hits the MediaWiki API at commons.wikimedia.org to
resolve the direct upload.wikimedia.org URL for `File:Flag_of_<Country>.svg`, then
downloads the SVG and saves it to
public/geography/world/flags/<iso2-lowercase>.svg.

Country list is read from data/countries.json if it exists and is complete;
otherwise falls back to the hardcoded list below.

Usage: python download-country-flags.py
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

PROJECT_ROOT = r"C:/Users/dglazier/source/Personal/mammas-place"
OUT_DIR = os.path.join(PROJECT_ROOT, "public/geography/world/flags")
COUNTRIES_JSON = os.path.join(PROJECT_ROOT, "data/countries.json")

UA = "MammasPlaceFlagFetch/1.0 (educational; contact malvaneglecta@gmail.com)"

# ----------------------------------------------------------------------
# Hardcoded fallback list: iso2 -> Wikimedia filename (no "File:" prefix).
# 193 UN member states + Vatican City + Palestine (2 observers) = 195.
# ----------------------------------------------------------------------
COUNTRIES = {
    "AF": "Flag_of_Afghanistan.svg",
    "AL": "Flag_of_Albania.svg",
    "DZ": "Flag_of_Algeria.svg",
    "AD": "Flag_of_Andorra.svg",
    "AO": "Flag_of_Angola.svg",
    "AG": "Flag_of_Antigua_and_Barbuda.svg",
    "AR": "Flag_of_Argentina.svg",
    "AM": "Flag_of_Armenia.svg",
    "AU": "Flag_of_Australia.svg",
    "AT": "Flag_of_Austria.svg",
    "AZ": "Flag_of_Azerbaijan.svg",
    "BS": "Flag_of_the_Bahamas.svg",
    "BH": "Flag_of_Bahrain.svg",
    "BD": "Flag_of_Bangladesh.svg",
    "BB": "Flag_of_Barbados.svg",
    "BY": "Flag_of_Belarus.svg",
    "BE": "Flag_of_Belgium.svg",
    "BZ": "Flag_of_Belize.svg",
    "BJ": "Flag_of_Benin.svg",
    "BT": "Flag_of_Bhutan.svg",
    "BO": "Flag_of_Bolivia.svg",
    "BA": "Flag_of_Bosnia_and_Herzegovina.svg",
    "BW": "Flag_of_Botswana.svg",
    "BR": "Flag_of_Brazil.svg",
    "BN": "Flag_of_Brunei.svg",
    "BG": "Flag_of_Bulgaria.svg",
    "BF": "Flag_of_Burkina_Faso.svg",
    "BI": "Flag_of_Burundi.svg",
    "CV": "Flag_of_Cape_Verde.svg",
    "KH": "Flag_of_Cambodia.svg",
    "CM": "Flag_of_Cameroon.svg",
    "CA": "Flag_of_Canada.svg",
    "CF": "Flag_of_the_Central_African_Republic.svg",
    "TD": "Flag_of_Chad.svg",
    "CL": "Flag_of_Chile.svg",
    "CN": "Flag_of_the_People's_Republic_of_China.svg",
    "CO": "Flag_of_Colombia.svg",
    "KM": "Flag_of_the_Comoros.svg",
    "CG": "Flag_of_the_Republic_of_the_Congo.svg",
    "CD": "Flag_of_the_Democratic_Republic_of_the_Congo.svg",
    "CR": "Flag_of_Costa_Rica.svg",
    "CI": "Flag_of_Côte_d'Ivoire.svg",
    "HR": "Flag_of_Croatia.svg",
    "CU": "Flag_of_Cuba.svg",
    "CY": "Flag_of_Cyprus.svg",
    "CZ": "Flag_of_the_Czech_Republic.svg",
    "DK": "Flag_of_Denmark.svg",
    "DJ": "Flag_of_Djibouti.svg",
    "DM": "Flag_of_Dominica.svg",
    "DO": "Flag_of_the_Dominican_Republic.svg",
    "EC": "Flag_of_Ecuador.svg",
    "EG": "Flag_of_Egypt.svg",
    "SV": "Flag_of_El_Salvador.svg",
    "GQ": "Flag_of_Equatorial_Guinea.svg",
    "ER": "Flag_of_Eritrea.svg",
    "EE": "Flag_of_Estonia.svg",
    "SZ": "Flag_of_Eswatini.svg",
    "ET": "Flag_of_Ethiopia.svg",
    "FJ": "Flag_of_Fiji.svg",
    "FI": "Flag_of_Finland.svg",
    "FR": "Flag_of_France.svg",
    "GA": "Flag_of_Gabon.svg",
    "GM": "Flag_of_The_Gambia.svg",
    "GE": "Flag_of_Georgia.svg",
    "DE": "Flag_of_Germany.svg",
    "GH": "Flag_of_Ghana.svg",
    "GR": "Flag_of_Greece.svg",
    "GD": "Flag_of_Grenada.svg",
    "GT": "Flag_of_Guatemala.svg",
    "GN": "Flag_of_Guinea.svg",
    "GW": "Flag_of_Guinea-Bissau.svg",
    "GY": "Flag_of_Guyana.svg",
    "HT": "Flag_of_Haiti.svg",
    "HN": "Flag_of_Honduras.svg",
    "HU": "Flag_of_Hungary.svg",
    "IS": "Flag_of_Iceland.svg",
    "IN": "Flag_of_India.svg",
    "ID": "Flag_of_Indonesia.svg",
    "IR": "Flag_of_Iran.svg",
    "IQ": "Flag_of_Iraq.svg",
    "IE": "Flag_of_Ireland.svg",
    "IL": "Flag_of_Israel.svg",
    "IT": "Flag_of_Italy.svg",
    "JM": "Flag_of_Jamaica.svg",
    "JP": "Flag_of_Japan.svg",
    "JO": "Flag_of_Jordan.svg",
    "KZ": "Flag_of_Kazakhstan.svg",
    "KE": "Flag_of_Kenya.svg",
    "KI": "Flag_of_Kiribati.svg",
    "KP": "Flag_of_North_Korea.svg",
    "KR": "Flag_of_South_Korea.svg",
    "KW": "Flag_of_Kuwait.svg",
    "KG": "Flag_of_Kyrgyzstan.svg",
    "LA": "Flag_of_Laos.svg",
    "LV": "Flag_of_Latvia.svg",
    "LB": "Flag_of_Lebanon.svg",
    "LS": "Flag_of_Lesotho.svg",
    "LR": "Flag_of_Liberia.svg",
    "LY": "Flag_of_Libya.svg",
    "LI": "Flag_of_Liechtenstein.svg",
    "LT": "Flag_of_Lithuania.svg",
    "LU": "Flag_of_Luxembourg.svg",
    "MG": "Flag_of_Madagascar.svg",
    "MW": "Flag_of_Malawi.svg",
    "MY": "Flag_of_Malaysia.svg",
    "MV": "Flag_of_Maldives.svg",
    "ML": "Flag_of_Mali.svg",
    "MT": "Flag_of_Malta.svg",
    "MH": "Flag_of_the_Marshall_Islands.svg",
    "MR": "Flag_of_Mauritania.svg",
    "MU": "Flag_of_Mauritius.svg",
    "MX": "Flag_of_Mexico.svg",
    "FM": "Flag_of_the_Federated_States_of_Micronesia.svg",
    "MD": "Flag_of_Moldova.svg",
    "MC": "Flag_of_Monaco.svg",
    "MN": "Flag_of_Mongolia.svg",
    "ME": "Flag_of_Montenegro.svg",
    "MA": "Flag_of_Morocco.svg",
    "MZ": "Flag_of_Mozambique.svg",
    "MM": "Flag_of_Myanmar.svg",
    "NA": "Flag_of_Namibia.svg",
    "NR": "Flag_of_Nauru.svg",
    "NP": "Flag_of_Nepal.svg",
    "NL": "Flag_of_the_Netherlands.svg",
    "NZ": "Flag_of_New_Zealand.svg",
    "NI": "Flag_of_Nicaragua.svg",
    "NE": "Flag_of_Niger.svg",
    "NG": "Flag_of_Nigeria.svg",
    "MK": "Flag_of_North_Macedonia.svg",
    "NO": "Flag_of_Norway.svg",
    "OM": "Flag_of_Oman.svg",
    "PK": "Flag_of_Pakistan.svg",
    "PW": "Flag_of_Palau.svg",
    "PS": "Flag_of_Palestine.svg",
    "PA": "Flag_of_Panama.svg",
    "PG": "Flag_of_Papua_New_Guinea.svg",
    "PY": "Flag_of_Paraguay.svg",
    "PE": "Flag_of_Peru.svg",
    "PH": "Flag_of_the_Philippines.svg",
    "PL": "Flag_of_Poland.svg",
    "PT": "Flag_of_Portugal.svg",
    "QA": "Flag_of_Qatar.svg",
    "RO": "Flag_of_Romania.svg",
    "RU": "Flag_of_Russia.svg",
    "RW": "Flag_of_Rwanda.svg",
    "KN": "Flag_of_Saint_Kitts_and_Nevis.svg",
    "LC": "Flag_of_Saint_Lucia.svg",
    "VC": "Flag_of_Saint_Vincent_and_the_Grenadines.svg",
    "WS": "Flag_of_Samoa.svg",
    "SM": "Flag_of_San_Marino.svg",
    "ST": "Flag_of_São_Tomé_and_Príncipe.svg",
    "SA": "Flag_of_Saudi_Arabia.svg",
    "SN": "Flag_of_Senegal.svg",
    "RS": "Flag_of_Serbia.svg",
    "SC": "Flag_of_Seychelles.svg",
    "SL": "Flag_of_Sierra_Leone.svg",
    "SG": "Flag_of_Singapore.svg",
    "SK": "Flag_of_Slovakia.svg",
    "SI": "Flag_of_Slovenia.svg",
    "SB": "Flag_of_the_Solomon_Islands.svg",
    "SO": "Flag_of_Somalia.svg",
    "ZA": "Flag_of_South_Africa.svg",
    "SS": "Flag_of_South_Sudan.svg",
    "ES": "Flag_of_Spain.svg",
    "LK": "Flag_of_Sri_Lanka.svg",
    "SD": "Flag_of_Sudan.svg",
    "SR": "Flag_of_Suriname.svg",
    "SE": "Flag_of_Sweden.svg",
    "CH": "Flag_of_Switzerland.svg",
    "SY": "Flag_of_Syria.svg",
    "TJ": "Flag_of_Tajikistan.svg",
    "TZ": "Flag_of_Tanzania.svg",
    "TH": "Flag_of_Thailand.svg",
    "TL": "Flag_of_East_Timor.svg",
    "TG": "Flag_of_Togo.svg",
    "TO": "Flag_of_Tonga.svg",
    "TT": "Flag_of_Trinidad_and_Tobago.svg",
    "TN": "Flag_of_Tunisia.svg",
    "TR": "Flag_of_Turkey.svg",
    "TM": "Flag_of_Turkmenistan.svg",
    "TV": "Flag_of_Tuvalu.svg",
    "UG": "Flag_of_Uganda.svg",
    "UA": "Flag_of_Ukraine.svg",
    "AE": "Flag_of_the_United_Arab_Emirates.svg",
    "GB": "Flag_of_the_United_Kingdom.svg",
    "US": "Flag_of_the_United_States.svg",
    "UY": "Flag_of_Uruguay.svg",
    "UZ": "Flag_of_Uzbekistan.svg",
    "VU": "Flag_of_Vanuatu.svg",
    "VA": "Flag_of_Vatican_City.svg",
    "VE": "Flag_of_Venezuela.svg",
    "VN": "Flag_of_Vietnam.svg",
    "YE": "Flag_of_Yemen.svg",
    "ZM": "Flag_of_Zambia.svg",
    "ZW": "Flag_of_Zimbabwe.svg",
}


# ----------------------------------------------------------------------
# If a country's filename pattern is unusual, list overrides here.
# Tried in order; first successful API resolve wins.
# ----------------------------------------------------------------------
ALTERNATE_FILENAMES = {
    # Country may use various common alternative names on Wikimedia
    "BN": ["Flag_of_Brunei.svg", "Flag_of_Brunei_Darussalam.svg"],
    "GE": ["Flag_of_Georgia.svg", "Flag_of_Georgia_(country).svg"],
    "TL": ["Flag_of_East_Timor.svg", "Flag_of_Timor-Leste.svg"],
    "MK": ["Flag_of_North_Macedonia.svg", "Flag_of_Macedonia.svg"],
    "SZ": ["Flag_of_Eswatini.svg", "Flag_of_Swaziland.svg"],
    "CG": [
        "Flag_of_the_Republic_of_the_Congo.svg",
        "Flag_of_the_Republic_of_Congo.svg",
        "Flag_of_Congo-Brazzaville.svg",
    ],
}


def http_get(url, accept=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    if accept:
        req.add_header("Accept", accept)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def resolve_direct_url(filename):
    """
    Resolve `File:<filename>` to its direct upload.wikimedia.org URL via the
    MediaWiki API. Returns the URL or None if the page is missing.
    """
    api = (
        "https://commons.wikimedia.org/w/api.php"
        "?action=query&format=json&prop=imageinfo&iiprop=url"
        f"&titles=File:{urllib.parse.quote(filename)}"
    )
    raw = http_get(api, accept="application/json")
    data = json.loads(raw)
    pages = data.get("query", {}).get("pages", {})
    for _, page in pages.items():
        if "missing" in page:
            return None
        ii = page.get("imageinfo")
        if ii:
            return ii[0].get("url")
    return None


def candidate_filenames(iso2, primary):
    """Return list of filenames to try in order: overrides first, then primary."""
    overrides = ALTERNATE_FILENAMES.get(iso2, [])
    if overrides:
        # If override list contains primary already, don't dup it
        seen = []
        for f in overrides:
            if f not in seen:
                seen.append(f)
        if primary not in seen:
            seen.append(primary)
        return seen
    return [primary]


def download_flag(iso2, primary_filename):
    out_path = os.path.join(OUT_DIR, f"{iso2.lower()}.svg")
    if os.path.exists(out_path) and os.path.getsize(out_path) > 500:
        return ("skip", out_path, os.path.getsize(out_path), primary_filename, None)
    last_err = None
    for filename in candidate_filenames(iso2, primary_filename):
        try:
            direct = resolve_direct_url(filename)
            if not direct:
                last_err = f"no imageinfo for File:{filename}"
                continue
            raw = http_get(direct)
            # Strip optional UTF-8 BOM before sniffing
            head = raw[:200]
            if head.startswith(b"\xef\xbb\xbf"):
                head = head[3:]
            head = head.lstrip()
            if not (head.startswith(b"<?xml") or head.startswith(b"<svg")):
                last_err = f"non-svg response from {direct}"
                continue
            with open(out_path, "wb") as f:
                f.write(raw)
            return ("ok", out_path, len(raw), filename, direct)
        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code} {filename}"
        except Exception as e:
            last_err = f"{type(e).__name__}: {e} ({filename})"
    return ("fail", out_path, 0, primary_filename, last_err)


def load_country_overrides_from_json():
    """
    If data/countries.json exists with the expected shape, return a dict
    iso2 -> filename to merge with the hardcoded list. Returns {} on any
    issue. We do not let JSON shape problems block the download.
    """
    if not os.path.exists(COUNTRIES_JSON):
        return {}
    try:
        with open(COUNTRIES_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[warn] could not read {COUNTRIES_JSON}: {e}", file=sys.stderr)
        return {}
    # Heuristics for likely shapes:
    #   [{ "iso2": "FR", "name": "France", "flagFilename": "..." }, ...]
    #   { "FR": { "name": "France", "flagFilename": "..." }, ... }
    overrides = {}
    if isinstance(data, list):
        for entry in data:
            if not isinstance(entry, dict):
                continue
            iso = entry.get("iso2") or entry.get("code") or entry.get("alpha2")
            fname = entry.get("flagFilename") or entry.get("wikimediaFlag")
            if iso and fname:
                overrides[iso.upper()] = fname
    elif isinstance(data, dict):
        for iso, entry in data.items():
            if isinstance(entry, dict):
                fname = entry.get("flagFilename") or entry.get("wikimediaFlag")
                if fname:
                    overrides[iso.upper()] = fname
    if overrides:
        print(f"[info] loaded {len(overrides)} flag overrides from countries.json")
    return overrides


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    countries = dict(COUNTRIES)
    countries.update(load_country_overrides_from_json())

    print(f"[info] countries to fetch: {len(countries)}")
    print(f"[info] output dir: {OUT_DIR}")

    results = []
    for i, (iso2, filename) in enumerate(sorted(countries.items()), 1):
        status, path, size, used_filename, info = download_flag(iso2, filename)
        flag_disp = used_filename if used_filename == filename else f"{used_filename} (alt)"
        print(f"[{i:3}/{len(countries)}][{status:4}] {iso2} {flag_disp} -> {size} bytes  {info or ''}")
        results.append((status, iso2, filename, size, info))
        time.sleep(0.25)

    print("\n=== Summary ===")
    ok = [r for r in results if r[0] == "ok"]
    skip = [r for r in results if r[0] == "skip"]
    fail = [r for r in results if r[0] == "fail"]
    total_bytes = sum(r[3] for r in results if r[0] in ("ok", "skip"))
    print(f"downloaded: {len(ok)}   skipped: {len(skip)}   failed: {len(fail)}")
    print(f"total bytes: {total_bytes} ({total_bytes/1024/1024:.2f} MB)")
    if fail:
        print("FAILURES:")
        for _, iso2, filename, _, info in fail:
            print(f"  {iso2}  File:{filename}  -- {info}")
        sys.exit(1)


if __name__ == "__main__":
    main()
