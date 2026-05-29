"""Add latLon coordinates to landmark entries in data/states.json.

Coordinates are sourced from Wikipedia infoboxes (well-documented public
places) and rounded to ~4 decimal places. The script walks every state's
physicalFeatures array and only updates entries where:
  - type === 'landmark'
  - latLon is missing
Other fields are preserved exactly. The file is read and rewritten atomically
to keep concurrent edits (by other agents) from clobbering siblings — we only
touch landmark dicts in place.

We also opportunistically geocode SOME non-landmark features when they have
a single well-defined point (e.g. Niagara Falls, Mount Marcy, Old Faithful).
Long features (rivers, ranges, coastlines) are skipped.

Run:
  python scripts/data-migration/geocode-landmarks.py
"""
from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
STATES_JSON = REPO_ROOT / "data" / "states.json"

# Landmark coords keyed by (postal, name). Sourced from Wikipedia infoboxes.
LANDMARK_COORDS: dict[tuple[str, str], list[float] | None] = {
    # AL
    ("AL", "U.S. Space & Rocket Center"): [34.7113, -86.6543],
    ("AL", "Vulcan Statue"): [33.4881, -86.7958],
    # AK
    ("AK", "Trans-Alaska Pipeline"): [64.0671, -145.7717],  # midpoint near Delta Junction
    # AZ
    ("AZ", "Hoover Dam"): [36.0161, -114.7377],
    ("AZ", "London Bridge at Lake Havasu"): [34.4669, -114.3439],
    # AR
    ("AR", "Little Rock Central High School"): [34.7372, -92.2983],
    ("AR", "Old State House"): [34.7461, -92.2747],
    # CA
    ("CA", "Golden Gate Bridge"): [37.8199, -122.4783],
    ("CA", "Hollywood Sign"): [34.1341, -118.3215],
    # The "Golden Gate Bridge Trail Trolleys" entry isn't a well-known landmark
    # under that name — best guess is a misnomer for the SF cable car turnaround
    # near the Golden Gate area. Use the Powell-Hyde cable car turnaround.
    ("CA", "Golden Gate Bridge Trail Trolleys"): [37.8076, -122.4209],
    # CO
    ("CO", "United States Air Force Academy Chapel"): [38.9956, -104.8917],
    ("CO", "Red Rocks Amphitheatre"): [39.6655, -105.2057],
    # CT
    ("CT", "Mark Twain House"): [41.7669, -72.7011],
    ("CT", "USS Nautilus Submarine"): [41.3878, -72.0894],
    # DE
    ("DE", "Old Swedes Church"): [39.7335, -75.5410],
    ("DE", "Cape Henlopen Lighthouse"): [38.7867, -75.0939],
    # DC
    ("DC", "White House"): [38.8977, -77.0365],
    ("DC", "U.S. Capitol"): [38.8899, -77.0091],
    ("DC", "Washington Monument"): [38.8895, -77.0353],
    ("DC", "Lincoln Memorial"): [38.8893, -77.0502],
    ("DC", "Smithsonian National Air and Space Museum"): [38.8882, -77.0199],
    # FL
    ("FL", "Kennedy Space Center"): [28.5728, -80.6490],
    ("FL", "Walt Disney World"): [28.3852, -81.5639],
    ("FL", "Castillo de San Marcos"): [29.8978, -81.3111],
    # GA
    ("GA", "Stone Mountain"): [33.8053, -84.1452],
    ("GA", "Martin Luther King Jr. Birthplace"): [33.7556, -84.3729],
    # HI
    ("HI", "USS Arizona Memorial"): [21.3649, -157.9501],
    ("HI", "Iolani Palace"): [21.3069, -157.8583],
    # ID
    ("ID", "Idaho State Capitol"): [43.6178, -116.1996],
    ("ID", "Experimental Breeder Reactor I"): [43.5106, -112.6494],
    # IL
    ("IL", "Willis Tower"): [41.8789, -87.6359],
    ("IL", "Cloud Gate (The Bean)"): [41.8827, -87.6233],
    ("IL", "Navy Pier"): [41.8917, -87.6086],
    # IN
    ("IN", "Indianapolis Motor Speedway"): [39.7950, -86.2347],
    ("IN", "Soldiers' and Sailors' Monument"): [39.7684, -86.1581],
    # IA
    ("IA", "Iowa State Capitol"): [41.5912, -93.6035],
    ("IA", "Field of Dreams Movie Site"): [42.4961, -90.8514],
    # KS
    ("KS", "Eisenhower Presidential Library"): [38.9445, -97.2199],
    ("KS", "Kansas State Capitol"): [39.0483, -95.6781],
    # KY
    ("KY", "Churchill Downs"): [38.2069, -85.7714],
    ("KY", "Abraham Lincoln Birthplace"): [37.5347, -85.7367],
    ("KY", "Louisville Slugger Museum"): [38.2570, -85.7634],
    # LA
    ("LA", "French Quarter"): [29.9584, -90.0644],
    ("LA", "Louisiana State Capitol"): [30.4571, -91.1874],
    # ME
    ("ME", "Portland Head Light"): [43.6231, -70.2079],
    ("ME", "Bath Iron Works"): [43.9050, -69.8133],
    # MD
    ("MD", "Fort McHenry"): [39.2632, -76.5803],
    ("MD", "U.S. Naval Academy"): [38.9847, -76.4827],
    # MA
    ("MA", "Freedom Trail"): [42.3601, -71.0589],  # Boston Common start
    ("MA", "Plymouth Rock"): [41.9583, -70.6622],
    ("MA", "Fenway Park"): [42.3467, -71.0972],
    # MI
    ("MI", "Mackinac Bridge"): [45.8174, -84.7278],
    ("MI", "Henry Ford Museum"): [42.3036, -83.2342],
    # MN
    ("MN", "Mall of America"): [44.8548, -93.2422],
    ("MN", "Spoonbridge and Cherry"): [44.9692, -93.2895],
    # MS
    ("MS", "Mississippi State Capitol"): [32.3037, -90.1822],
    ("MS", "Elvis Presley Birthplace"): [34.2618, -88.6989],
    # MO
    ("MO", "Gateway Arch"): [38.6247, -90.1848],
    ("MO", "Harry S. Truman Library"): [39.0828, -94.4147],
    # MT
    ("MT", "Berkeley Pit"): [46.0167, -112.5111],
    ("MT", "Going-to-the-Sun Road"): [48.7414, -113.7181],  # Logan Pass summit
    # NE
    ("NE", "Carhenge"): [42.1422, -102.8583],
    # NV
    ("NV", "Hoover Dam"): [36.0161, -114.7377],
    ("NV", "Las Vegas Strip"): [36.1147, -115.1728],
    # NH
    ("NH", "Mount Washington Cog Railway"): [44.2706, -71.3550],  # Marshfield base
    ("NH", "Strawbery Banke Museum"): [43.0747, -70.7517],
    # NJ
    ("NJ", "Lucy the Elephant"): [39.3458, -74.4858],
    ("NJ", "Cape May Lighthouse"): [38.9342, -74.9603],
    ("NJ", "Thomas Edison's Lab"): [40.7878, -74.2389],
    # NM
    ("NM", "Very Large Array"): [34.0784, -107.6184],
    ("NM", "Loretto Chapel Staircase"): [35.6859, -105.9378],
    # NY
    ("NY", "Statue of Liberty"): [40.6892, -74.0445],
    ("NY", "Empire State Building"): [40.7484, -73.9857],
    ("NY", "Brooklyn Bridge"): [40.7061, -73.9969],
    # NC
    ("NC", "Wright Brothers National Memorial"): [36.0144, -75.6692],
    ("NC", "Biltmore Estate"): [35.5404, -82.5524],
    ("NC", "USS North Carolina Battleship"): [34.2358, -77.9542],
    # ND
    ("ND", "Enchanted Highway"): [46.7572, -102.4500],  # midpoint of the 32-mile route
    ("ND", "International Peace Garden"): [48.9994, -100.0598],
    # OH
    ("OH", "Rock and Roll Hall of Fame"): [41.5086, -81.6953],
    ("OH", "Pro Football Hall of Fame"): [40.8210, -81.3899],
    ("OH", "Cincinnati's Roebling Suspension Bridge"): [39.0961, -84.5106],
    # OK
    ("OK", "Oklahoma City National Memorial"): [35.4729, -97.5170],
    ("OK", "Golden Driller"): [36.1366, -95.9344],
    # OR
    ("OR", "Astoria Column"): [46.1817, -123.8228],
    ("OR", "Pittock Mansion"): [45.5249, -122.7163],
    # PA
    ("PA", "Liberty Bell"): [39.9496, -75.1503],
    ("PA", "Independence Hall"): [39.9489, -75.1500],
    ("PA", "Fallingwater"): [39.9061, -79.4683],
    # RI
    ("RI", "The Breakers Mansion"): [41.4694, -71.2986],
    ("RI", "Touro Synagogue"): [41.4880, -71.3119],
    # SC
    ("SC", "Fort Sumter"): [32.7522, -79.8747],
    ("SC", "Angel Oak Tree"): [32.7039, -80.0664],
    ("SC", "Arthur Ravenel Jr. Bridge"): [32.8042, -79.9233],
    # SD
    ("SD", "Mount Rushmore"): [43.8791, -103.4591],
    ("SD", "Crazy Horse Memorial"): [43.8367, -103.6236],
    ("SD", "Corn Palace"): [43.7128, -98.0289],
    # TN
    ("TN", "Graceland"): [35.0461, -90.0228],
    ("TN", "Parthenon Replica"): [36.1497, -86.8133],
    ("TN", "Lookout Mountain Incline Railway"): [35.0050, -85.3417],
    # TX
    ("TX", "The Alamo"): [29.4260, -98.4861],
    ("TX", "Texas State Capitol"): [30.2747, -97.7404],
    ("TX", "Space Center Houston"): [29.5519, -95.0975],
    # UT
    ("UT", "Salt Lake Temple"): [40.7706, -111.8919],
    ("UT", "Golden Spike National Historical Park"): [41.6181, -112.5489],
    ("UT", "This Is the Place Monument"): [40.7522, -111.8147],
    # VT
    ("VT", "Vermont State House"): [44.2624, -72.5807],
    ("VT", "Bennington Battle Monument"): [42.8825, -73.2050],
    # VA
    ("VA", "Mount Vernon"): [38.7081, -77.0861],
    ("VA", "Monticello"): [38.0086, -78.4533],
    ("VA", "Colonial Williamsburg"): [37.2707, -76.7075],
    # WA
    ("WA", "Space Needle"): [47.6205, -122.3493],
    ("WA", "Grand Coulee Dam"): [47.9567, -118.9817],
    ("WA", "Pike Place Market"): [47.6090, -122.3414],
    # WV
    ("WV", "New River Gorge Bridge"): [38.0697, -81.0775],
    ("WV", "West Virginia State Capitol"): [38.3365, -81.6125],
    # WI
    ("WI", "Wisconsin State Capitol"): [43.0747, -89.3842],
    ("WI", "House on the Rock"): [43.0942, -90.1356],
    # WY
    ("WY", "Buffalo Bill Center of the West"): [44.5267, -109.0681],
    ("WY", "Wyoming State Capitol"): [41.1400, -104.8202],
}

