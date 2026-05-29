// Supporting data for WorldMap.
//
// The Natural Earth 110m topojson (world-atlas v2) identifies countries by
// ISO 3166-1 numeric (M49) codes in feature.id. For consumer-facing APIs we
// prefer ISO 3166-1 alpha-3 (e.g. "FRA" not 250), so we ship a numeric→alpha-3
// lookup here.
//
// Coverage: every numeric id present in countries-110m.json (177 features,
// 175 with ids — N. Cyprus, Somaliland, and Kosovo are unrecognized states
// that ship without an ISO numeric in the topojson and therefore appear in
// the map as untinted/unidentified geometry).
//
// Continent assignment is by ISO-3 and used by CONTINENT_TINTS to auto-color
// the map in study mode. Bound territories (e.g. French Guiana, Greenland)
// are grouped by physical continent, not by their administering country.

export const NUMERIC_TO_ISO3: Record<string, string> = {
  '004': 'AFG', // Afghanistan
  '008': 'ALB', // Albania
  '010': 'ATA', // Antarctica
  '012': 'DZA', // Algeria
  '024': 'AGO', // Angola
  '031': 'AZE', // Azerbaijan
  '032': 'ARG', // Argentina
  '036': 'AUS', // Australia
  '040': 'AUT', // Austria
  '044': 'BHS', // Bahamas
  '050': 'BGD', // Bangladesh
  '051': 'ARM', // Armenia
  '056': 'BEL', // Belgium
  '064': 'BTN', // Bhutan
  '068': 'BOL', // Bolivia
  '070': 'BIH', // Bosnia and Herzegovina
  '072': 'BWA', // Botswana
  '076': 'BRA', // Brazil
  '084': 'BLZ', // Belize
  '090': 'SLB', // Solomon Islands
  '096': 'BRN', // Brunei
  '100': 'BGR', // Bulgaria
  '104': 'MMR', // Myanmar
  '108': 'BDI', // Burundi
  '112': 'BLR', // Belarus
  '116': 'KHM', // Cambodia
  '120': 'CMR', // Cameroon
  '124': 'CAN', // Canada
  '140': 'CAF', // Central African Republic
  '144': 'LKA', // Sri Lanka
  '148': 'TCD', // Chad
  '152': 'CHL', // Chile
  '156': 'CHN', // China
  '158': 'TWN', // Taiwan
  '170': 'COL', // Colombia
  '178': 'COG', // Republic of Congo
  '180': 'COD', // DR Congo
  '188': 'CRI', // Costa Rica
  '191': 'HRV', // Croatia
  '192': 'CUB', // Cuba
  '196': 'CYP', // Cyprus
  '203': 'CZE', // Czechia
  '204': 'BEN', // Benin
  '208': 'DNK', // Denmark
  '214': 'DOM', // Dominican Republic
  '218': 'ECU', // Ecuador
  '222': 'SLV', // El Salvador
  '226': 'GNQ', // Equatorial Guinea
  '231': 'ETH', // Ethiopia
  '232': 'ERI', // Eritrea
  '233': 'EST', // Estonia
  '238': 'FLK', // Falkland Islands
  '242': 'FJI', // Fiji
  '246': 'FIN', // Finland
  '250': 'FRA', // France
  '260': 'ATF', // French Southern Territories
  '262': 'DJI', // Djibouti
  '266': 'GAB', // Gabon
  '268': 'GEO', // Georgia
  '270': 'GMB', // Gambia
  '275': 'PSE', // Palestine
  '276': 'DEU', // Germany
  '288': 'GHA', // Ghana
  '300': 'GRC', // Greece
  '304': 'GRL', // Greenland
  '320': 'GTM', // Guatemala
  '324': 'GIN', // Guinea
  '328': 'GUY', // Guyana
  '332': 'HTI', // Haiti
  '340': 'HND', // Honduras
  '348': 'HUN', // Hungary
  '352': 'ISL', // Iceland
  '356': 'IND', // India
  '360': 'IDN', // Indonesia
  '364': 'IRN', // Iran
  '368': 'IRQ', // Iraq
  '372': 'IRL', // Ireland
  '376': 'ISR', // Israel
  '380': 'ITA', // Italy
  '384': 'CIV', // Cote d'Ivoire
  '388': 'JAM', // Jamaica
  '392': 'JPN', // Japan
  '398': 'KAZ', // Kazakhstan
  '400': 'JOR', // Jordan
  '404': 'KEN', // Kenya
  '408': 'PRK', // North Korea
  '410': 'KOR', // South Korea
  '414': 'KWT', // Kuwait
  '417': 'KGZ', // Kyrgyzstan
  '418': 'LAO', // Laos
  '422': 'LBN', // Lebanon
  '426': 'LSO', // Lesotho
  '428': 'LVA', // Latvia
  '430': 'LBR', // Liberia
  '434': 'LBY', // Libya
  '440': 'LTU', // Lithuania
  '442': 'LUX', // Luxembourg
  '450': 'MDG', // Madagascar
  '454': 'MWI', // Malawi
  '458': 'MYS', // Malaysia
  '466': 'MLI', // Mali
  '478': 'MRT', // Mauritania
  '484': 'MEX', // Mexico
  '496': 'MNG', // Mongolia
  '498': 'MDA', // Moldova
  '499': 'MNE', // Montenegro
  '504': 'MAR', // Morocco
  '508': 'MOZ', // Mozambique
  '512': 'OMN', // Oman
  '516': 'NAM', // Namibia
  '524': 'NPL', // Nepal
  '528': 'NLD', // Netherlands
  '540': 'NCL', // New Caledonia
  '548': 'VUT', // Vanuatu
  '554': 'NZL', // New Zealand
  '558': 'NIC', // Nicaragua
  '562': 'NER', // Niger
  '566': 'NGA', // Nigeria
  '578': 'NOR', // Norway
  '586': 'PAK', // Pakistan
  '591': 'PAN', // Panama
  '598': 'PNG', // Papua New Guinea
  '600': 'PRY', // Paraguay
  '604': 'PER', // Peru
  '608': 'PHL', // Philippines
  '616': 'POL', // Poland
  '620': 'PRT', // Portugal
  '624': 'GNB', // Guinea-Bissau
  '626': 'TLS', // Timor-Leste
  '630': 'PRI', // Puerto Rico
  '634': 'QAT', // Qatar
  '642': 'ROU', // Romania
  '643': 'RUS', // Russia
  '646': 'RWA', // Rwanda
  '682': 'SAU', // Saudi Arabia
  '686': 'SEN', // Senegal
  '688': 'SRB', // Serbia
  '694': 'SLE', // Sierra Leone
  '703': 'SVK', // Slovakia
  '704': 'VNM', // Vietnam
  '705': 'SVN', // Slovenia
  '706': 'SOM', // Somalia
  '710': 'ZAF', // South Africa
  '716': 'ZWE', // Zimbabwe
  '724': 'ESP', // Spain
  '728': 'SSD', // South Sudan
  '729': 'SDN', // Sudan
  '732': 'ESH', // Western Sahara
  '740': 'SUR', // Suriname
  '748': 'SWZ', // Eswatini
  '752': 'SWE', // Sweden
  '756': 'CHE', // Switzerland
  '760': 'SYR', // Syria
  '762': 'TJK', // Tajikistan
  '764': 'THA', // Thailand
  '768': 'TGO', // Togo
  '780': 'TTO', // Trinidad and Tobago
  '784': 'ARE', // United Arab Emirates
  '788': 'TUN', // Tunisia
  '792': 'TUR', // Turkey
  '795': 'TKM', // Turkmenistan
  '800': 'UGA', // Uganda
  '804': 'UKR', // Ukraine
  '807': 'MKD', // North Macedonia
  '818': 'EGY', // Egypt
  '826': 'GBR', // United Kingdom
  '834': 'TZA', // Tanzania
  '840': 'USA', // United States
  '854': 'BFA', // Burkina Faso
  '858': 'URY', // Uruguay
  '860': 'UZB', // Uzbekistan
  '862': 'VEN', // Venezuela
  '887': 'YEM', // Yemen
  '894': 'ZMB', // Zambia
};

