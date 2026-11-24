import type { SupportedLocale } from "@/lib/i18n/types";
import type { District } from "@/types/weather";

/** Server rendered, per district reference content.
 *
 *  District pages used to carry almost no crawlable text: the weather values
 *  are fetched on the client, so a crawler saw the header, the disclaimer and
 *  the footer and nothing else. Structured data cannot rank a page that has no
 *  content, so this module derives real, factual copy for each district from
 *  the data we already hold (rainfall regime, agro zone, hazards, lake zone,
 *  region), giving every one of the 152 districts its own text instead of a
 *  shared template with the name swapped in.
 *
 *  Everything here describes typical climate patterns, not a forecast. Live
 *  conditions stay in the weather tiles. */

const REGION_LABEL: Record<District["region"], string> = {
  central: "Central",
  eastern: "Eastern",
  northern: "Northern",
  western: "Western",
};

type Rainfall = District["rainfallPattern"];

const RAINFALL_SEASONS: Record<Rainfall, string> = {
  bimodal:
    "two rainy seasons in a typical year: a long one from around March to May and a shorter one from around September to December, separated by drier months",
  unimodal:
    "one long rainy season in a typical year, running from around April to October, followed by a pronounced dry season",
};

const RAINFALL_SHORT: Record<Rainfall, string> = {
  bimodal: "two rainy seasons a year",
  unimodal: "one long rainy season a year",
};

const AGRO_ZONE_LABEL: Record<string, string> = {
  banana_coffee: "the banana and coffee region",
  banana_millet_cotton: "the banana, millet and cotton region",
  northern: "the northern cereal and legume region",
  west_nile: "the West Nile farming region",
  teso: "the Teso cereal and livestock region",
  karamoja: "the Karamoja dryland and pastoral region",
  mountain: "the highland farming region",
};

const AGRO_ZONE_NOTE: Record<string, string> = {
  banana_coffee:
    "Bananas and coffee dominate here, so growers watch the onset of each rainy season closely and plan mulching and weeding around it.",
  banana_millet_cotton:
    "Bananas, millet and cotton are common, and planting is usually timed to the first steady rains of a season rather than the first shower.",
  northern:
    "Cereals and legumes are the main crops, and the single long season means planting late is hard to recover from in the same year.",
  west_nile:
    "Mixed cropping is common, and rainfall can vary noticeably over short distances, so local timing matters more than a national average.",
  teso:
    "Cereals, cassava and livestock are central here, and both dry days during the season and heavy downpours affect planning.",
  karamoja:
    "This is a dryland pastoral area where water and pasture availability track the single rainy season, so early warning of a poor season matters.",
  mountain:
    "Altitude makes conditions cooler and wetter than nearby lowlands, and readings can differ sharply between a valley and a ridge.",
};

const HAZARD_NOTE: Record<string, string> = {
  drought: "long dry periods and drought",
  heat: "high daytime heat",
  lightning: "lightning during thunderstorms",
  landslide: "landslides on steep slopes after prolonged rain",
  flood: "flooding in low lying areas",
  hail: "hail during severe storms",
};

const LAKE_LABEL: Record<string, string> = {
  kyoga: "Lake Kyoga",
  albert: "Lake Albert",
  edward: "Lake Edward",
};

