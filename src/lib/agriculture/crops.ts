import type { SoilMoistureLevel } from "@/lib/agriculture/advisory";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { SupportedLocale } from "@/lib/i18n/types";
import type { WeatherBundle } from "@/types/weather";

export type CropId =
  | "maize"
  | "coffee"
  | "beans"
  | "cassava"
  | "cotton"
  | "banana"
  | "millet"
  | "sorghum"
  | "cowpeas"
  | "sesame"
  | "rice"
  | "groundnuts"
  | "irish potato";
export type CropStatus = "good" | "caution" | "hold";

export interface CropAdvisory {
  id: CropId;
  name: string;
  status: CropStatus;
  statusLabel: string;
  summary: string;
}

interface CropContext {
  language: SupportedLocale;
  seasonName: string;
  soil: SoilMoistureLevel;
  rainMm: number;
  rainChance: number;
  tempC: number;
  isStorm: boolean;
  isDrySeason: boolean;
  isPlantingSeason: boolean;
  agroZone: string;
}

function maizeAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.isStorm) {
    return summary(
      ctx,
      "maize",
      "caution",
      "Heavy rain may wash away seeds. Wait to plant until gardens drain.",
      "Enkuba ey'amaanyi eyinza okutwala ensigo. Lindako okusiga okutuusa ng'amazzi gakalidde mu nnimiro.",
    );
  }
  if (ctx.isPlantingSeason && ctx.soil !== "low") {
    return summary(
      ctx,
      "maize",
      "good",
      "Soil moisture supports maize planting and early growth.",
      "Amazzi mu ttaka gamala okusiga kasooli n'okumuyamba okumera obulungi.",
    );
  }
  if (ctx.isDrySeason && ctx.soil === "low") {
    return summary(
      ctx,
      "maize",
      "hold",
      "Hold planting until steady rain returns across the next week.",
      "Lindako okusiga okutuusa ng'enkuba etandika okutonnya obutasalako mu wiiki ejja.",
    );
  }
  if (ctx.tempC >= 32) {
    return summary(
      ctx,
      "maize",
      "caution",
      "Heat stress possible on young maize. Water in the morning if you can.",
      "Ebbugumu eriyitiridde liyinza okukosa kasooli omuto. Mufukirire ku makya bw'oba osobola.",
    );
  }
  return summary(
    ctx,
    "maize",
    "good",
    "Conditions are steady for maize garden work this week.",
    "Embeera nnungi eri emirimu gy'ennimiro za kasooli wiiki eno.",
  );
}

function coffeeAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.isDrySeason && ctx.soil === "low") {
    return summary(
      ctx,
      "coffee",
      "caution",
      "Dry weather can stress young coffee. Mulch and water where possible.",
      "Ekyeya kiyinza okukosa emmwanyi ento. Bikka ettaka n'essubi era ofukirire bwe kiba kisoboka.",
    );
  }
  if (ctx.isStorm) {
    return summary(
      ctx,
      "coffee",
      "caution",
      "Wind and rain can strip flowers. Check drainage on slopes.",
      "Empewo n'enkuba biyinza okusuula ebimuli. Kebera emikutu gy'amazzi ku busozi.",
    );
  }
  if (ctx.soil === "high" && ctx.rainMm >= 3) {
    return summary(
      ctx,
      "coffee",
      "good",
      "Moisture is good for cherry fill and new growth.",
      "Amazzi mu ttaka gamala okuyamba empeke z'emmwanyi okujjula n'okukula obulungi.",
    );
  }
  return summary(
    ctx,
    "coffee",
    "good",
    "Coffee gardens look stable. Watch for pests after rain.",
    "Ennimiro z'emmwanyi ziteredde. Kebera obuwuka obuzirya oluvannyuma lw'enkuba.",
  );
}

function beansAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.isPlantingSeason && ctx.soil !== "low") {
    return summary(
      ctx,
      "beans",
      "good",
      "Quick maturing beans can go in while soil moisture is building.",
      "Ebijanjaalo ebikula amangu bisobola okusigibwa ng'amazzi mu ttaka geeyongera.",
    );
  }
  if (ctx.isDrySeason) {
    return summary(
      ctx,
      "beans",
      "hold",
      "Wait for rain before planting beans unless you can water them.",
      "Lindako enkuba nga tonnasiga bijanjaalo okuggyako ng'osobola okufukirira.",
    );
  }
  if (ctx.isStorm) {
    return summary(
      ctx,
      "beans",
      "caution",
      "Wait to harvest until pods dry to avoid mould.",
      "Lindako okukungula okutuusa ng'emisoggo gikaze okwewala okuvunda oba okufuna ekikuku.",
    );
  }
  return summary(
    ctx,
    "beans",
    "good",
    "Beans respond well to current moisture and temperature.",
    "Ebijanjaalo bikula bulungi olw'amazzi agali mu ttaka n'ebbugumu.",
  );
}

function cassavaAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.soil === "high" && ctx.rainMm >= 8) {
    return summary(
      ctx,
      "cassava",
      "caution",
      "Waterlogged soil raises rot risk in mature cassava. Clear drainage channels.",
      "Ettaka eririmu amazzi mangi liyinza okuvunza muwogo omukulu. Longoosa emikutu egy'amazzi.",
    );
  }
  if (ctx.isDrySeason && ctx.soil === "low") {
    return summary(
      ctx,
      "cassava",
      "good",
      "Dry weather suits harvesting and drying cassava chips.",
      "Ekiseera ekikalu kirungi okusima muwogo n'okwanika ebitundutundu bya muwogo oba obuwunga.",
    );
  }
  if (ctx.isPlantingSeason) {
    return summary(
      ctx,
      "cassava",
      "good",
      "Stem planting can continue while rains are regular.",
      "Okusimba ebikolo bya muwogo kusobola okugenda mu maaso ng'enkuba etonnya.",
    );
  }
  return summary(
    ctx,
    "cassava",
    "good",
    "Cassava gardens look steady under current conditions.",
    "Ennimiro za muwogo ziteredde mu mbeera y'obudde eya kati.",
  );
}

function cottonAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.isDrySeason && ctx.soil === "low") {
    return summary(
      ctx,
      "cotton",
      "caution",
      "Cotton bolls need moisture during flowering. Watch for wilting.",
      "Ebimuli bya ppamba byetaaga amazzi nga bitandise okubalula. Kebera oba akalirira.",
    );
  }
  if (ctx.isStorm) {
    return summary(
      ctx,
      "cotton",
      "caution",
      "Delay spraying until winds drop and leaves dry.",
      "Lindako okufuuyira eddagala okutuusa ng'empewo ekendedde n'ebikoola bikaze.",
    );
  }
  if (ctx.isPlantingSeason && ctx.soil !== "low") {
    return summary(
      ctx,
      "cotton",
      "good",
      "Moisture supports young cotton around the lake region.",
      "Amazzi mu ttaka gayamba ppamba omuto okutandika obulungi ku lubalama lw'ennyanja.",
    );
  }
  return summary(
    ctx,
    "cotton",
    "good",
    "Garden conditions look good for checking cotton.",
    "Embeera mu nnimiro nnungi okulambulamu ppamba.",
  );
}

function bananaAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.isStorm) {
    return summary(
      ctx,
      "banana",
      "caution",
      "Strong wind can topple heavy banana stems. Prop up bunches and check drainage.",
      "Empewo ez'amaanyi ziyinza okusuula ebikolo by'ebitooke ebizito. Wanirira emmere era okebere emikutu gy'amazzi.",
    );
  }
  if (ctx.isDrySeason && ctx.soil === "low") {
    return summary(
      ctx,
      "banana",
      "caution",
      "Dry weather can stress plants during fruit fill. Mulch around stems to hold moisture.",
      "Ekyeya kiyinza okukosa ebitooke nga biriko emmere. Bikka essubi ku bikolo by'ebitooke bikuume amazzi.",
    );
  }
  if (ctx.soil === "high" && ctx.rainMm >= 3) {
    return summary(
      ctx,
      "banana",
      "good",
      "Moisture supports bunch fill and sucker growth.",
      "Amazzi mu ttaka gayamba emmere okujjula obulungi n'ensukusa okumera.",
    );
  }
  return summary(
    ctx,
    "banana",
    "good",
    "Banana gardens look stable under current conditions.",
    "Ensuku z'amatooke ziteredde mu mbeera y'obudde eya kati.",
  );
}

function milletAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.soil === "high" && ctx.rainMm >= 8) {
    return summary(
      ctx,
      "millet",
      "caution",
      "Millet dislikes standing water. Make sure gardens drain well after heavy rain.",
      "Obulo tebwagala mazzi galegama. Kakasa nti amazzi gakulukuta okuva mu nnimiro oluvannyuma lw'enkuba.",
    );
  }
  if (ctx.isPlantingSeason && ctx.soil !== "low") {
    return summary(
      ctx,
      "millet",
      "good",
      "Moisture is enough to plant millet, even with light follow-up rain.",
      "Amazzi mu ttaka gamala okusiga obulo.",
    );
  }
  if (ctx.isDrySeason) {
    return summary(
      ctx,
      "millet",
      "good",
      "Millet handles dry weather better than most crops. Gardens need little attention now.",
      "Obulo bugumira ekyeya okusinga ebirime ebirala bingi.",
    );
  }
  return summary(
    ctx,
    "millet",
    "good",
    "Millet is holding up well under current conditions.",
    "Obulo bukula bulungi mu mbeera y'obudde eya kati.",
  );
}

function sorghumAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.isStorm && !ctx.isPlantingSeason) {
    return summary(
      ctx,
      "sorghum",
      "caution",
      "Wet weather near maturity risks grain mould. Harvest early if heads are ripe.",
      "Enkuba ennyingi ng'ekiseera ky'okukungula kusembedde eyinza okuvunza empeke. Kungula amangu ng'ebirimba by'omuwemba byengedde.",
    );
  }
  if (ctx.isDrySeason && ctx.soil === "low") {
    return summary(
      ctx,
      "sorghum",
      "good",
      "Sorghum's deep roots handle dry weather better than most crops.",
      "Emizi gy'omuwemba emiwanvu giyamba okugumira ekyeya.",
    );
  }
  if (ctx.isPlantingSeason && ctx.soil !== "low") {
    return summary(
      ctx,
      "sorghum",
      "good",
      "Soil moisture supports sorghum planting across the drylands.",
      "Amazzi mu ttaka gayamba okusiga omuwemba mu bitundu ebikalu.",
    );
  }
  return summary(
    ctx,
    "sorghum",
    "good",
    "Sorghum gardens are steady under current conditions.",
    "Ennimiro z'omuwemba ziteredde mu mbeera y'obudde eya kati.",
  );
}

function cowpeasAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.isStorm) {
    return summary(
      ctx,
      "cowpeas",
      "caution",
      "Heavy rain during flowering can drop flowers and rot pods. Check gardens once the storm clears.",
      "Enkuba ey'amaanyi mu kiseera ky'okubalula eyinza okusuula ebimuli n'okuvunza emisoggo.",
    );
  }
  if (ctx.isDrySeason && ctx.soil === "low") {
    return summary(
      ctx,
      "cowpeas",
      "good",
      "Cowpeas handle dry weather better than most crops.",
      "Empindi zigumira ekyeya okusinga ebirime ebirala bingi.",
    );
  }
  if (ctx.isPlantingSeason && ctx.soil !== "low") {
    return summary(
      ctx,
      "cowpeas",
      "good",
      "Moisture supports a new cowpeas planting.",
      "Amazzi mu ttaka gayamba okusiga empindi.",
    );
  }
  return summary(
    ctx,
    "cowpeas",
    "good",
    "Cowpeas look steady under current conditions.",
    "Empindi zikula bulungi mu mbeera y'obudde eya kati.",
  );
}

function sesameAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.isStorm) {
    return summary(
      ctx,
      "sesame",
      "caution",
      "Rain on ripening pods causes shattering losses. Delay harvest until they dry.",
      "Enkuba bw'etonnya ku misoggo gy'entungo egikula eyinza okugiyiwa. Lindako okugikungula okutuusa nga gikaze.",
    );
  }
  if (ctx.isDrySeason && ctx.soil === "low") {
    return summary(
      ctx,
      "sesame",
      "good",
      "Sesame handles dry conditions well once established.",
      "Entungo zigumira ekyeya bwe ziba zimaze okunyweza emizi.",
    );
  }
  if (ctx.isPlantingSeason && ctx.soil !== "low") {
    return summary(
      ctx,
      "sesame",
      "good",
      "Moisture supports planting sesame.",
      "Amazzi mu ttaka gayamba okusiga entungo.",
    );
  }
  return summary(
    ctx,
    "sesame",
    "good",
    "Sesame gardens look steady under current conditions.",
    "Ennimiro z'entungo ziteredde mu mbeera y'obudde eya kati.",
  );
}

function riceAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.isDrySeason && ctx.soil === "low") {
    return summary(
      ctx,
      "rice",
      "hold",
      "Rainfed rice needs steady moisture. Wait to plant until rain becomes more reliable.",
      "Omuceere ogutasigibwa mu bitoogo gwetaaga enkuba etasalako. Lindako enkuba okutandika obulungi.",
    );
  }
  if (ctx.soil === "high" && ctx.rainMm >= 3) {
    return summary(
      ctx,
      "rice",
      "good",
      "Good moisture for rice growth.",
      "Amazzi gamala okwongera amaanyi mu kukula kw'omuceere.",
    );
  }
  if (ctx.isPlantingSeason) {
    return summary(
      ctx,
      "rice",
      "caution",
      "Rice needs steady rain after planting. Watch the forecast closely.",
      "Omuceere gwetaaga enkuba etasalako oluvannyuma lw'okusiga. Goberera enteekateeka y'obudde.",
    );
  }
  return summary(
    ctx,
    "rice",
    "good",
    "Rice gardens look steady under current conditions.",
    "Ennimiro z'omuceere ziteredde mu mbeera y'obudde eya kati.",
  );
}

function groundnutsAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.isStorm) {
    return summary(
      ctx,
      "groundnuts",
      "caution",
      "Wet conditions near harvest can spoil nuts. Dry pods fully before storage.",
      "Ettaka eritobye ennyo ng'ekiseera ky'okusima kusembedde liyinza okuvunza ebinyeebwa. Byanike bikale bulungi nga tonnatereka.",
    );
  }
  if (ctx.isDrySeason && ctx.soil === "low") {
    return summary(
      ctx,
      "groundnuts",
      "caution",
      "Dry weather while pods fill can lower yield. Water if you can, or expect smaller pods.",
      "Ekyeya ng'ebinyeebwa bitandise okukwata empeke kiyinza okukendeeza amakungula.",
    );
  }
  if (ctx.isPlantingSeason && ctx.soil !== "low") {
    return summary(
      ctx,
      "groundnuts",
      "good",
      "Moisture supports groundnut planting and pod growth.",
      "Amazzi mu ttaka gayamba okusiga ebinyeebwa n'okwongera empeke amaanyi.",
    );
  }
  return summary(
    ctx,
    "groundnuts",
    "good",
    "Groundnut gardens look steady under current conditions.",
    "Ennimiro z'ebinyeebwa ziteredde mu mbeera y'obudde eya kati.",
  );
}

