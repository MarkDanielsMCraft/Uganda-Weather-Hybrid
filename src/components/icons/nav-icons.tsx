import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconHome(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}

export function IconMap(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M4 11h16" />
    </svg>
  );
}

export function IconAir(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10h11a3 3 0 1 0-3-3M4 14h14a3 3 0 1 1-3 3M4 18h8a2 2 0 1 0-2-2" />
    </svg>
  );
}

export function IconLeaf(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 20c8-1 12-6 12-14a1 1 0 0 0-1-1C9 5 5 9 4 17a1 1 0 0 0 1 1Z" />
      <path d="M6 20c3-4 7-7 12-8" />
    </svg>
  );
}

export function IconWater(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3c3 4 7 8 7 12a7 7 0 1 1-14 0c0-4 4-8 7-12Z" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