// ISO-3 → continent. Used by callers building continentTints maps and by the
// component for default labels. North/South America are split; Russia is
// classified as Europe (consistent with most kid-geography curricula); Turkey
// is Asia; Egypt is Africa.
export const ISO3_TO_CONTINENT: Record<string, string> = {
  // Africa
  DZA: 'Africa', AGO: 'Africa', BEN: 'Africa', BWA: 'Africa', BFA: 'Africa',
  BDI: 'Africa', CMR: 'Africa', CAF: 'Africa', TCD: 'Africa', COG: 'Africa',
  COD: 'Africa', CIV: 'Africa', DJI: 'Africa', EGY: 'Africa', GNQ: 'Africa',
  ERI: 'Africa', SWZ: 'Africa', ETH: 'Africa', GAB: 'Africa', GMB: 'Africa',
  GHA: 'Africa', GIN: 'Africa', GNB: 'Africa', KEN: 'Africa', LSO: 'Africa',
  LBR: 'Africa', LBY: 'Africa', MDG: 'Africa', MWI: 'Africa', MLI: 'Africa',
  MRT: 'Africa', MAR: 'Africa', MOZ: 'Africa', NAM: 'Africa', NER: 'Africa',
  NGA: 'Africa', RWA: 'Africa', SEN: 'Africa', SLE: 'Africa', SOM: 'Africa',
  ZAF: 'Africa', SSD: 'Africa', SDN: 'Africa', TZA: 'Africa', TGO: 'Africa',
  TUN: 'Africa', UGA: 'Africa', ZMB: 'Africa', ZWE: 'Africa', ESH: 'Africa',

  // Antarctica
  ATA: 'Antarctica', ATF: 'Antarctica',

  // Asia
  AFG: 'Asia', ARM: 'Asia', AZE: 'Asia', BHR: 'Asia', BGD: 'Asia',
  BTN: 'Asia', BRN: 'Asia', KHM: 'Asia', CHN: 'Asia', CYP: 'Asia',
  GEO: 'Asia', IND: 'Asia', IDN: 'Asia', IRN: 'Asia', IRQ: 'Asia',
  ISR: 'Asia', JPN: 'Asia', JOR: 'Asia', KAZ: 'Asia', PRK: 'Asia',
  KOR: 'Asia', KWT: 'Asia', KGZ: 'Asia', LAO: 'Asia', LBN: 'Asia',
  MYS: 'Asia', MNG: 'Asia', MMR: 'Asia', NPL: 'Asia', OMN: 'Asia',
  PAK: 'Asia', PSE: 'Asia', PHL: 'Asia', QAT: 'Asia', SAU: 'Asia',
  LKA: 'Asia', SYR: 'Asia', TWN: 'Asia', TJK: 'Asia', THA: 'Asia',
  TLS: 'Asia', TUR: 'Asia', TKM: 'Asia', ARE: 'Asia', UZB: 'Asia',
  VNM: 'Asia', YEM: 'Asia',

  // Europe
  ALB: 'Europe', AUT: 'Europe', BLR: 'Europe', BEL: 'Europe', BIH: 'Europe',
  BGR: 'Europe', HRV: 'Europe', CZE: 'Europe', DNK: 'Europe', EST: 'Europe',
  FIN: 'Europe', FRA: 'Europe', DEU: 'Europe', GRC: 'Europe', HUN: 'Europe',
  ISL: 'Europe', IRL: 'Europe', ITA: 'Europe', LVA: 'Europe', LTU: 'Europe',
  LUX: 'Europe', MDA: 'Europe', MNE: 'Europe', NLD: 'Europe', MKD: 'Europe',
  NOR: 'Europe', POL: 'Europe', PRT: 'Europe', ROU: 'Europe', RUS: 'Europe',
  SRB: 'Europe', SVK: 'Europe', SVN: 'Europe', ESP: 'Europe', SWE: 'Europe',
  CHE: 'Europe', UKR: 'Europe', GBR: 'Europe',

  // North America
  BHS: 'North America', BLZ: 'North America', CAN: 'North America',
  CRI: 'North America', CUB: 'North America', DOM: 'North America',
  SLV: 'North America', GRL: 'North America', GTM: 'North America',
  HTI: 'North America', HND: 'North America', JAM: 'North America',
  MEX: 'North America', NIC: 'North America', PAN: 'North America',
  PRI: 'North America', TTO: 'North America', USA: 'North America',

  // Oceania
  AUS: 'Oceania', FJI: 'Oceania', NCL: 'Oceania', NZL: 'Oceania',
  PNG: 'Oceania', SLB: 'Oceania', VUT: 'Oceania',

  // South America
  ARG: 'South America', BOL: 'South America', BRA: 'South America',
  CHL: 'South America', COL: 'South America', ECU: 'South America',
  FLK: 'South America', GUY: 'South America', PRY: 'South America',
  PER: 'South America', SUR: 'South America', URY: 'South America',
  VEN: 'South America',
};

