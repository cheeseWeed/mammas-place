"""
add-major-cities.py

Adds a `majorCities` field to each of the 51 entries (50 states + DC) in
data/states.json. Preserves ALL other fields (including any work a sibling
agent may have just done on the `parks` array).

Sources: US Census Bureau Population Estimates / ACS, 2020-2023 vintages,
as compiled on Wikipedia "List of cities in <state>" pages.

Each entry: {"name": str, "population": int, "isCapital": bool}
- Top 3-5 cities by population
- ALWAYS includes the state capital (even if not top-5 by pop)
- Exactly one isCapital=True per state
- DC has a single entry: Washington
"""

import json
from pathlib import Path

STATES_PATH = Path("C:/Users/dglazier/source/Personal/mammas-place/data/states.json")

# Postal -> list[ {name, population, isCapital} ]
# Populations are most recent Census Bureau estimates (2020-2023 vintage).
# Capital is ALWAYS present (flagged), even when small.
CITIES_BY_POSTAL = {
    "AL": [
        {"name": "Huntsville", "population": 225564, "isCapital": False},
        {"name": "Montgomery", "population": 196290, "isCapital": True},
        {"name": "Birmingham", "population": 196644, "isCapital": False},
        {"name": "Mobile", "population": 184952, "isCapital": False},
        {"name": "Tuscaloosa", "population": 111338, "isCapital": False},
    ],
    "AK": [
        {"name": "Anchorage", "population": 287145, "isCapital": False},
        {"name": "Fairbanks", "population": 31239, "isCapital": False},
        {"name": "Juneau", "population": 31685, "isCapital": True},
        {"name": "Wasilla", "population": 9343, "isCapital": False},
    ],
    "AZ": [
        {"name": "Phoenix", "population": 1650070, "isCapital": True},
        {"name": "Tucson", "population": 547239, "isCapital": False},
        {"name": "Mesa", "population": 511648, "isCapital": False},
        {"name": "Chandler", "population": 280167, "isCapital": False},
        {"name": "Gilbert", "population": 275411, "isCapital": False},
    ],
    "AR": [
        {"name": "Little Rock", "population": 201029, "isCapital": True},
        {"name": "Fayetteville", "population": 95230, "isCapital": False},
        {"name": "Fort Smith", "population": 89903, "isCapital": False},
        {"name": "Springdale", "population": 87590, "isCapital": False},
        {"name": "Jonesboro", "population": 80518, "isCapital": False},
    ],
    "CA": [
        {"name": "Los Angeles", "population": 3820914, "isCapital": False},
        {"name": "San Diego", "population": 1388320, "isCapital": False},
        {"name": "San Jose", "population": 969655, "isCapital": False},
        {"name": "San Francisco", "population": 808988, "isCapital": False},
        {"name": "Sacramento", "population": 526384, "isCapital": True},
    ],
    "CO": [
        {"name": "Denver", "population": 716577, "isCapital": True},
        {"name": "Colorado Springs", "population": 488664, "isCapital": False},
        {"name": "Aurora", "population": 398223, "isCapital": False},
        {"name": "Fort Collins", "population": 170376, "isCapital": False},
        {"name": "Lakewood", "population": 156798, "isCapital": False},
    ],
    "CT": [
        {"name": "Bridgeport", "population": 148654, "isCapital": False},
        {"name": "Stamford", "population": 137748, "isCapital": False},
        {"name": "New Haven", "population": 138915, "isCapital": False},
        {"name": "Hartford", "population": 121054, "isCapital": True},
        {"name": "Waterbury", "population": 114403, "isCapital": False},
    ],
    "DE": [
        {"name": "Wilmington", "population": 70655, "isCapital": False},
        {"name": "Dover", "population": 39403, "isCapital": True},
        {"name": "Newark", "population": 31454, "isCapital": False},
        {"name": "Middletown", "population": 24515, "isCapital": False},
    ],
    "FL": [
        {"name": "Jacksonville", "population": 985843, "isCapital": False},
        {"name": "Miami", "population": 455924, "isCapital": False},
        {"name": "Tampa", "population": 403364, "isCapital": False},
        {"name": "Orlando", "population": 320742, "isCapital": False},
        {"name": "Tallahassee", "population": 202221, "isCapital": True},
    ],
    "GA": [
        {"name": "Atlanta", "population": 510823, "isCapital": True},
        {"name": "Augusta", "population": 200549, "isCapital": False},
        {"name": "Columbus", "population": 201877, "isCapital": False},
        {"name": "Macon", "population": 156512, "isCapital": False},
        {"name": "Savannah", "population": 147780, "isCapital": False},
    ],
    "HI": [
        {"name": "Honolulu", "population": 343421, "isCapital": True},
        {"name": "East Honolulu", "population": 50922, "isCapital": False},
        {"name": "Pearl City", "population": 44462, "isCapital": False},
        {"name": "Hilo", "population": 44186, "isCapital": False},
        {"name": "Waipahu", "population": 43485, "isCapital": False},
    ],
    "ID": [
        {"name": "Boise", "population": 235421, "isCapital": True},
        {"name": "Meridian", "population": 134516, "isCapital": False},
        {"name": "Nampa", "population": 116639, "isCapital": False},
        {"name": "Idaho Falls", "population": 67937, "isCapital": False},
        {"name": "Caldwell", "population": 66818, "isCapital": False},
    ],
    "IL": [
        {"name": "Chicago", "population": 2664452, "isCapital": False},
        {"name": "Aurora", "population": 180542, "isCapital": False},
        {"name": "Joliet", "population": 150482, "isCapital": False},
        {"name": "Naperville", "population": 149540, "isCapital": False},
        {"name": "Springfield", "population": 113273, "isCapital": True},
    ],
    "IN": [
        {"name": "Indianapolis", "population": 879293, "isCapital": True},
        {"name": "Fort Wayne", "population": 270402, "isCapital": False},
        {"name": "Evansville", "population": 115749, "isCapital": False},
        {"name": "South Bend", "population": 103453, "isCapital": False},
        {"name": "Carmel", "population": 102453, "isCapital": False},
    ],
    "IA": [
        {"name": "Des Moines", "population": 210381, "isCapital": True},
        {"name": "Cedar Rapids", "population": 134394, "isCapital": False},
        {"name": "Davenport", "population": 100423, "isCapital": False},
        {"name": "Sioux City", "population": 85727, "isCapital": False},
        {"name": "Iowa City", "population": 75130, "isCapital": False},
    ],
    "KS": [
        {"name": "Wichita", "population": 397532, "isCapital": False},
        {"name": "Overland Park", "population": 197238, "isCapital": False},
        {"name": "Kansas City", "population": 156607, "isCapital": False},
        {"name": "Olathe", "population": 147595, "isCapital": False},
        {"name": "Topeka", "population": 125310, "isCapital": True},
    ],
    "KY": [
        {"name": "Louisville", "population": 622981, "isCapital": False},
        {"name": "Lexington", "population": 322570, "isCapital": False},
        {"name": "Bowling Green", "population": 75382, "isCapital": False},
        {"name": "Owensboro", "population": 60556, "isCapital": False},
        {"name": "Frankfort", "population": 28523, "isCapital": True},
    ],
    "LA": [
        {"name": "New Orleans", "population": 364136, "isCapital": False},
        {"name": "Baton Rouge", "population": 221453, "isCapital": True},
        {"name": "Shreveport", "population": 178115, "isCapital": False},
        {"name": "Lafayette", "population": 121374, "isCapital": False},
        {"name": "Lake Charles", "population": 83518, "isCapital": False},
    ],
    "ME": [
        {"name": "Portland", "population": 68408, "isCapital": False},
        {"name": "Lewiston", "population": 37121, "isCapital": False},
        {"name": "Bangor", "population": 31753, "isCapital": False},
        {"name": "South Portland", "population": 26498, "isCapital": False},
        {"name": "Augusta", "population": 18899, "isCapital": True},
    ],
    "MD": [
        {"name": "Baltimore", "population": 569931, "isCapital": False},
        {"name": "Columbia", "population": 104681, "isCapital": False},
        {"name": "Germantown", "population": 91249, "isCapital": False},
        {"name": "Silver Spring", "population": 81816, "isCapital": False},
        {"name": "Annapolis", "population": 40812, "isCapital": True},
    ],
    "MA": [
        {"name": "Boston", "population": 650706, "isCapital": True},
        {"name": "Worcester", "population": 206518, "isCapital": False},
        {"name": "Springfield", "population": 153672, "isCapital": False},
        {"name": "Cambridge", "population": 117090, "isCapital": False},
        {"name": "Lowell", "population": 114804, "isCapital": False},
    ],
    "MI": [
        {"name": "Detroit", "population": 633218, "isCapital": False},
        {"name": "Grand Rapids", "population": 197416, "isCapital": False},
        {"name": "Warren", "population": 137632, "isCapital": False},
        {"name": "Sterling Heights", "population": 132547, "isCapital": False},
        {"name": "Lansing", "population": 112644, "isCapital": True},
    ],
    "MN": [
        {"name": "Minneapolis", "population": 429954, "isCapital": False},
        {"name": "Saint Paul", "population": 307193, "isCapital": True},
        {"name": "Rochester", "population": 122413, "isCapital": False},
        {"name": "Duluth", "population": 86372, "isCapital": False},
        {"name": "Bloomington", "population": 87398, "isCapital": False},
    ],
    "MS": [
        {"name": "Jackson", "population": 145995, "isCapital": True},
        {"name": "Gulfport", "population": 72926, "isCapital": False},
        {"name": "Southaven", "population": 56789, "isCapital": False},
        {"name": "Biloxi", "population": 49449, "isCapital": False},
        {"name": "Hattiesburg", "population": 47921, "isCapital": False},
    ],
    "MO": [
        {"name": "Kansas City", "population": 510704, "isCapital": False},
        {"name": "St. Louis", "population": 281754, "isCapital": False},
        {"name": "Springfield", "population": 168979, "isCapital": False},
        {"name": "Columbia", "population": 128555, "isCapital": False},
        {"name": "Jefferson City", "population": 43079, "isCapital": True},
    ],
    "MT": [
        {"name": "Billings", "population": 121678, "isCapital": False},
        {"name": "Missoula", "population": 77757, "isCapital": False},
        {"name": "Great Falls", "population": 60042, "isCapital": False},
        {"name": "Bozeman", "population": 56123, "isCapital": False},
        {"name": "Helena", "population": 34690, "isCapital": True},
    ],
    "NE": [
        {"name": "Omaha", "population": 487300, "isCapital": False},
        {"name": "Lincoln", "population": 295222, "isCapital": True},
        {"name": "Bellevue", "population": 64086, "isCapital": False},
        {"name": "Grand Island", "population": 53131, "isCapital": False},
        {"name": "Kearney", "population": 34237, "isCapital": False},
    ],
    "NV": [
        {"name": "Las Vegas", "population": 660929, "isCapital": False},
        {"name": "Henderson", "population": 340480, "isCapital": False},
        {"name": "Reno", "population": 274915, "isCapital": False},
        {"name": "North Las Vegas", "population": 280543, "isCapital": False},
        {"name": "Carson City", "population": 58639, "isCapital": True},
    ],
    "NH": [
        {"name": "Manchester", "population": 115644, "isCapital": False},
        {"name": "Nashua", "population": 91322, "isCapital": False},
        {"name": "Concord", "population": 44606, "isCapital": True},
        {"name": "Derry", "population": 34317, "isCapital": False},
        {"name": "Dover", "population": 33335, "isCapital": False},
    ],
    "NJ": [
        {"name": "Newark", "population": 305344, "isCapital": False},
        {"name": "Jersey City", "population": 291657, "isCapital": False},
        {"name": "Paterson", "population": 158171, "isCapital": False},
        {"name": "Elizabeth", "population": 138635, "isCapital": False},
        {"name": "Trenton", "population": 89844, "isCapital": True},
    ],
    "NM": [
        {"name": "Albuquerque", "population": 561008, "isCapital": False},
        {"name": "Las Cruces", "population": 112914, "isCapital": False},
        {"name": "Rio Rancho", "population": 109579, "isCapital": False},
        {"name": "Santa Fe", "population": 89008, "isCapital": True},
        {"name": "Roswell", "population": 47843, "isCapital": False},
    ],
    "NY": [
        {"name": "New York", "population": 8258035, "isCapital": False},
        {"name": "Buffalo", "population": 274678, "isCapital": False},
        {"name": "Yonkers", "population": 207657, "isCapital": False},
        {"name": "Rochester", "population": 209352, "isCapital": False},
        {"name": "Albany", "population": 100826, "isCapital": True},
    ],
    "NC": [
        {"name": "Charlotte", "population": 911311, "isCapital": False},
        {"name": "Raleigh", "population": 482295, "isCapital": True},
        {"name": "Greensboro", "population": 301115, "isCapital": False},
        {"name": "Durham", "population": 296186, "isCapital": False},
        {"name": "Winston-Salem", "population": 254452, "isCapital": False},
    ],
    "ND": [
        {"name": "Fargo", "population": 133188, "isCapital": False},
        {"name": "Bismarck", "population": 75092, "isCapital": True},
        {"name": "Grand Forks", "population": 59166, "isCapital": False},
        {"name": "Minot", "population": 48377, "isCapital": False},
        {"name": "West Fargo", "population": 41679, "isCapital": False},
    ],
    "OH": [
        {"name": "Columbus", "population": 913175, "isCapital": True},
        {"name": "Cleveland", "population": 362656, "isCapital": False},
        {"name": "Cincinnati", "population": 311097, "isCapital": False},
        {"name": "Toledo", "population": 265304, "isCapital": False},
        {"name": "Akron", "population": 188701, "isCapital": False},
    ],
    "OK": [
        {"name": "Oklahoma City", "population": 702767, "isCapital": True},
        {"name": "Tulsa", "population": 411401, "isCapital": False},
        {"name": "Norman", "population": 130046, "isCapital": False},
        {"name": "Broken Arrow", "population": 119198, "isCapital": False},
        {"name": "Edmond", "population": 96390, "isCapital": False},
    ],
    "OR": [
        {"name": "Portland", "population": 630498, "isCapital": False},
        {"name": "Eugene", "population": 177899, "isCapital": False},
        {"name": "Salem", "population": 177432, "isCapital": True},
        {"name": "Gresham", "population": 110723, "isCapital": False},
        {"name": "Hillsboro", "population": 105494, "isCapital": False},
    ],
    "PA": [
        {"name": "Philadelphia", "population": 1550542, "isCapital": False},
        {"name": "Pittsburgh", "population": 303255, "isCapital": False},
        {"name": "Allentown", "population": 125845, "isCapital": False},
        {"name": "Reading", "population": 95112, "isCapital": False},
        {"name": "Harrisburg", "population": 50267, "isCapital": True},
    ],
    "RI": [
        {"name": "Providence", "population": 190934, "isCapital": True},
        {"name": "Cranston", "population": 82934, "isCapital": False},
        {"name": "Warwick", "population": 82066, "isCapital": False},
        {"name": "Pawtucket", "population": 75827, "isCapital": False},
        {"name": "East Providence", "population": 47291, "isCapital": False},
    ],
    "SC": [
        {"name": "Charleston", "population": 155369, "isCapital": False},
        {"name": "Columbia", "population": 139698, "isCapital": True},
        {"name": "North Charleston", "population": 117949, "isCapital": False},
        {"name": "Mount Pleasant", "population": 99818, "isCapital": False},
        {"name": "Rock Hill", "population": 76882, "isCapital": False},
    ],
    "SD": [
        {"name": "Sioux Falls", "population": 213891, "isCapital": False},
        {"name": "Rapid City", "population": 78492, "isCapital": False},
        {"name": "Aberdeen", "population": 28658, "isCapital": False},
        {"name": "Brookings", "population": 24014, "isCapital": False},
        {"name": "Pierre", "population": 14091, "isCapital": True},
    ],
    "TN": [
        {"name": "Nashville", "population": 687788, "isCapital": True},
        {"name": "Memphis", "population": 618639, "isCapital": False},
        {"name": "Knoxville", "population": 198100, "isCapital": False},
        {"name": "Chattanooga", "population": 187030, "isCapital": False},
        {"name": "Clarksville", "population": 178665, "isCapital": False},
    ],
    "TX": [
        {"name": "Houston", "population": 2314157, "isCapital": False},
        {"name": "San Antonio", "population": 1495295, "isCapital": False},
        {"name": "Dallas", "population": 1302868, "isCapital": False},
        {"name": "Austin", "population": 979882, "isCapital": True},
        {"name": "Fort Worth", "population": 978468, "isCapital": False},
    ],
    "UT": [
        {"name": "Salt Lake City", "population": 200478, "isCapital": True},
        {"name": "West Valley City", "population": 140230, "isCapital": False},
        {"name": "West Jordan", "population": 117035, "isCapital": False},
        {"name": "Provo", "population": 115162, "isCapital": False},
        {"name": "St. George", "population": 105086, "isCapital": False},
    ],
    "VT": [
        {"name": "Burlington", "population": 44595, "isCapital": False},
        {"name": "South Burlington", "population": 20292, "isCapital": False},
        {"name": "Rutland", "population": 15807, "isCapital": False},
        {"name": "Essex Junction", "population": 11286, "isCapital": False},
        {"name": "Montpelier", "population": 8074, "isCapital": True},
    ],
    "VA": [
        {"name": "Virginia Beach", "population": 457672, "isCapital": False},
        {"name": "Chesapeake", "population": 254886, "isCapital": False},
        {"name": "Norfolk", "population": 232995, "isCapital": False},
        {"name": "Arlington", "population": 234000, "isCapital": False},
        {"name": "Richmond", "population": 229395, "isCapital": True},
    ],
    "WA": [
        {"name": "Seattle", "population": 755078, "isCapital": False},
        {"name": "Spokane", "population": 230160, "isCapital": False},
        {"name": "Tacoma", "population": 222906, "isCapital": False},
        {"name": "Vancouver", "population": 196442, "isCapital": False},
        {"name": "Olympia", "population": 56114, "isCapital": True},
    ],
    "WV": [
        {"name": "Charleston", "population": 47940, "isCapital": True},
        {"name": "Huntington", "population": 45325, "isCapital": False},
        {"name": "Morgantown", "population": 30347, "isCapital": False},
        {"name": "Parkersburg", "population": 28645, "isCapital": False},
        {"name": "Wheeling", "population": 26020, "isCapital": False},
    ],
    "WI": [
        {"name": "Milwaukee", "population": 561385, "isCapital": False},
        {"name": "Madison", "population": 272903, "isCapital": True},
        {"name": "Green Bay", "population": 107395, "isCapital": False},
        {"name": "Kenosha", "population": 99540, "isCapital": False},
        {"name": "Racine", "population": 76773, "isCapital": False},
    ],
    "WY": [
        {"name": "Cheyenne", "population": 65498, "isCapital": True},
        {"name": "Casper", "population": 58320, "isCapital": False},
        {"name": "Laramie", "population": 31407, "isCapital": False},
        {"name": "Gillette", "population": 33403, "isCapital": False},
        {"name": "Rock Springs", "population": 23319, "isCapital": False},
    ],
    "DC": [
        {"name": "Washington", "population": 678972, "isCapital": True},
    ],
}


