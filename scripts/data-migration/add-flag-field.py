"""
Merge a `flag` field into every entry in data/states.json.

Flag adoption years and descriptions sourced from Wikipedia infoboxes
(flag-of-X articles). Descriptions are 1-2 sentences, age-appropriate.

Preserves all other fields. Verifies the referenced SVG exists on disk
before assigning flag.path; sets path=null if the file is missing.

Usage: python add-flag-field.py
"""

import json
import os
import sys
from collections import OrderedDict

STATES_JSON = r"C:/Users/dglazier/source/Personal/mammas-place/data/states.json"
FLAGS_DIR = r"C:/Users/dglazier/source/Personal/mammas-place/public/geography/flags"

# postal -> (adoptedYear, description)
FLAGS = {
    "AL": (1895, "A white field charged with a crimson saltire (diagonal cross), inspired by the Confederate Battle Flag's St. Andrew's cross."),
    "AK": (1927, "A dark blue field with eight gold stars forming the Big Dipper and the North Star; designed by 13-year-old Benny Benson."),
    "AZ": (1917, "Thirteen red and gold rays of the setting sun above a blue lower half, with a large copper-colored star at the center honoring Arizona's copper mining heritage."),
    "AR": (1913, "A red field with a large white diamond bordered in blue, the diamond representing Arkansas as the only U.S. state where diamonds are mined."),
    "CA": (1911, "A white field with a grizzly bear walking on green grass above a red stripe, with a red star in the upper left and the words 'California Republic' below the bear."),
    "CO": (1911, "Three horizontal stripes of blue, white, and blue, with a large red letter 'C' encircling a golden disk representing Colorado's sunshine and gold."),
    "CT": (1897, "A blue field with a white shield bearing three grapevines and the state motto 'Qui Transtulit Sustinet' (He who transplanted still sustains) on a banner below."),
    "DE": (1913, "A colonial-blue field with a buff-colored diamond containing the state coat of arms, and the date of Delaware's ratification of the Constitution—December 7, 1787—below."),
    "DC": (1938, "A white field with three red stars above two horizontal red bars, based on the coat of arms of George Washington's family."),
    "FL": (1900, "A white field with a red saltire (diagonal cross) and the state seal at the center, depicting a Seminole woman, a sabal palm, and a steamboat."),
    "GA": (2003, "Three horizontal stripes of red, white, and red, with a blue square in the upper left containing the state coat of arms encircled by 13 white stars."),
    "HI": (1845, "Eight horizontal stripes of white, red, and blue representing Hawaii's eight main islands, with a Union Jack in the upper-left corner reflecting historical ties to Britain."),
    "ID": (1907, "A blue field with the state seal—the only U.S. state seal designed by a woman, Emma Edwards Green—surrounded by gold fringe and a red banner reading 'State of Idaho'."),
    "IL": (1915, "A white field featuring the state seal: an eagle holding a banner reading 'State Sovereignty, National Union' perched on a boulder above a rising sun."),
    "IN": (1917, "A blue field with a gold torch surrounded by 19 stars representing Indiana as the 19th state to join the Union, designed by Paul Hadley for the state's centennial."),
    "IA": (1921, "Three vertical stripes of blue, white, and red (inspired by the French tricolor honoring the Louisiana Purchase) with a bald eagle carrying a ribbon at the center."),
    "KS": (1927, "A dark blue field showing the state seal above a sunflower and the word 'KANSAS', with the seal depicting a settler's cabin, plowed fields, buffalo, and 34 stars."),
    "KY": (1918, "A navy blue field with the state seal at the center, showing two men—a frontiersman and a statesman—embracing, with the state motto 'United We Stand, Divided We Fall'."),
    "LA": (2010, "A blue field with a white pelican feeding her three chicks with drops of her own blood (a 'pelican in her piety'), above a banner with the state motto 'Union, Justice, Confidence'."),
    "ME": (1909, "A blue field bearing the state coat of arms: a moose resting beneath a tall pine tree, flanked by a farmer and a sailor representing Maine's land and sea heritage."),
    "MD": (1904, "A bold heraldic banner combining the black-and-gold checkered arms of the Calvert family with the red-and-white quartered cross of the Crossland family."),
    "MA": (1908, "A white field with the state coat of arms at center: a Native American Algonquian figure holding a bow and arrow under a star, on a blue shield with a sword above."),
    "MI": (1911, "A blue field bearing the state coat of arms with an elk and a moose holding a shield, an eagle above, and the state mottos 'Tuebor' (I will defend) and 'Si Quaeris Peninsulam Amoenam Circumspice'."),
    "MN": (2024, "A dark blue eight-pointed star on a lighter blue field, with a horizontal stripe of pale blue along the fly side, adopted in 2024 to replace the previous seal-on-blue design."),
    "MS": (2021, "A red, blue, and gold flag featuring a magnolia blossom (the state flower) encircled by 21 white stars and one larger gold star, adopted in 2021 after retiring the prior Confederate-themed design."),
    "MO": (1913, "Three horizontal stripes of red, white, and blue (echoing the U.S. flag and France) with the state seal at the center surrounded by 24 stars."),
    "MT": (1905, "A blue field with the state seal showing mountains, the Great Falls of the Missouri River, and a plow, shovel, and pick, with the word 'MONTANA' added in 1981."),
    "NE": (1925, "A blue field bearing the state seal in gold and silver, depicting a steamboat on the Missouri River, a blacksmith, a settler's cabin, and the Rocky Mountains in the distance."),
    "NV": (1929, "A cobalt-blue field with a silver star, the word 'Nevada', and a wreath of sagebrush in the upper-left corner, plus the motto 'Battle Born' honoring Nevada's Civil War-era admission."),
    "NH": (1909, "A blue field with the state seal at the center: the frigate Raleigh under construction at Portsmouth in 1776, surrounded by laurel leaves and nine stars."),
    "NJ": (1896, "A buff-colored field bearing the state coat of arms: a shield with three plows flanked by Liberty and Ceres, the goddess of agriculture, with a horse's head crest above."),
    "NM": (1925, "A red sun symbol of the Zia people centered on a golden yellow field, with the four groups of four rays representing the four directions, seasons, times of day, and stages of life."),
    "NY": (1901, "A buff field bearing the state coat of arms: a shield showing a sunrise over the Hudson River, flanked by Liberty and Justice, with the state motto 'Excelsior' (Ever Upward) below."),
    "NC": (1885, "A blue vertical stripe with a white 'N' and 'C' flanking a star, alongside horizontal stripes of red and white and two dates marking key moments in North Carolina's path to independence."),
    "ND": (1911, "A dark blue field with a bald eagle clutching arrows and an olive branch, modeled on the banner carried by North Dakota troops in the Spanish-American War and Philippine-American War."),
    "OH": (1902, "A unique five-sided 'swallow-tailed' burgee with red and white stripes and a blue triangle bearing 17 stars and a white-bordered red disk—the only non-rectangular U.S. state flag."),
    "OK": (1925, "A sky-blue field bearing an Osage warrior's buffalo-hide shield decorated with eagle feathers, crossed by a peace pipe and an olive branch symbolizing peace between Native peoples and settlers."),
    "OR": (1925, "A navy-blue field with the state shield, the word 'STATE OF OREGON', and the year 1859 in gold on the front—and a gold beaver on the back, making Oregon the only U.S. state with a two-sided flag."),
    "PA": (1907, "A blue field bearing the state coat of arms: a shield with a ship, plow, and sheaves of wheat, flanked by two black horses and topped by a bald eagle, with an olive branch and cornstalk below."),
    "RI": (1897, "A white field with a gold anchor in the center surrounded by 13 gold stars, with a blue ribbon below bearing the single-word state motto 'Hope'."),
    "SC": (1861, "An indigo-blue field with a white crescent in the upper-left corner and a white palmetto tree at the center, honoring the palmetto-log fort that repelled a British attack in 1776."),
    "SD": (1992, "A sky-blue field with the state seal in gold at the center, surrounded by golden sun rays and the words 'SOUTH DAKOTA' and 'THE MOUNT RUSHMORE STATE'."),
    "TN": (1905, "A red field with a blue circle bearing three white stars (representing Tennessee's three Grand Divisions—East, Middle, and West), bordered in white, with a blue vertical bar on the fly side."),
    "TX": (1839, "A vertical blue stripe with a single large white five-pointed star on the hoist side, beside horizontal stripes of white over red—nicknamed the 'Lone Star Flag'."),
    "UT": (2024, "A modern flag with a navy-blue 'mountain' base and white sky, centered with a gold beehive on a hexagon, an eight-pointed star above, and red side stripes representing Utah's red-rock heritage."),
    "VT": (1923, "A blue field with the state coat of arms at the center: a tall pine tree, a cow and sheaves of wheat representing agriculture, and mountains in the background with the word 'Vermont' below."),
    "VA": (1861, "A deep-blue field with the state seal at the center, depicting the Roman goddess Virtus standing victorious over a defeated tyrant, with the state motto 'Sic Semper Tyrannis' (Thus Always to Tyrants)."),
    "WA": (1923, "A dark-green field (the only U.S. state flag with a green background) bearing a portrait of George Washington at the center, encircled by the words 'The Seal of the State of Washington 1889'."),
    "WV": (1929, "A white field bordered in blue containing the state coat of arms: a farmer and a miner flanking a boulder marked '1863' (the year of statehood), with rifles and a Phrygian cap below symbolizing the fight for liberty."),
    "WI": (1913, "A dark blue field bearing the state coat of arms with a sailor and a miner flanking a shield, with the word 'WISCONSIN' above and '1848' (the year of statehood) below."),
    "WY": (1917, "A blue field with a white border and red outer border, centered with the silhouette of a bison branded with the state seal—designed by Verna Keays and adopted after a 1916 contest."),
}