function listToProse(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function lakeFor(district: District): string | null {
  if (district.isLakeVictoriaZone) return "Lake Victoria";
  if (district.lakeZone) return LAKE_LABEL[district.lakeZone] ?? null;
  return null;
}

const REGION_LABEL_LG: Record<District["region"], string> = {
  central: "Masekkati",
  eastern: "Buvanjuba",
  northern: "Bukiikakkono",
  western: "Bugwanjuba",
};

const RAINFALL_SEASONS_LG: Record<Rainfall, string> = {
  bimodal:
    "sizoni bbiri ez'enkuba mu mwaka ogwa bulijjo: empanvu okuva mu Mugulansigo okutuuka mu Muzigo n'ennyimpi okuva mu Mutunda okutuuka mu Ntenvu, nga zaawulwamu emyezi emikalu",
  unimodal:
    "sizoni emu empanvu ey'enkuba mu mwaka ogwa bulijjo, okuva mu Kafuumuulampawu okutuuka mu Mukulukusabitungotungo, n'ekyeya eky'amaanyi oluvannyuma",
};

const RAINFALL_SHORT_LG: Record<Rainfall, string> = {
  bimodal: "sizoni bbiri ez'enkuba buli mwaka",
  unimodal: "sizoni emu empanvu ey'enkuba buli mwaka",
};

const AGRO_ZONE_LABEL_LG: Record<string, string> = {
  banana_coffee: "ekitundu ky'amatooke n'emmwanyi",
  banana_millet_cotton: "ekitundu ky'amatooke, obulo, ne ppamba",
  northern: "ekitundu ky'omu bukiikakkono ekirimirwamu emmere y'ensigo",
  west_nile: "ekitundu ky'ebyobulimi ekya West Nile",
  teso: "ekitundu kya Teso ekirimirwamu emmere n'okulunda ebisolo",
  karamoja: "ekitundu kya Karamoja ekikalu eky'abalunzi",
  mountain: "ekitundu ky'ebyobulimi eky'oku nsozi",
};

const AGRO_ZONE_NOTE_LG: Record<string, string> = {
  banana_coffee:
    "Amatooke n'emmwanyi bye bisinga okulimwa wano, era abalimi batunuulira nnyo entandikwa ya buli sizoni y'enkuba okutegeka okubikka n'okukoola.",
  banana_millet_cotton:
    "Amatooke, obulo, ne ppamba birina engeri gye bisigibwamu ng'enkuba entuufu etandise so si ku katonnyeze akasooka.",
  northern:
    "Emmere y'ensigo y'esinga okulimwa, era olw'okubeera nti waliwo sizoni emu empanvu, okusiga ekikeerezi kizibu okuddaabiriza mu mwaka ogwo gwennyini.",
  west_nile:
    "Okutabula ebirime kuliko wano, era enkuba eyinza okukyuka mangu mu bbanga ttono, n'olwekyo okutegeera obudde bw'ekitundu kikulu nnyo.",
  teso:
    "Emmere y'ensigo, muwogo, n'ebisolo bye bikulu wano, era ennaku enkalu mu makkati ga sizoni n'enkuba ey'amaanyi bikosa enteekateeka.",
  karamoja:
    "Kino kitundu kikalu eky'abalunzi awatali mazzi mangi ng'omuddo gukwatagana ne sizoni emu ey'enkuba, kale okulabulwa nga bukyali kikulu.",
  mountain:
    "Obuwanvu bw'ensozi buleeta obunnyogovu n'enkuba ennyingi okusinga ebiwonvu ebyetooloddewo, era ebipimo bisobola okwawukana nnyo wakati w'ekiwonvu n'olusozi.",
};

const HAZARD_NOTE_LG: Record<string, string> = {
  drought: "ebbanga eddene erikalu n'ekyeya",
  heat: "ebbugumu ery'amaanyi emisana",
  lightning: "eraddu mu biseera by'embuyaga n'okubwatuka",
  landslide: "okubumbulukuka kw'ettaka ku nsozi oluvannyuma lw'enkuba empanvu",
  flood: "amataba mu biwonvu",
  hail: "omuzira mu mbuyaga ez'amaanyi",
};

const LAKE_LABEL_LG: Record<string, string> = {
  kyoga: "Ennyanja Kyoga",
  albert: "Ennyanja Mwitanzige",
  edward: "Ennyanja Edward",
};

function listToProseLg(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ne ${items[items.length - 1]}`;
}

function lakeForLg(district: District): string | null {
  if (district.isLakeVictoriaZone) return "Ennyanja Nalubaale";
  if (district.lakeZone) return LAKE_LABEL_LG[district.lakeZone] ?? null;
  return null;
}

export interface DistrictContent {
  intro: string;
  seasons: string;
  farming: string;
  hazards: string | null;
  lake: string | null;
  faq: { question: string; answer: string }[];
}

export function buildDistrictContent(
  district: District,
  language: SupportedLocale = "en",
): DistrictContent {
  if (language === "lg") {
    const region = REGION_LABEL_LG[district.region];
    const zoneLabel = district.agroZone ? AGRO_ZONE_LABEL_LG[district.agroZone] : null;
    const lake = lakeForLg(district);
    const placePrefix = district.isCity ? "ekibuga" : "disitulikiti ya";

    const intro = [
      `${district.name} ${district.isCity ? "kibuga ekisangibwa" : "disitulikiti esangibwa"} mu kitundu kya ${region} ekya Uganda, ku bipimo bya latituudi ${district.coordinates.lat.toFixed(2)} ne lonjituudi ${district.coordinates.lon.toFixed(2)}.`,
      zoneLabel ? `${district.isCity ? "Kisangibwa" : "Esangibwa"} mu ${zoneLabel}.` : "",
      `Olupapula luno lulaga embeera y'obudde eya kati, ey'essaawa ku ssaawa, okulagulwa kw'ennaku 10, n'okulabula kwonna okw'obudde bw'akabi eri ${placePrefix} ${district.name}.`,
    ]
      .filter(Boolean)
      .join(" ");

    const seasons = `${district.name} ${district.isCity ? "kirina" : "erina"} ${RAINFALL_SEASONS_LG[district.rainfallPattern]}. Entandikwa entuufu ekyuka buli mwaka, kale okulagulwa okuli waggulu kwe kusinga okuyamba mu wiiki ejja.`;

    const farming = district.agroZone
      ? (AGRO_ZONE_NOTE_LG[district.agroZone] ??
        "Okusiga kutera okukolebwa ng'enkuba ya sizoni etandise okutonnya obutasalako so si ku katonnyeze kamu.")
      : "Okusiga kutera okukolebwa ng'enkuba ya sizoni etandise okutonnya obutasalako so si ku katonnyeze kamu.";

    const hazardLabels = district.hazards
      .map((hazard) => HAZARD_NOTE_LG[hazard])
      .filter((label): label is string => Boolean(label));

    const hazards =
      hazardLabels.length > 0
        ? `Obulabe bw'obudde obutera okulabulwako e ${district.name} mulimu ${listToProseLg(hazardLabels)}. Okulabula okw'akabi ku lupapula luno kuva mu mukutu gwa Uganda omutongole ogwa CAP bwe guba gukufulumizza.`
        : null;

    const lakeText = lake
      ? `${district.name} ${district.isCity ? "kiriraanye" : "eriraanye"} ${lake}, ng'empewo n'amayengo bisobola okukyuka amangu. Buli agenda ku mazzi asaanidde okusooka okukebera embeera y'okuvuba n'obukuumi bw'oku nnyanja nga tannasitula.`
      : null;

    const faq = [
      {
        question: `Sizoni y'enkuba e ${district.name} etandika ddi?`,
        answer: `${district.name} ${district.isCity ? "kirina" : "erina"} ${RAINFALL_SHORT_LG[district.rainfallPattern]}. Mu mwaka ogwa bulijjo ekyo kitegeeza ${RAINFALL_SEASONS_LG[district.rainfallPattern]}. Entandikwa ekyuka buli mwaka, kale kebera okulagulwa kw'ennaku 10 olabe embeera ya kati.`,
      },
      {
        question: `Embeera y'obudde e ${district.name} leero eri etya?`,
        answer: `Ebbugumu lya kati, omukisa gw'enkuba, obunnyogovu mu mpewo, n'empewo e ${district.name} biragibwa waggulu ku lupapula luno era biddamu okuzzibwa obuggya obudde bwonna. Olaba n'embeera y'essaawa ku ssaawa n'ey'ennaku 10.`,
      },
      {
        question: `Biki eby'obudde bw'akabi ebitera okutawaanya ${district.name}?`,
        answer:
          hazardLabels.length > 0
            ? `Obulabe obutera okweraliikiriza wano mulimu ${listToProseLg(hazardLabels)}. Okulabula okw'akabi okulagibwa ku lupapula luno kulagibwa ng'omukutu gwa Uganda omutongole gukufulumizza.`
            : `Okulabula kw'obudde bw'akabi kulagibwa ku lupapula luno buli omukutu gwa Uganda omutongole bwe gukufulumya e ${district.name}.`,
      },
      {
        question: `Okulagulwa kw'obudde e ${district.name} kuva wa?`,
        answer:
          "Okulagulwa kuva mu bitongole ebikola ku mbeera y'obudde nga bikolera wamu n'engeri y'okuddawo ng'ekimu kiremye, olupapula luleme kusigala nga lukalu. Okulabula okw'akabi kuva mu mukutu gwa Uganda omutongole ogwa CAP. Guno si mukutu mutongole ogwa UNMA.",
      },
    ];

    return { intro, seasons, farming, hazards, lake: lakeText, faq };
  }

  const region = REGION_LABEL[district.region];
  const zoneLabel = district.agroZone ? AGRO_ZONE_LABEL[district.agroZone] : null;
  const lake = lakeFor(district);

  const placeKind = district.isCity ? "city" : "district";

  const intro = [
    `${district.name} is a ${placeKind} in the ${region} region of Uganda, at about ${district.coordinates.lat.toFixed(2)} latitude and ${district.coordinates.lon.toFixed(2)} longitude.`,
    zoneLabel ? `It sits in ${zoneLabel}.` : "",
    `This page shows current conditions, an hourly outlook, a 10 day forecast and any active severe weather alerts for ${district.name}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const seasons = `${district.name} has ${RAINFALL_SEASONS[district.rainfallPattern]}. Actual onset shifts from year to year, so the forecast above is the better guide for the week ahead.`;

  const farming = district.agroZone
    ? (AGRO_ZONE_NOTE[district.agroZone] ??
      "Planting is usually timed to the onset of steady seasonal rains rather than an isolated shower.")
    : "Planting is usually timed to the onset of steady seasonal rains rather than an isolated shower.";

  const hazardLabels = district.hazards
    .map((hazard) => HAZARD_NOTE[hazard])
    .filter((label): label is string => Boolean(label));

  const hazards =
    hazardLabels.length > 0
      ? `Conditions most often flagged for ${district.name} include ${listToProse(hazardLabels)}. Severe weather alerts on this page come from Uganda's official CAP feed when one is active.`
      : null;

  const lakeText = lake
    ? `${district.name} borders ${lake}, where wind and wave conditions can change quickly. Anyone going out on the water should check the fishing safety view before setting off.`
    : null;

  const faq = [
    {
      question: `When is the rainy season in ${district.name}?`,
      answer: `${district.name} has ${RAINFALL_SHORT[district.rainfallPattern]}. In a typical year that means ${RAINFALL_SEASONS[district.rainfallPattern]}. Onset varies year to year, so check the 10 day forecast for the current outlook.`,
    },
    {
      question: `What is the weather like in ${district.name} today?`,
      answer: `Current temperature, rain chance, humidity and wind for ${district.name} are shown at the top of this page and refresh through the day. Hourly and 10 day views are available alongside them.`,
    },
    {
      question: `What weather hazards affect ${district.name}?`,
      answer:
        hazardLabels.length > 0
          ? `The conditions most often flagged here are ${listToProse(hazardLabels)}. Active severe weather alerts are shown on this page when Uganda's official feed issues one.`
          : `Active severe weather alerts are shown on this page whenever Uganda's official feed issues one for ${district.name}.`,
    },
    {
      question: `Where does the forecast for ${district.name} come from?`,
      answer:
        "Forecasts come from third party weather providers, with a fallback chain so a single provider outage does not leave the page empty. Severe weather alerts come from Uganda's official CAP feed. This is not an official UNMA service.",
    },
  ];

  return { intro, seasons, farming, hazards, lake: lakeText, faq };
}

/** FAQPage structured data so the district questions are eligible to appear
    as expandable results in search. */
export function districtFaqStructuredData(
  district: District,
  locale: "en" | "lg" = "en",
) {
  const { faq } = buildDistrictContent(district, locale);

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 155;

/** The page title without the "| Uganda Weather" ending the layout adds.
    The longer form is used only while the full title stays short enough for
    search results. */
export function districtSearchTitle(district: District): string {
  const full = `${district.name} Weather Today and 10 Day Forecast`;
  const ending = " | Uganda Weather";
  return full.length + ending.length <= MAX_TITLE_LENGTH ? full : `${district.name} Weather and Forecast`;
}

/** A search description made from this place's own facts, so every district
    reads differently and nothing is invented. Facts are added in order of
    usefulness while the text stays within what search results show. */
export function districtSearchDescription(district: District): string {
  const kind = district.isCity ? "city" : "district";
  const facts = [
    `${district.name} weather today, with hourly and 10 day forecasts and storm alerts.`,
    `A ${kind} in Uganda's ${REGION_LABEL[district.region]} region`,
  ];
  const lake = lakeFor(district);
  const extras = [
    lake ? ` on ${lake}` : "",
    ` with ${RAINFALL_SHORT[district.rainfallPattern]}`,
  ];
  let description = `${facts[0]} ${facts[1]}`;
  for (const extra of extras) {
    if (extra && `${description}${extra}.`.length <= MAX_DESCRIPTION_LENGTH) description += extra;
  }
  description += ".";
  return description.length <= MAX_DESCRIPTION_LENGTH ? description : facts[0];
}

/** Luganda search description, reusing the wording already checked for the
    district intro, with the region named in Luganda. */
export function districtSearchDescriptionLg(district: District): string {
  const region = REGION_LABEL_LG[district.region];
  const where = district.isCity ? "kibuga ekisangibwa" : "disitulikiti esangibwa";
  const full = `Embeera y'obudde e ${district.name} eya leero, essaawa ku ssaawa n'ennaku 10, n'okulabula. ${district.name} ${where} mu kitundu kya ${region} ekya Uganda.`;
  return full.length <= MAX_DESCRIPTION_LENGTH
    ? full
    : `Embeera y'obudde e ${district.name} eya leero, essaawa ku ssaawa n'ennaku 10, n'okulabula.`;
}
