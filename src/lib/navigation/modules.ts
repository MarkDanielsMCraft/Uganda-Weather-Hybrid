import type { ComponentType, SVGProps } from "react";
import {
  IconAir,
  IconAlert,
  IconCalendar,
  IconHome,
  IconLeaf,
  IconMap,
  IconSearch,
  IconWater,
} from "@/components/icons/nav-icons";
import type { District } from "@/types/weather";

export interface AppModule {
  href: string;
  label: string;
  pageTitle: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badgeKey?: "alerts";
  /** When set, the module only appears for districts where this returns
      true — e.g. Lake Victoria marine conditions are only meaningful for
      the ~12 shoreline/basin districts, not all 152. Undefined means
      "relevant everywhere" (the default for most modules). */
  relevantFor?: (district: District | undefined) => boolean;
}

export const APP_MODULES: AppModule[] = [
  {
    href: "/",
    label: "Now",
    pageTitle: "Now",
    description: "Current conditions and hourly outlook",
    icon: IconHome,
  },
  {
    href: "/search",
    label: "Places",
    pageTitle: "Places",
    description: "Search districts across Uganda",
    icon: IconSearch,
  },
  {
    href: "/forecast",
    label: "10 Day",
    pageTitle: "10 Day",
    description: "Extended forecast and sun and moon",
    icon: IconCalendar,
  },
  {
    href: "/alerts",
    label: "Alerts",
    pageTitle: "Alerts",
    description: "Weather warnings and hazard context",
    icon: IconAlert,
    badgeKey: "alerts",
  },
  {
    href: "/map",
    label: "Map",
    pageTitle: "Map and Radar",
    description: "Precipitation radar near your district",
    icon: IconMap,
  },
  {
    href: "/air-quality",
    label: "Air",
    pageTitle: "Air Quality",
    description: "AQI and health guidance",
    icon: IconAir,
  },
  {
    href: "/agriculture",
    label: "Fields",
    pageTitle: "Agriculture",
    description: "Planting and farm advisories",
    icon: IconLeaf,
  },
  {
    href: "/lake-victoria",
    label: "Lake",
    pageTitle: "Lake Victoria",
    description: "Fishing safety and marine conditions",
    icon: IconWater,
    relevantFor: (district) => district?.isLakeVictoriaZone === true,
  },
  {
    href: "/lake-kyoga",
    label: "Lake Kyoga",
    pageTitle: "Lake Kyoga",
    description: "Fishing safety and marine conditions",
    icon: IconWater,
    relevantFor: (district) => district?.lakeZone === "kyoga",
  },
  {
    href: "/lake-albert",
    label: "Lake Albert",
    pageTitle: "Lake Albert",
    description: "Fishing safety and marine conditions",
    icon: IconWater,
    relevantFor: (district) => district?.lakeZone === "albert",
  },
  {
    href: "/lake-edward",
    label: "Lake Edward",
    pageTitle: "Lake Edward",
    description: "Fishing safety and marine conditions",
    icon: IconWater,
    relevantFor: (district) => district?.lakeZone === "edward",
  },
];

export function moduleTitle(pathname: string) {
  const match = APP_MODULES.find(
    (item) =>
      item.href === pathname || (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
  );
  return match?.pageTitle ?? "Back";
}

/** Filter a module list down to what's relevant for the given district,
    e.g. hides Lake Victoria for the ~140 districts nowhere near it, so
    only cards that apply to the current location surface instead of a
    fixed set for every location. */
export function visibleModules(modules: AppModule[], district: District | undefined): AppModule[] {
  return modules.filter((item) => !item.relevantFor || item.relevantFor(district));
}