def main():
    raw = STATES_PATH.read_text(encoding="utf-8")
    data = json.loads(raw)

    if not isinstance(data, list):
        raise SystemExit(f"Expected top-level array, got {type(data).__name__}")

    expected = set(CITIES_BY_POSTAL.keys())
    seen = set()
    issues = []

    # Track parks BEFORE the merge to prove we didn't drop any
    parks_before = sum(len(s.get("parks", []) or []) for s in data)

    for state in data:
        postal = state.get("postal")
        if postal not in CITIES_BY_POSTAL:
            issues.append(f"Unknown postal: {postal} ({state.get('name')})")
            continue
        seen.add(postal)
        cities = CITIES_BY_POSTAL[postal]
        caps = [c for c in cities if c["isCapital"]]
        if len(caps) != 1:
            issues.append(f"{postal}: {len(caps)} capitals (want 1)")
        # Mutate the state dict — preserves all other fields including parks
        state["majorCities"] = cities

    missing = expected - seen
    if missing:
        issues.append(f"Missing postals in source data: {sorted(missing)}")

    parks_after = sum(len(s.get("parks", []) or []) for s in data)
    if parks_after != parks_before:
        issues.append(f"Parks count changed: {parks_before} -> {parks_after}")

    if issues:
        print("Pre-write issues:")
        for i in issues:
            print(" -", i)
        raise SystemExit("Aborting write due to issues above.")

    # Write back with 2-space indent to match existing formatting
    out = json.dumps(data, indent=2, ensure_ascii=False)
    # Match repo convention: trailing newline
    STATES_PATH.write_text(out + "\n", encoding="utf-8")
    print(f"OK: {len(data)} states written")
    print(f"Parks total preserved: {parks_after}")
    print(f"Cities added across all states: {sum(len(c) for c in CITIES_BY_POSTAL.values())}")


if __name__ == "__main__":
    main()
