/** Static reference points, the same category of fact as the hardcoded
    coordinates already in data/districts/uganda-districts.json — stable
    geography, not something a live API call verifies. Each entry's
    parentDistrictSlug is picked by hand (not left to runtime
    nearest-district guessing) since we already know the right district. */

export interface PointOfInterest {
  key: string;
  name: string;
  lat: number;
  lon: number;
  label: string;
  parentDistrictSlug: string;
  /** One factual sentence, sourced from the managing authority's own
      description of the place, not invented copy. */
  blurb: string;
}

export interface MountainPeak extends PointOfInterest {
  elevationM: number;
}

export interface AirportPoint {
  key: string;
  name: string;
  icao: string;
  lat: number;
  lon: number;
  label: string;
  parentDistrictSlug: string;
}

// Uganda Wildlife Authority's 10 official national parks, coordinates at
// each park's headquarters or main entrance gate.
export const NATIONAL_PARKS: PointOfInterest[] = [
  {
    key: "bwindi-impenetrable",
    name: "Bwindi Impenetrable",
    lat: -1.0356,
    lon: 29.6041,
    label: "Buhoma, Kanungu",
    parentDistrictSlug: "kanungu",
    blurb: "A UNESCO World Heritage rainforest, home to roughly half the world's mountain gorillas.",
  },
  {
    key: "queen-elizabeth",
    name: "Queen Elizabeth",
    lat: -0.1833,
    lon: 29.895,
    label: "Mweya, Kasese",
    parentDistrictSlug: "kasese",
    blurb: "Uganda's most visited park, spanning crater lakes, savanna, and the Kazinga Channel.",
  },
  {
    key: "murchison-falls",
    name: "Murchison Falls",
    lat: 2.2833,
    lon: 31.5667,
    label: "Paraa, Nwoya",
    parentDistrictSlug: "nwoya",
    blurb: "Uganda's largest national park, named for the point where the Nile forces through a narrow gorge.",
  },
  {
    key: "kidepo-valley",
    name: "Kidepo Valley",
    lat: 3.85,
    lon: 33.75,
    label: "Apoka, Kaabong",
    parentDistrictSlug: "kaabong",
    blurb: "A remote savanna park in the far northeast, bordering South Sudan and Kenya.",
  },
  {
    key: "kibale",
    name: "Kibale",
    lat: 0.5167,
    lon: 30.4167,
    label: "Kanyanchu, Kabarole",
    parentDistrictSlug: "kabarole",
    blurb: "Uganda's primate capital, with the highest density and diversity of primates in East Africa.",
  },
  {
    key: "mount-elgon",
    name: "Mount Elgon",
    lat: 1.1333,
    lon: 34.5333,
    label: "Budadiri, Mbale",
    parentDistrictSlug: "mbale",
    blurb: "An extinct shield volcano straddling the Kenyan border, with one of the world's largest calderas.",
  },
  {
    key: "rwenzori-mountains",
    name: "Rwenzori Mountains",
    lat: 0.3833,
    lon: 29.9667,
    label: "Nyakalengija, Kasese",
    parentDistrictSlug: "kasese",
    blurb: "The Mountains of the Moon, Africa's tallest mountain range and a UNESCO World Heritage Site.",
  },
  {
    key: "semuliki",
    name: "Semuliki",
    lat: 0.8167,
    lon: 30.15,
    label: "Sempaya, Bundibugyo",
    parentDistrictSlug: "bundibugyo",
    blurb: "Lowland tropical forest on the Congo border, known for the Sempaya hot springs.",
  },
  {
    key: "mgahinga-gorilla",
    name: "Mgahinga Gorilla",
    lat: -1.3667,
    lon: 29.6333,
    label: "Ntebeko, Kisoro",
    parentDistrictSlug: "kisoro",
    blurb: "Uganda's smallest park, part of the Virunga volcanic range shared with Rwanda and DR Congo.",
  },
  {
    key: "lake-mburo",
    name: "Lake Mburo",
    lat: -0.6333,
    lon: 30.95,
    label: "Nshara, Kiruhura",
    parentDistrictSlug: "kiruhura",
    blurb: "A compact savanna park built around the lake, known for zebra and its walking safaris.",
  },
];

// Summit-level points, deliberately distinct from the park gate
// coordinates above — a different microclimate question (alpine summit
// conditions for climbers vs. savanna gate conditions for safari).
export const MOUNTAIN_PEAKS: MountainPeak[] = [
  {
    key: "margherita-peak",
    name: "Margherita Peak",
    lat: 0.3833,
    lon: 29.8667,
    label: "Rwenzori Mountains, Kasese",
    parentDistrictSlug: "kasese",
    elevationM: 5109,
    blurb: "Uganda's highest point and Africa's third-highest peak, permanently glaciated.",
  },
  {
    key: "wagagai-peak",
    name: "Wagagai Peak",
    lat: 1.1333,
    lon: 34.5167,
    label: "Mount Elgon, Kapchorwa",
    parentDistrictSlug: "kapchorwa",
    elevationM: 4321,
    blurb: "The highest point on Mount Elgon's caldera rim, on the Uganda side of the border.",
  },
  {
    key: "mount-muhabura",
    name: "Mount Muhabura",
    lat: -1.3806,
    lon: 29.6764,
    label: "Virunga range, Kisoro",
    parentDistrictSlug: "kisoro",
    elevationM: 4127,
    blurb: "A dormant volcano on the Rwanda border, the tallest of Uganda's Virunga peaks.",
  },
  {
    key: "mount-moroto",
    name: "Mount Moroto",
    lat: 2.5333,
    lon: 34.7333,
    label: "Karamoja, Moroto",
    parentDistrictSlug: "moroto",
    elevationM: 3084,
    blurb: "An extinct volcano rising sharply above the Karamoja plains.",
  },
  {
    key: "mount-kadam",
    name: "Mount Kadam",
    lat: 2.2333,
    lon: 34.7333,
    label: "Karamoja, Napak",
    parentDistrictSlug: "napak",
    elevationM: 3068,
    blurb: "Also known as Mount Napak, an isolated volcanic massif in eastern Karamoja.",
  },
];

// Only stations confirmed to be actively reporting METAR right now
// (verified against the live aviationweather.gov feed). A station that
// stops reporting is a one-line removal, not fabricated data.
export const AIRPORTS: AirportPoint[] = [
  {
    key: "entebbe",
    name: "Entebbe International",
    icao: "HUEN",
    lat: 0.036,
    lon: 32.437,
    label: "Entebbe",
    parentDistrictSlug: "entebbe",
  },
  {
    key: "gulu",
    name: "Gulu Airport",
    icao: "HUGU",
    lat: 2.798,
    lon: 32.275,
    label: "Gulu",
    parentDistrictSlug: "gulu",
  },
  {
    key: "kasese",
    name: "Kasese Airport",
    icao: "HUKS",
    lat: 0.183,
    lon: 30.1,
    label: "Kasese",
    parentDistrictSlug: "kasese",
  },
  {
    key: "soroti",
    name: "Soroti Airport",
    icao: "HUSO",
    lat: 1.725,
    lon: 33.622,
    label: "Soroti",
    parentDistrictSlug: "soroti",
  },
  {
    key: "mbarara",
    name: "Mbarara Airport",
    icao: "HUMA",
    lat: -0.555,
    lon: 30.6,
    label: "Mbarara",
    parentDistrictSlug: "mbarara",
  },
  {
    key: "arua",
    name: "Arua Airport",
    icao: "HUAR",
    lat: 3.049,
    lon: 30.913,
    label: "Arua",
    parentDistrictSlug: "arua",
  },
];
