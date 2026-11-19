export interface AqiBand {
  label: string;
  min: number;
  max: number;
  color: string;
  summary: string;
  guidance: string[];
}

export const AQI_BANDS: AqiBand[] = [
  {
    label: "Good",
    min: 0,
    max: 50,
    color: "#1B8A7A",
    summary: "Air quality is satisfactory.",
    guidance: [
      "Ideal for outdoor exercise and travel.",
      "No special precautions needed for most people.",
    ],
  },
  {
    label: "Moderate",
    min: 51,
    max: 100,
    color: "#E8A838",
    summary: "Air quality is acceptable for most people.",
    guidance: [
      "Unusually sensitive people should consider limiting prolonged outdoor exertion.",
      "Children and older adults may prefer lighter activity during peak traffic hours.",
    ],
  },
  {
    label: "Unhealthy for Sensitive Groups",
    min: 101,
    max: 150,
    color: "#E07A5F",
    summary: "Sensitive groups may experience health effects.",
    guidance: [
      "People with asthma, heart, or lung conditions should reduce prolonged outdoor exertion.",
      "Consider masks during dusty or smoky conditions in urban areas.",
    ],
  },
  {
    label: "Unhealthy",
    min: 151,
    max: 200,
    color: "#C44536",
    summary: "Everyone may begin to experience health effects.",
    guidance: [
      "Limit time outdoors, especially near busy roads.",
      "Keep windows closed if indoor air feels cleaner.",
    ],
  },
  {
    label: "Very Unhealthy",
    min: 201,
    max: 300,
    color: "#8B3A62",
    summary: "Health alert. Significant effects are possible for everyone.",
    guidance: [
      "Avoid outdoor exertion.",
      "Use air filtration indoors if available.",
    ],
  },
];

export function aqiBandForValue(aqi: number): AqiBand {
  return AQI_BANDS.find((band) => aqi <= band.max) ?? AQI_BANDS[AQI_BANDS.length - 1];
}

export const URBAN_AQI_DISTRICTS = [
  "kampala",
  "wakiso",
  "entebbe",
  "jinja",
  "jinja-city",
  "mbarara",
  "mbarara-city",
  "gulu",
  "gulu-city",
  "mbale",
  "mbale-city",
  "masaka",
  "mukono",
  "lira",
  "arua",
  "arua-city",
];
