// Hand-authored physical-feature coordinates for the World Study Map overlay.
//
// Mirrors physicalFeaturesData.ts (US) in shape: every feature is a list of
// [latitude, longitude] points. WorldPhysicalLayer projects them through the
// SAME projection WorldMap uses (geoEqualEarth / geoMercator /
// geoNaturalEarth1) so they line up with the country paths underneath.
//
// Precision target: "a kid can recognize the river/range from across the
// room." Wikipedia article maps + general atlas tracings.
//
// Note on the few features that overlap the US set (Mississippi, Lake
// Superior, Rocky Mountains): we re-list them at world scale here because
// PhysicalLayer.tsx only fires on the US map and uses Albers USA. The world
// renderer needs its own coordinates projected through the world projection.

export type LatLon = readonly [number, number]; // [lat, lon]

export type WorldRiverFeature = {
  readonly name: string;
  readonly points: readonly LatLon[];
};

export type WorldLakeFeature = {
  readonly name: string;
  readonly points: readonly LatLon[]; // closed polygon
};

export type WorldMountainFeature = {
  readonly name: string;
  readonly points: readonly LatLon[]; // closed polygon outlining the range
};

export type WorldDesertFeature = {
  readonly name: string;
  readonly points: readonly LatLon[]; // closed polygon
};