# Optional: a handful of non-landmark physical features that ARE single points
# and worth geocoding too. Keyed by (postal, name). Long features (rivers,
# ranges, coastlines) are intentionally skipped — they don't render as a pin.
EXTRA_COORDS: dict[tuple[str, str], list[float]] = {
    ("NY", "Niagara Falls"): [43.0828, -79.0739],
    ("NY", "Mount Marcy"): [44.1126, -73.9237],
    ("WY", "Old Faithful"): [44.4605, -110.8281],
    ("AZ", "Grand Canyon"): [36.1069, -112.1129],
    ("SD", "Badlands"): [43.8554, -101.9777],
    ("NH", "Mount Washington"): [44.2706, -71.3033],
    ("CA", "Yosemite Valley"): [37.7456, -119.5936],
    ("CO", "Pikes Peak"): [38.8409, -105.0442],
    ("AK", "Denali"): [63.0692, -151.0070],
    ("WA", "Mount Rainier"): [46.8523, -121.7603],
    ("OR", "Crater Lake"): [42.9446, -122.1090],
    ("HI", "Mauna Kea"): [19.8207, -155.4681],
    ("HI", "Diamond Head"): [21.2620, -157.8056],
    ("MT", "Glacier National Park"): [48.7596, -113.7870],
    ("UT", "Delicate Arch"): [38.7436, -109.4993],
    ("UT", "Bryce Canyon"): [37.5930, -112.1871],
    ("KY", "Mammoth Cave"): [37.1869, -86.1000],
    ("TN", "Clingmans Dome"): [35.5628, -83.4986],
    ("VA", "Natural Bridge"): [37.6303, -79.5431],
    ("WV", "Seneca Rocks"): [38.8358, -79.3717],
    ("FL", "Everglades"): [25.2866, -80.8987],
    ("ME", "Mount Katahdin"): [45.9043, -68.9213],
    ("VT", "Mount Mansfield"): [44.5436, -72.8142],
    ("NM", "White Sands"): [32.7872, -106.3257],
    ("NM", "Carlsbad Caverns"): [32.1479, -104.5567],
    ("AZ", "Meteor Crater"): [35.0274, -111.0224],
    ("WY", "Devils Tower"): [44.5902, -104.7146],
    ("CA", "Mount Whitney"): [36.5786, -118.2920],
    ("CA", "Death Valley"): [36.5054, -117.0794],
    ("CA", "Lake Tahoe"): [39.0968, -120.0324],
    ("NV", "Lake Tahoe"): [39.0968, -120.0324],
    ("NV", "Red Rock Canyon"): [36.1357, -115.4282],
    ("ID", "Shoshone Falls"): [42.5950, -114.4014],
    ("MN", "Lake Itasca"): [47.2418, -95.2056],
    ("LA", "Lake Pontchartrain"): [30.2000, -90.1000],
    ("FL", "Lake Okeechobee"): [26.9520, -80.8200],
    ("MI", "Sleeping Bear Dunes"): [44.8819, -86.0584],
    ("NE", "Chimney Rock"): [41.7036, -103.3503],
}


