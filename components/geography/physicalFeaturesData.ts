// Hand-authored physical-feature coordinates for the US Study Map overlay.
//
// Each feature is a list of [latitude, longitude] points. PhysicalLayer
// projects them through d3-geo's geoAlbersUsa() (same projection USMap uses
// for state outlines / capitals / labels) so they line up with the political
// SVG underneath.
//
// Precision target: "a kid can recognize the river/range from across the
// room." NOT survey-grade. 8-14 hand-picked points per feature is enough to
// convey shape. Source: Wikipedia article maps + Natural Earth approximate
// course tracings.

export type LatLon = readonly [number, number]; // [lat, lon]

export type RiverFeature = {
  readonly name: string;
  readonly points: readonly LatLon[];
};

export type LakeFeature = {
  readonly name: string;
  readonly points: readonly LatLon[]; // closed polygon, last point need not duplicate first
};

export type MountainFeature = {
  readonly name: string;
  readonly points: readonly LatLon[]; // closed polygon outlining the rough range
};

// ---------------------------------------------------------------------------
// RIVERS — source → mouth, polyline.
// ---------------------------------------------------------------------------
export const RIVERS: readonly RiverFeature[] = [
  {
    name: 'Mississippi River',
    // Lake Itasca, MN → Gulf of Mexico, LA
    points: [
      [47.24, -95.21], // Lake Itasca, MN (source)
      [45.97, -94.36], // Brainerd, MN
      [44.98, -93.27], // Minneapolis/St. Paul, MN
      [43.55, -91.23], // La Crosse, WI
      [41.52, -90.58], // Quad Cities, IA/IL
      [38.63, -90.20], // St. Louis, MO (Missouri River joins)
      [37.16, -89.53], // Cape Girardeau, MO
      [35.15, -90.05], // Memphis, TN
      [33.45, -91.05], // Greenville, MS
      [32.36, -91.04], // Vicksburg, MS
      [30.97, -91.36], // Baton Rouge, LA
      [29.95, -90.07], // New Orleans, LA
      [29.15, -89.25], // Mouth — Mississippi Delta, Gulf of Mexico
    ],
  },
  {
    name: 'Missouri River',
    // Three Forks, MT → confluence with Mississippi at St. Louis, MO
    points: [
      [45.89, -111.50], // Three Forks, MT (source)
      [47.50, -111.30], // Great Falls, MT
      [47.60, -104.16], // near Williston, ND (Yellowstone joins)
      [46.81, -100.78], // Bismarck, ND
      [43.84, -99.30], // Pierre, SD area
      [42.50, -96.40], // Sioux City, IA
      [41.26, -95.93], // Omaha, NE / Council Bluffs, IA
      [39.10, -94.58], // Kansas City, MO
      [38.58, -92.17], // Jefferson City, MO
      [38.63, -90.20], // St. Louis, MO (mouth at Mississippi)
    ],
  },
  {
    name: 'Colorado River',
    // Rocky Mtn NP, CO → Gulf of California (terminates in MX, we stop at border)
    points: [
      [40.47, -105.82], // La Poudre Pass, CO (source area, Rocky Mtn NP)
      [40.06, -106.81], // Kremmling, CO
      [39.55, -107.78], // Glenwood Springs, CO
      [39.07, -108.55], // Grand Junction, CO (Gunnison joins)
      [38.57, -109.55], // Moab, UT
      [37.30, -110.10], // Lake Powell, UT/AZ
      [36.30, -112.60], // Grand Canyon, AZ
      [36.02, -114.74], // Hoover Dam / Lake Mead, NV/AZ
      [34.72, -114.50], // Needles, CA
      [33.69, -114.51], // Parker Dam area
      [32.72, -114.62], // Yuma, AZ (CA/AZ/MX corner — practical "mouth" for US viewport)
    ],
  },
  {
    name: 'Rio Grande',
    // San Juan Mtns, CO → Gulf of Mexico at Brownsville, TX
    points: [
      [37.80, -107.30], // San Juan Mtns, CO (source area)
      [37.62, -106.05], // Alamosa, CO
      [35.69, -105.94], // near Santa Fe / Española, NM
      [35.08, -106.65], // Albuquerque, NM
      [33.20, -107.25], // Truth or Consequences, NM
      [31.78, -106.50], // El Paso, TX (US/MX border begins)
      [29.55, -101.00], // Del Rio, TX
      [28.71, -100.50], // Eagle Pass, TX
      [27.50, -99.50],  // Laredo, TX
      [26.20, -97.95],  // McAllen, TX
      [25.95, -97.15],  // Brownsville, TX (mouth, Gulf of Mexico)
    ],
  },
  {
    name: 'Columbia River',
    // Canadian Rockies (enters US at WA border) → Pacific Ocean
    points: [
      [49.00, -117.63], // WA/BC border entry
      [48.65, -118.18], // Kettle Falls, WA
      [47.95, -118.98], // Grand Coulee Dam, WA
      [46.97, -119.00], // central WA bend
      [46.27, -119.27], // Richland/Tri-Cities, WA (Snake River joins)
      [45.65, -121.18], // The Dalles, OR/WA
      [45.71, -122.43], // Vancouver/Portland (Willamette joins)
      [46.18, -123.83], // Astoria, OR
      [46.25, -124.08], // mouth, Pacific Ocean
    ],
  },
  {
    name: 'Ohio River',
    // Pittsburgh, PA (forms at Allegheny+Monongahela) → Cairo, IL (joins Mississippi)
    points: [
      [40.44, -80.01], // Pittsburgh, PA (source — confluence)
      [40.06, -80.72], // Wheeling, WV
      [38.42, -82.43], // Huntington, WV
      [39.10, -84.51], // Cincinnati, OH
      [38.26, -85.76], // Louisville, KY
      [37.97, -87.57], // Evansville, IN
      [37.07, -88.60], // Paducah, KY (Tennessee River joins)
      [36.99, -89.13], // Cairo, IL (mouth — joins Mississippi)
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// LAKES — closed polygons. Counter-clockwise or clockwise, doesn't matter
// for SVG <polygon> fill.
// ---------------------------------------------------------------------------
export const LAKES: readonly LakeFeature[] = [
  {
    name: 'Lake Superior',
    points: [
      [46.74, -92.10], // Duluth, MN
      [47.40, -91.10],
      [47.95, -89.50],
      [48.15, -88.30],
      [48.32, -87.10], // Canadian (Ontario) shore north
      [48.50, -86.50],
      [48.45, -85.10],
      [48.00, -84.30],
      [46.93, -84.55], // Sault Ste. Marie (east outlet)
      [46.55, -85.40], // MI Upper Peninsula north shore
      [46.85, -86.50],
      [46.70, -88.10],
      [46.95, -89.50],
      [46.75, -90.80],
    ],
  },
  {
    name: 'Lake Michigan',
    points: [
      [45.85, -84.75], // Straits of Mackinac (north tip)
      [45.30, -86.70], // WI Door Peninsula entrance
      [44.85, -87.40], // Green Bay, WI
      [43.78, -87.70], // Sheboygan, WI
      [43.04, -87.91], // Milwaukee, WI
      [42.50, -87.85], // Kenosha, WI
      [41.88, -87.62], // Chicago, IL (south end)
      [41.61, -87.30], // Gary, IN
      [42.30, -86.25], // SW MI coast
      [43.30, -86.30], // Muskegon, MI
      [44.30, -86.20], // northern MI coast
      [45.10, -85.55], // Sleeping Bear area
      [45.78, -85.00],
    ],
  },
  {
    name: 'Lake Huron',
    points: [
      [45.85, -84.40], // Straits of Mackinac
      [46.10, -83.50],
      [46.35, -82.70], // North Channel, Ontario
      [45.85, -81.85],
      [44.95, -81.30], // Bruce Peninsula tip, ON
      [44.50, -81.50],
      [43.85, -81.70], // Goderich, ON
      [43.00, -82.42], // Port Huron / Sarnia (south outlet to L. St. Clair)
      [43.95, -83.30], // Saginaw Bay south
      [44.35, -83.40], // Tawas Point area
      [45.05, -83.45], // Alpena, MI
      [45.65, -84.05], // Cheboygan, MI
    ],
  },
  {
    name: 'Lake Erie',
    points: [
      [42.95, -83.00], // Port Huron / Detroit River entry (NW)
      [42.30, -83.05], // Detroit, MI
      [41.66, -83.55], // Toledo, OH (west end)
      [41.50, -82.70], // Sandusky, OH
      [41.50, -81.70], // Cleveland, OH
      [42.10, -80.10], // Erie, PA
      [42.88, -78.88], // Buffalo, NY (east outlet to Niagara)
      [42.85, -79.55], // Long Point, ON
      [42.30, -81.50], // Point Pelee area, ON
      [42.05, -82.50], // ON southwest shore
    ],
  },
  {
    name: 'Lake Ontario',
    points: [
      [43.25, -79.05], // Hamilton, ON (west end)
      [43.65, -79.40], // Toronto, ON
      [44.15, -77.60], // Prince Edward County, ON
      [44.22, -76.50], // Kingston, ON (east outlet to St. Lawrence)
      [43.85, -76.20], // Sackets Harbor, NY
      [43.30, -76.40], // Oswego, NY
      [43.27, -77.60], // Rochester, NY
      [43.20, -78.70], // Wilson, NY
      [43.15, -79.07], // mouth of Niagara River, NY
    ],
  },
  {
    name: 'Great Salt Lake',
    points: [
      [41.70, -112.85], // NW corner
      [41.75, -112.40],
      [41.60, -112.20],
      [41.30, -112.20], // Antelope Island area
      [41.10, -112.30],
      [40.78, -112.40], // SE corner near SLC
      [40.85, -112.65],
      [41.20, -112.85],
      [41.45, -113.00],
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// MOUNTAIN RANGES — rough outline polygons. These are approximations of
// where the range visually sits, not surveyed boundaries. Filled tan with
// low opacity so state outlines remain readable beneath.
// ---------------------------------------------------------------------------
export const MOUNTAIN_RANGES: readonly MountainFeature[] = [
  {
    name: 'Rocky Mountains',
    // Sprawling N-S spine from MT down through NM. Long thin polygon.
    points: [
      [48.95, -114.20], // NW MT (Glacier NP area)
      [48.95, -112.50],
      [47.00, -111.00], // central MT front range
      [44.50, -110.50], // Yellowstone, WY
      [42.50, -109.50], // Wind River, WY
      [40.80, -106.30], // northern CO Rockies
      [39.20, -105.60], // Front Range CO
      [37.50, -106.20], // San Juans, CO
      [35.80, -106.20], // Sangre de Cristo, NM
      [33.50, -105.70], // southern NM tail
      [33.50, -107.50], // sweep back west
      [36.00, -108.50], // western CO/NM
      [39.50, -108.50], // western CO
      [43.50, -111.50], // Tetons, WY/ID
      [46.00, -113.50], // ID/MT
      [48.20, -114.80], // closing NW
    ],
  },
  {
    name: 'Appalachian Mountains',
    // Long thin diagonal from AL up through ME.
    points: [
      [33.50, -86.50], // northern AL
      [34.60, -84.20], // northern GA
      [35.60, -83.30], // Great Smokies, TN/NC
      [37.00, -81.50], // SW VA
      [38.50, -79.50], // WV/VA
      [40.30, -78.30], // central PA
      [41.50, -75.50], // NE PA / Catskills, NY
      [43.20, -74.20], // Adirondacks, NY (often grouped culturally)
      [44.30, -72.80], // Green Mtns, VT
      [44.50, -71.20], // White Mtns, NH
      [45.50, -69.50], // central ME
      [44.80, -69.00], // ME tail
      [43.20, -71.50], // sweep back south
      [41.50, -74.20],
      [39.50, -77.00],
      [37.50, -79.50],
      [35.20, -82.20],
      [33.80, -85.00],
    ],
  },
  {
    name: 'Sierra Nevada',
    // Eastern CA spine, ~400mi long N-S.
    points: [
      [40.30, -120.50], // northern end, Lassen area
      [39.30, -120.20], // Lake Tahoe
      [38.30, -119.50], // central
      [37.50, -118.80], // Mammoth area
      [36.50, -118.30], // Mt. Whitney area
      [35.80, -118.00], // southern Sierras
      [35.50, -118.20],
      [36.30, -118.80],
      [37.50, -119.50], // Yosemite area
      [38.80, -120.30],
      [40.00, -120.90],
    ],
  },
  {
    name: 'Cascade Range',
    // PNW: northern CA → WA, through OR.
    points: [
      [49.00, -121.00], // N WA border
      [48.30, -120.80], // North Cascades
      [47.40, -121.00],
      [46.85, -121.75], // Mt. Rainier, WA
      [46.20, -122.20], // Mt. St. Helens, WA
      [45.40, -121.70], // Mt. Hood, OR
      [44.20, -121.80], // Three Sisters, OR
      [43.00, -122.10], // Crater Lake, OR
      [41.40, -122.20], // Mt. Shasta, CA
      [40.50, -121.50], // Lassen, CA (southern tail)
      [41.50, -121.70],
      [43.50, -122.50],
      [45.30, -122.40],
      [47.00, -121.80],
      [48.50, -121.30],
    ],
  },
] as const;
