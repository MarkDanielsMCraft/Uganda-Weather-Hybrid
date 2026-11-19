import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Uganda Weather",
    short_name: "Uganda Wx",
    description: "District-level weather for all of Uganda",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1a1524",
    theme_color: "#1a1524",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Current Weather",
        short_name: "Weather",
        url: "/",
      },
      {
        name: "Rain Radar Map",
        short_name: "Radar",
        url: "/map",
      },
      {
        name: "Severe Weather Alerts",
        short_name: "Alerts",
        url: "/alerts",
      },
      {
        name: "Search Places",
        short_name: "Search",
        url: "/search",
      },
      {
        name: "10 Day Forecast",
        short_name: "Forecast",
        url: "/forecast",
      },
      {
        name: "Agriculture Advisory",
        short_name: "Farming",
        url: "/agriculture",
      },
      {
        name: "Lake Victoria Safety",
        short_name: "Marine",
        url: "/lake-victoria",
      },
    ],
  };
}