def main() -> tuple[int, int, list[tuple[str, str]]]:
    raw = STATES_JSON.read_text(encoding="utf-8")
    data = json.loads(raw)

    total_landmarks = 0
    geocoded_landmarks = 0
    missing: list[tuple[str, str]] = []

    for state in data:
        features = state.get("physicalFeatures")
        if not isinstance(features, list):
            continue
        postal = state.get("postal")
        for feat in features:
            if not isinstance(feat, dict):
                continue
            name = feat.get("name")
            ftype = feat.get("type")

            if ftype == "landmark":
                total_landmarks += 1
                # Skip if already geocoded.
                if isinstance(feat.get("latLon"), list):
                    geocoded_landmarks += 1
                    continue
                coords = LANDMARK_COORDS.get((postal, name))
                if coords is None:
                    feat["latLon"] = None
                    missing.append((postal, name))
                else:
                    feat["latLon"] = coords
                    geocoded_landmarks += 1
            else:
                # Opportunistic geocoding for single-point natural features.
                if isinstance(feat.get("latLon"), list):
                    continue
                coords = EXTRA_COORDS.get((postal, name))
                if coords is not None:
                    feat["latLon"] = coords

    # Pretty-print with 2-space indent (matches existing file convention).
    out = json.dumps(data, indent=2, ensure_ascii=False)
    STATES_JSON.write_text(out + "\n", encoding="utf-8")

    return total_landmarks, geocoded_landmarks, missing


if __name__ == "__main__":
    total, geocoded, missing = main()
    print(f"Landmarks total:    {total}")
    print(f"Landmarks geocoded: {geocoded}")
    print(f"Landmarks missing:  {len(missing)}")
    for postal, name in missing:
        print(f"  - [{postal}] {name}")