function irishPotatoAdvisory(ctx: CropContext): CropAdvisory {
  if (ctx.isStorm || (ctx.soil === "high" && ctx.rainMm >= 3)) {
    return summary(
      ctx,
      "irish potato",
      "caution",
      "Wet, humid weather can bring leaf blight. Check leaves and spray if needed.",
      "Obudde obw'ennyogovu n'enkuba ennyingi buleeta obulwadde ku bikoola by'obumonde. Kebera ebikoola ofuuyire bwe kiba kyetaagisa.",
    );
  }
  if (ctx.isDrySeason && ctx.soil === "low") {
    return summary(
      ctx,
      "irish potato",
      "caution",
      "Dry weather can stress growing tubers. Mulch to keep soil moisture in the highlands.",
      "Ekyeya kiyinza okukosa obumonde obukula. Bikka ettaka likuume amazzi mu ttaka mu nsozi.",
    );
  }
  if (ctx.isPlantingSeason && ctx.soil !== "low") {
    return summary(
      ctx,
      "irish potato",
      "good",
      "Moisture supports planting in the highlands.",
      "Amazzi mu ttaka gayamba okusimba obumonde mu nsozi.",
    );
  }
  return summary(
    ctx,
    "irish potato",
    "good",
    "Potato gardens look steady under current conditions.",
    "Ennimiro z'obumonde ziteredde mu mbeera y'obudde eya kati.",
  );
}

function summary(
  ctx: CropContext,
  id: CropId,
  status: CropStatus,
  enText: string,
  lgText: string,
): CropAdvisory {
  const agDict = getDictionary(ctx.language).agriculture;
  return {
    id,
    name: agDict.cropNames[id] ?? id,
    status,
    statusLabel: agDict.cropStatuses[status],
    summary: ctx.language === "lg" ? lgText : enText,
  };
}

const CROP_ADVISORS: Record<CropId, (ctx: CropContext) => CropAdvisory> = {
  maize: maizeAdvisory,
  coffee: coffeeAdvisory,
  beans: beansAdvisory,
  cassava: cassavaAdvisory,
  cotton: cottonAdvisory,
  banana: bananaAdvisory,
  millet: milletAdvisory,
  sorghum: sorghumAdvisory,
  cowpeas: cowpeasAdvisory,
  sesame: sesameAdvisory,
  rice: riceAdvisory,
  groundnuts: groundnutsAdvisory,
  "irish potato": irishPotatoAdvisory,
};

export function buildCropAdvisories(
  weather: WeatherBundle,
  seasonName: string,
  soil: SoilMoistureLevel,
  zoneCrops: string[],
  language: SupportedLocale = "en",
) {
  const ctx: CropContext = {
    language,
    seasonName,
    soil,
    rainMm: weather.precipitation.mm,
    rainChance: weather.precipitation.chance,
    tempC: weather.temperature.celsius,
    isStorm: weather.condition.theme === "thunder" || weather.condition.theme === "rain",
    isDrySeason: seasonName === "dry_season" || seasonName === "short_dry",
    isPlantingSeason: seasonName === "first_rains" || seasonName === "second_rains",
    agroZone: weather.district.agroZone ?? "banana_coffee",
  };

  /**
   * Only advise on crops the district's agro-zone actually grows (per
   * ZONE_CROPS in advisory.ts) — previously every district got advisories
   * for a fixed 5-crop "flagship" set regardless of relevance (e.g. a
   * "Coffee" advisory for Karamoja, a sorghum/millet/cowpeas zone with no
   * coffee). ADVISED_CROP_IDS now covers every crop named in ZONE_CROPS,
   * so every zone's actual crops get real advice instead of either wrong
   * crops or none at all.
   */
  const zoneCropNames = new Set(zoneCrops.map((c) => c.toLowerCase()));
  return ADVISED_CROP_IDS.filter((id) => zoneCropNames.has(id)).map((id) => CROP_ADVISORS[id](ctx));
}

export const ADVISED_CROP_IDS: CropId[] = [
  "maize",
  "coffee",
  "beans",
  "cassava",
  "cotton",
  "banana",
  "millet",
  "sorghum",
  "cowpeas",
  "sesame",
  "rice",
  "groundnuts",
  "irish potato",
];
