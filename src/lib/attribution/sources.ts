export interface AttributionSource {
  name: string;
  role: string;
  url: string;
}

export const SOURCES: AttributionSource[] = [
  {
    name: "WeatherAPI.com",
    role: "Primary forecast, current conditions, and air quality",
    url: "https://www.weatherapi.com/",
  },
  {
    name: "Open-Meteo",
    role: "Second-tier fallback forecast when the primary feed is unavailable",
    url: "https://open-meteo.com/",
  },
  {
    name: "Pirate Weather",
    role: "Third-tier fallback forecast, used only if both other providers fail",
    url: "https://pirateweather.net/",
  },
  {
    name: "OpenWeatherMap",
    role: "Pollutant breakdown (PM2.5, PM10, ozone, and more) in the Air Quality sheet",
    url: "https://openweathermap.org/",
  },
  {
    name: "Visual Crossing",
    role: "Historical averages, for comparing today against the typical high",
    url: "https://www.visualcrossing.com/",
  },
  {
    name: "RainViewer",
    role: "Precipitation radar tiles on the map",
    url: "https://www.rainviewer.com/",
  },
  {
    name: "MapTiler",
    role: "Base map tiles",
    url: "https://www.maptiler.com/",
  },
  {
    name: "Stadia Maps",
    role: "Fallback base map tiles if MapTiler is unavailable",
    url: "https://stadiamaps.com/",
  },
  {
    name: "NOAA Aviation Weather Center",
    role: "Live METAR reports for Uganda's reporting airports",
    url: "https://aviationweather.gov/",
  },
  {
    name: "Uganda Open Data",
    role: "Official village and parish names with district hierarchy",
    url: "https://opendata.ssmusoke.dev/",
  },
  {
    name: "OpenStreetMap",
    role: "Village and place geocoding",
    url: "https://www.openstreetmap.org/copyright",
  },
  {
    name: "UNMA CAP feed",
    role: "Official-style alerts when published by Uganda DMS",
    url: "https://cap-sources.s3.amazonaws.com/ug-dms-en/rss.xml",
  },
  {
    name: "Uganda district boundaries",
    role: "Electoral Commission list and OpenStreetMap centroids",
    url: "https://ec.or.ug/",
  },
];