def main():
    with open(STATES_JSON, "r", encoding="utf-8") as f:
        states = json.load(f, object_pairs_hook=OrderedDict)

    missing_postals = []
    missing_files = []
    updated = 0

    for state in states:
        postal = state["postal"]
        entry = FLAGS.get(postal)
        if not entry:
            missing_postals.append(postal)
            state["flag"] = {"path": None, "adoptedYear": None, "description": None}
            continue
        year, desc = entry
        path_rel = f"/geography/flags/{postal.lower()}.svg"
        disk_path = os.path.join(FLAGS_DIR, f"{postal.lower()}.svg")
        if not (os.path.exists(disk_path) and os.path.getsize(disk_path) > 100):
            missing_files.append(postal)
            path_rel = None
        state["flag"] = OrderedDict([
            ("path", path_rel),
            ("adoptedYear", year),
            ("description", desc),
        ])
        updated += 1

    with open(STATES_JSON, "w", encoding="utf-8") as f:
        json.dump(states, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"updated: {updated}/{len(states)} states")
    if missing_postals:
        print(f"NO FLAG METADATA for postals: {missing_postals}")
    if missing_files:
        print(f"FLAG FILE MISSING ON DISK for postals: {missing_files}")
    if missing_postals or missing_files:
        sys.exit(1)


if __name__ == "__main__":
    main()