// Countries that get labels rendered when showCountryLabels is true. Tiny
// states (Luxembourg, Brunei, etc.) and disputed/uninhabited polygons get
// no label to keep the world map readable at the default ~960x540 viewport.
// Heuristic threshold: > ~200,000 km^2 OR globally recognizable name.
export const LABELED_COUNTRIES: ReadonlySet<string> = new Set([
  // Big or iconic
  'USA', 'CAN', 'MEX', 'BRA', 'ARG', 'CHL', 'COL', 'PER', 'VEN',
  'GBR', 'FRA', 'DEU', 'ESP', 'ITA', 'POL', 'UKR', 'SWE', 'NOR', 'FIN',
  'RUS', 'CHN', 'IND', 'JPN', 'KOR', 'PRK', 'MNG', 'KAZ', 'IRN', 'SAU',
  'TUR', 'EGY', 'LBY', 'DZA', 'MAR', 'NGA', 'COD', 'ETH', 'KEN', 'TZA',
  'ZAF', 'NAM', 'AGO', 'MDG', 'SDN', 'SSD',
  'AUS', 'NZL', 'IDN', 'PHL', 'PNG', 'THA', 'VNM', 'MMR', 'PAK', 'AFG',
  'IRQ', 'GRL', 'ISL',
]);