// ---------------------------------------------------------------------------
// RIVERS — source → mouth, polyline.
// ---------------------------------------------------------------------------
export const WORLD_RIVERS: readonly WorldRiverFeature[] = [
  {
    name: 'Nile',
    // Lake Victoria area → Mediterranean delta in Egypt.
    points: [
      [-0.50, 33.20],  // Lake Victoria outlet, Uganda (White Nile source)
      [3.50, 31.70],   // Juba, South Sudan
      [9.60, 31.70],   // Malakal, South Sudan
      [12.30, 33.20],  // confluence at Khartoum (Blue + White Nile)
      [15.60, 32.55],  // Khartoum, Sudan
      [18.50, 30.70],  // Atbara, Sudan
      [22.30, 31.60],  // Lake Nasser, Egypt/Sudan border
      [24.10, 32.90],  // Aswan, Egypt
      [27.20, 31.20],  // Sohag, Egypt
      [29.30, 31.20],  // Beni Suef, Egypt
      [30.05, 31.25],  // Cairo, Egypt
      [31.40, 30.40],  // Nile delta, Mediterranean coast
    ],
  },
  {
    name: 'Amazon',
    // Andean headwaters in Peru → Atlantic mouth in Brazil.
    points: [
      [-10.60, -73.50], // Andean headwaters, Peru
      [-8.30, -74.50],  // Ucayali River area, Peru
      [-5.20, -75.50],  // Iquitos area, Peru
      [-4.30, -70.00],  // tri-border Brazil/Colombia/Peru
      [-3.50, -64.50],  // Tefé, Brazil
      [-3.10, -60.00],  // Manaus, Brazil (Rio Negro joins)
      [-2.50, -54.70],  // Santarém, Brazil
      [-1.80, -52.20],  // Almeirim, Brazil
      [-0.90, -50.10],  // Belém / Amazon delta area, Brazil
      [-0.20, -48.50],  // Atlantic mouth, Brazil
    ],
  },
  {
    name: 'Yangtze',
    // Tibetan Plateau → East China Sea at Shanghai.
    points: [
      [33.40, 91.00],  // Tibetan Plateau headwaters
      [32.20, 97.00],  // Qinghai, China
      [28.20, 99.00],  // Yunnan, China (Three Parallel Rivers area)
      [27.70, 102.00], // Panzhihua area
      [29.60, 104.00], // Yibin, Sichuan
      [29.50, 106.50], // Chongqing
      [30.80, 111.30], // Three Gorges Dam, Yichang
      [30.60, 114.30], // Wuhan, China
      [32.05, 118.80], // Nanjing, China
      [31.20, 121.50], // Shanghai, mouth at East China Sea
    ],
  },
  {
    name: 'Mississippi',
    // Re-stated at world scale (USPhysicalLayer also has it).
    // Lake Itasca, MN → Gulf of Mexico, LA.
    points: [
      [47.24, -95.21],
      [44.98, -93.27],
      [41.52, -90.58],
      [38.63, -90.20],
      [35.15, -90.05],
      [32.36, -91.04],
      [29.95, -90.07],
      [29.15, -89.25],
    ],
  },
  {
    name: 'Volga',
    // Valdai Hills, Russia → Caspian Sea delta near Astrakhan.
    points: [
      [57.20, 32.50],  // Valdai Hills, Russia (source)
      [57.60, 38.40],  // Rybinsk, Russia
      [56.30, 44.00],  // Nizhny Novgorod, Russia
      [55.80, 49.10],  // Kazan, Russia
      [53.20, 50.10],  // Samara, Russia
      [51.50, 46.00],  // Saratov, Russia
      [48.70, 44.50],  // Volgograd, Russia
      [46.30, 48.00],  // Astrakhan, Russia
      [45.80, 47.95],  // Caspian Sea delta mouth
    ],
  },
  {
    name: 'Ganges',
    // Himalayas → Bay of Bengal at Sundarbans delta.
    points: [
      [30.99, 78.97],  // Gangotri Glacier source, Uttarakhand, India
      [29.95, 78.16],  // Haridwar, India
      [27.18, 78.02],  // Agra area (close to Yamuna)
      [25.32, 82.97],  // Varanasi, India
      [25.60, 85.10],  // Patna, India
      [24.50, 88.30],  // Farakka, India/Bangladesh
      [23.40, 89.30],  // central Bangladesh
      [22.50, 90.50],  // Padma River, Bangladesh
      [21.80, 89.40],  // Sundarbans delta mouth, Bay of Bengal
    ],
  },
  {
    name: 'Danube',
    // Black Forest, Germany → Black Sea delta in Romania.
    points: [
      [48.10, 8.15],   // Black Forest source, Germany
      [48.60, 11.40],  // Ingolstadt, Germany
      [48.20, 16.37],  // Vienna, Austria
      [47.50, 19.05],  // Budapest, Hungary
      [45.25, 19.83],  // Novi Sad, Serbia
      [44.81, 20.46],  // Belgrade, Serbia
      [44.62, 22.66],  // Iron Gates, Romania/Serbia
      [43.85, 25.95],  // Ruse, Bulgaria
      [44.20, 28.65],  // Cernavoda, Romania
      [45.20, 29.65],  // Tulcea / Danube delta, Romania
      [45.20, 29.80],  // mouth at Black Sea
    ],
  },
  {
    name: 'Rhine',
    // Swiss Alps → North Sea at Rotterdam.
    points: [
      [46.60, 8.70],   // Swiss Alps source area
      [47.55, 9.55],   // Lake Constance, Germany/Switzerland
      [47.55, 7.59],   // Basel, Switzerland
      [49.00, 8.40],   // Karlsruhe, Germany
      [49.40, 8.60],   // Mannheim, Germany
      [50.10, 8.65],   // Mainz/Frankfurt area
      [50.74, 7.10],   // Bonn, Germany
      [51.23, 6.78],   // Düsseldorf, Germany
      [51.70, 5.30],   // Nijmegen, Netherlands
      [51.92, 4.48],   // Rotterdam, Netherlands
      [52.00, 4.10],   // North Sea mouth
    ],
  },
  {
    name: 'Niger',
    // Guinea Highlands → Niger Delta at Gulf of Guinea.
    points: [
      [9.10, -10.70],  // Guinea Highlands source
      [11.30, -7.80],  // Bamako, Mali
      [13.50, -4.20],  // Ségou, Mali
      [16.30, -4.30],  // Timbuktu, Mali (Niger bend)
      [16.95, 0.05],   // Gao, Mali
      [13.50, 2.10],   // Niamey, Niger
      [9.05, 4.70],    // central Nigeria
      [7.80, 6.70],    // Lokoja, Nigeria (Benue joins)
      [5.30, 6.40],    // Niger Delta head
      [4.30, 6.40],    // Niger Delta mouth, Gulf of Guinea
    ],
  },
  {
    name: 'Yenisei',
    // Sayan Mountains → Kara Sea (Arctic Ocean).
    points: [
      [51.70, 94.40],  // Sayan Mountains source area, Tuva, Russia
      [55.00, 92.90],  // Krasnoyarsk, Russia
      [58.20, 92.50],  // Yeniseysk, Russia
      [61.60, 90.10],  // Lesosibirsk
      [66.00, 86.30],  // Turukhansk, Russia
      [69.30, 86.20],  // Dudinka, Russia
      [71.50, 82.40],  // Yenisei estuary
      [73.50, 80.00],  // Kara Sea mouth, Arctic
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// LAKES (and inland seas) — closed polygons.
// ---------------------------------------------------------------------------
export const WORLD_LAKES: readonly WorldLakeFeature[] = [
  {
    name: 'Caspian Sea',
    // World's largest inland body of water. Long N-S between Russia, Kazakhstan,
    // Turkmenistan, Iran, Azerbaijan.
    points: [
      [47.20, 49.00],  // NE corner near Volga delta
      [45.50, 53.00],  // Mangyshlak Peninsula east coast
      [42.60, 53.00],  // central east, Kazakhstan
      [40.50, 53.20],  // SE near Turkmenistan
      [37.50, 53.90],  // SE Iranian coast
      [36.80, 53.00],  // S Iran shore
      [37.20, 50.50],  // SW Iran/Azerbaijan
      [38.50, 48.80],  // Baku, Azerbaijan
      [41.30, 49.00],  // mid west, Azerbaijan
      [43.80, 47.40],  // NW Russia coast
      [45.80, 47.50],  // Volga delta region
    ],
  },
  {
    name: 'Lake Superior',
    // Largest of the North American Great Lakes.
    points: [
      [46.74, -92.10],
      [47.95, -89.50],
      [48.32, -87.10],
      [48.50, -85.50],
      [46.93, -84.55],
      [46.85, -86.50],
      [46.70, -88.10],
      [46.75, -90.80],
    ],
  },
  {
    name: 'Lake Victoria',
    // Largest lake in Africa, ~roughly square. Bordered by Uganda, Kenya, Tanzania.
    points: [
      [-0.20, 32.30],  // NW corner, Uganda
      [-0.30, 34.10],  // NE corner, Kenya
      [-1.10, 34.30],  // E Kenya shore
      [-2.50, 33.20],  // SE Tanzania
      [-3.00, 32.20],  // S Tanzania, Mwanza Gulf
      [-2.20, 31.70],  // SW shore
      [-0.80, 31.60],  // W Uganda shore
    ],
  },
  {
    name: 'Lake Baikal',
    // World's deepest lake. Long, narrow NE-SW crescent in Siberia.
    points: [
      [55.80, 109.80], // NE tip
      [55.40, 109.40],
      [54.50, 108.50],
      [53.50, 107.50], // central east
      [52.40, 106.10],
      [51.70, 104.80],
      [51.50, 104.20], // SW tip
      [51.90, 104.20],
      [52.70, 105.80],
      [53.80, 107.30],
      [54.80, 108.40],
      [55.60, 109.20],
    ],
  },
  {
    name: 'Aral Sea',
    // Famously shrunken; shown roughly at mid-20th-century extent so kids get
    // the sense of size that informs the "what happened" story.
    points: [
      [46.80, 59.40],  // N
      [46.50, 61.50],  // NE
      [45.00, 62.00],  // E
      [43.50, 61.00],  // SE
      [43.30, 59.20],  // S
      [44.50, 58.50],  // SW
      [45.80, 58.30],  // W
    ],
  },
  {
    name: 'Lake Tanganyika',
    // Long, narrow N-S lake. World's longest freshwater lake. ~660km long.
    points: [
      [-3.30, 29.30],  // N tip, Burundi
      [-3.60, 29.40],
      [-4.90, 29.60], // upper NW, DRC
      [-5.90, 29.50],
      [-6.90, 29.80], // central west
      [-7.80, 30.50],
      [-8.50, 30.90], // S, Zambia
      [-8.80, 31.10],
      [-8.20, 31.00], // sweep back NE, Tanzania
      [-7.10, 30.70],
      [-6.00, 30.00],
      [-4.80, 29.80],
      [-3.50, 29.50],
    ],
  },
  {
    name: 'Black Sea',
    // Inland sea between SE Europe and W Asia.
    points: [
      [46.00, 31.00],  // NW, Ukraine Odesa region
      [46.50, 33.40],  // Crimea N coast
      [45.20, 36.50],  // E Crimea
      [43.30, 39.80],  // Sochi, Russia coast
      [41.70, 41.70],  // Batumi, Georgia
      [41.00, 39.70],  // Trabzon, Turkey
      [41.20, 36.30],  // central Turkey N coast
      [41.50, 32.50],  // Zonguldak, Turkey
      [41.20, 29.10],  // Bosphorus / Istanbul, Turkey
      [42.50, 27.50],  // Burgas, Bulgaria
      [44.10, 28.65],  // Constanta, Romania
      [45.30, 29.80],  // Danube delta
    ],
  },
  {
    name: 'Mediterranean Sea',
    // Treated as a giant lake-ish polygon so kids see its extent. Coarse
    // outline — just enough so it reads as the named body of water between
    // Europe, N. Africa, and the Middle East.
    points: [
      [36.10, -5.40],  // Strait of Gibraltar
      [37.00, 0.00],   // off Algerian coast
      [37.50, 5.00],   // central W Med
      [38.50, 9.00],   // Sardinia area
      [40.00, 12.00],  // Tyrrhenian Sea
      [38.00, 15.50],  // Sicily area
      [36.50, 18.00],  // Ionian Sea
      [35.50, 24.00],  // Crete area
      [33.50, 31.50],  // Egypt/Levant SE corner
      [34.50, 35.50],  // Lebanon/Cyprus
      [36.50, 33.00],  // S. Turkey coast
      [38.00, 27.00],  // Aegean Sea
      [40.50, 25.00],  // N. Aegean
      [42.00, 18.50],  // Adriatic head
      [44.50, 14.00],  // N. Adriatic
      [42.00, 9.00],   // Corsica area
      [42.50, 4.00],   // Gulf of Lion
      [40.00, -0.50],  // E Spain coast
      [37.00, -3.50],  // Costa del Sol
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// MOUNTAIN RANGES — rough outline polygons.
// ---------------------------------------------------------------------------
export const WORLD_MOUNTAIN_RANGES: readonly WorldMountainFeature[] = [
  {
    name: 'Himalayas',
    // Long arc across N. India / Nepal / Bhutan / S. Tibet.
    points: [
      [36.00, 74.00],  // NW Karakoram/Hindu Kush junction
      [35.50, 76.00],  // Ladakh
      [34.50, 78.50],  // W Himalaya
      [32.00, 80.50],
      [30.50, 82.00],  // central Himalaya
      [29.00, 85.00],  // Nepal
      [28.00, 88.00],  // Sikkim/Bhutan
      [27.50, 91.00],  // Bhutan
      [27.50, 95.00],  // E Himalaya, Arunachal Pradesh
      [28.50, 95.50],  // far E tip
      [29.50, 92.00],  // sweep back along N edge (Tibet)
      [30.50, 88.00],
      [31.50, 84.00],
      [33.00, 80.00],
      [34.50, 77.00],
      [35.50, 75.00],
    ],
  },
  {
    name: 'Andes',
    // World's longest mountain range. Western edge of S. America.
    points: [
      [10.50, -73.00],  // N Venezuela/Colombia start
      [5.00, -75.00],   // N Colombia
      [-1.00, -78.50],  // Ecuador
      [-9.00, -77.00],  // central Peru
      [-13.50, -73.00], // Cusco region
      [-17.50, -67.50], // Bolivia
      [-22.00, -68.00], // N Chile/Argentina
      [-27.00, -69.00], // Atacama region
      [-33.00, -70.00], // Santiago / Aconcagua
      [-40.00, -71.50], // Patagonia N
      [-45.00, -72.50], // Patagonia central
      [-50.00, -73.50], // Patagonia S
      [-54.50, -69.00], // Tierra del Fuego
      [-50.00, -71.00], // sweep back along east edge
      [-40.00, -69.50],
      [-30.00, -68.50],
      [-20.00, -66.00],
      [-10.00, -75.00],
      [0.00, -77.00],
      [7.00, -72.00],
    ],
  },
  {
    name: 'Rocky Mountains',
    // N America's western spine — BC down through NM.
    points: [
      [58.00, -125.50], // N BC
      [54.00, -122.00],
      [49.00, -114.50], // US/Canada border
      [47.00, -111.00],
      [44.50, -110.50],
      [40.80, -106.30],
      [37.50, -106.20],
      [33.50, -105.70], // S tail, NM
      [33.50, -107.50], // sweep back NW
      [39.50, -109.50],
      [44.00, -111.50],
      [48.00, -114.50],
      [52.00, -118.50],
      [56.00, -123.50],
    ],
  },
  {
    name: 'Alps',
    // Arc across Switzerland/France/Italy/Austria.
    points: [
      [44.20, 7.00],   // SW France
      [45.20, 6.50],   // French Alps
      [46.00, 7.00],   // Swiss border
      [46.50, 8.50],   // central Swiss Alps
      [47.00, 10.50],  // Austria W
      [47.30, 12.50],  // Austrian Alps
      [47.50, 14.00],  // Austria central
      [47.20, 15.50],  // Austria E
      [46.50, 14.50],  // sweep S along Italian/Slovenian edge
      [46.00, 12.50],  // Dolomites
      [45.80, 10.50],  // N Italy
      [45.50, 9.00],
      [44.80, 7.50],
    ],
  },
  {
    name: 'Ural Mountains',
    // Long N-S range that divides Europe from Asia in Russia.
    points: [
      [68.50, 65.50],  // N tip in tundra
      [66.00, 62.50],
      [64.00, 60.50],
      [61.00, 59.50],
      [58.00, 60.00],
      [55.00, 60.00],
      [52.50, 58.50],
      [50.50, 58.00],  // S Urals
      [50.50, 59.50],  // sweep back N along east edge
      [55.00, 62.00],
      [60.00, 62.00],
      [63.00, 64.00],
      [66.00, 65.00],
    ],
  },
  {
    name: 'Atlas Mountains',
    // Long arc across NW Africa: Morocco / Algeria / Tunisia.
    points: [
      [30.50, -8.50],  // SW Morocco
      [31.50, -7.50],  // High Atlas
      [33.00, -5.00],  // Middle Atlas, Morocco
      [34.50, -2.50],  // NE Morocco
      [35.20, 0.00],   // NW Algeria
      [35.80, 3.50],   // central Algeria
      [36.20, 6.00],   // E Algeria
      [36.50, 8.50],   // Tunisia
      [35.70, 9.50],   // sweep S
      [34.50, 5.00],   // Saharan Atlas
      [33.50, 1.50],
      [32.50, -2.00],
      [31.50, -5.50],
    ],
  },
  {
    name: 'Drakensberg',
    // Major mountain range in S. Africa / Lesotho.
    points: [
      [-25.80, 30.10],  // N edge, Mpumalanga
      [-27.00, 29.50],
      [-28.50, 29.20],  // Lesotho W edge
      [-29.80, 28.50],
      [-30.50, 28.00],
      [-31.00, 28.50],
      [-31.00, 29.80],  // sweep N
      [-29.80, 30.50],
      [-28.50, 30.30],
      [-27.20, 30.50],
    ],
  },
  {
    name: 'Great Dividing Range',
    // Eastern Australian highlands. N Queensland → Victoria.
    points: [
      [-16.00, 145.00], // N Queensland tropics
      [-19.00, 146.50], // Townsville area
      [-23.00, 148.50],
      [-27.00, 152.00], // SE Queensland
      [-31.50, 152.00], // NSW central
      [-35.50, 149.50], // ACT / Snowy Mts
      [-37.50, 147.00], // E Victoria
      [-37.30, 145.50], // central Victoria
      [-37.00, 144.50], // sweep back N along inland edge
      [-34.00, 149.50],
      [-30.00, 151.00],
      [-25.00, 149.50],
      [-20.00, 145.50],
      [-17.50, 144.50],
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// DESERTS — closed polygons. Drawn underneath rivers/lakes/mountains with
// very low opacity so country borders stay readable.
// ---------------------------------------------------------------------------
export const WORLD_DESERTS: readonly WorldDesertFeature[] = [
  {
    name: 'Sahara',
    // World's largest hot desert. Spans most of N. Africa.
    points: [
      [31.00, -16.00], // NW Atlantic coast (Western Sahara)
      [33.00, -5.00],  // N Morocco edge
      [34.50, 3.00],   // N Algeria
      [33.50, 10.00],  // S Tunisia
      [31.50, 20.00],  // N Libya
      [31.00, 30.00],  // N Egypt
      [22.00, 35.00],  // SE Egypt / Sudan
      [18.00, 38.00],  // E Sudan
      [14.50, 30.00],  // S Sudan edge
      [13.00, 22.00],  // Chad central
      [13.50, 14.00],  // N Nigeria edge
      [15.00, 0.00],   // N Niger
      [16.00, -10.00], // Mali / Mauritania
      [21.00, -16.00], // SW Mauritania coast
    ],
  },
  {
    name: 'Gobi',
    // Cold desert covering S. Mongolia and N. China.
    points: [
      [48.00, 89.00],  // NW Mongolia
      [48.50, 100.00], // N Mongolia
      [46.50, 110.00], // central Mongolia
      [43.50, 115.00], // SE Mongolia / Inner Mongolia
      [40.50, 113.00], // N China edge
      [39.00, 105.00], // Ordos area
      [40.00, 100.00], // Gansu Corridor
      [41.50, 95.00],  // W Gansu
      [43.00, 91.00],  // Xinjiang E edge
      [45.50, 90.00],  // sweep N
    ],
  },
  {
    name: 'Arabian Desert',
    // Covers most of the Arabian Peninsula.
    points: [
      [30.00, 36.00],  // NW Jordan/Saudi
      [31.00, 41.00],  // N Saudi
      [30.00, 46.00],  // NE Saudi/Iraq border
      [28.00, 49.50],  // E Saudi / Gulf
      [24.00, 55.00],  // UAE
      [20.00, 56.00],  // Oman
      [16.00, 53.00],  // S Oman/Yemen
      [13.00, 47.00],  // S Yemen
      [16.00, 43.00],  // SW Saudi
      [21.00, 39.50],  // Mecca region
      [25.00, 37.00],  // NW Saudi Red Sea coast
    ],
  },
  {
    name: 'Atacama',
    // Driest non-polar desert. Narrow coastal strip in N. Chile (also S. Peru).
    points: [
      [-17.50, -71.00], // S Peru / N Chile border
      [-19.00, -70.20], // Arica area
      [-22.00, -70.00], // Antofagasta region
      [-25.00, -70.40],
      [-27.50, -70.80], // S edge near Copiapó
      [-27.00, -69.50], // sweep inland
      [-24.00, -68.50], // Atacama plateau
      [-21.00, -68.80],
      [-18.50, -69.50],
    ],
  },
  {
    name: 'Australian Outback',
    // Loose region covering arid central Australia. Not a single named desert,
    // but a recognizable kid-level concept that ties together the Great
    // Victoria, Simpson, Tanami, Gibson, and Great Sandy deserts.
    points: [
      [-20.00, 121.00], // NW edge, Great Sandy Desert
      [-19.00, 130.00], // Tanami area, NT
      [-19.00, 138.00], // NE edge, NW Queensland
      [-23.00, 142.00], // central Queensland edge
      [-28.00, 141.00], // SW Queensland
      [-32.00, 140.00], // NE South Australia
      [-32.00, 130.00], // Nullarbor / Great Victoria
      [-29.00, 122.00], // central WA
      [-26.00, 119.00], // W Gibson Desert edge
      [-23.00, 118.00], // NW WA inland
    ],
  },
] as const;
