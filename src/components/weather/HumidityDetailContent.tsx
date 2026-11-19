"use client";

import { useState } from "react";
import { DaySelector } from "@/components/sheet/DaySelector";
import { HourlySeriesGraph } from "@/components/sheet/HourlySeriesGraph";
import { useTranslation } from "@/lib/i18n";
import { formatDayPrepositionLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

export function HumidityDetailContent({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const days = weather.dailyForecast;
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, days.findIndex((day) => day.isToday)),
  );
  const selectedDay = days[selectedIndex] ?? days[0];
  const isToday = selectedDay?.isToday ?? true;
  const hours = selectedDay?.hours ?? [];

  const humidityHours = hours.filter((hour) => hour.kind === "hour" && hour.humidity != null);
  const dewPointHours = hours.filter((hour) => hour.kind === "hour" && hour.dewPointC != null);
  const displayHumidity = isToday ? weather.humidity : (humidityHours[0]?.humidity ?? 0);
  const dewPoint = isToday
    ? (weather.dewPointC ?? dewPointHours[0]?.dewPointC ?? 0)
    : (dewPointHours[0]?.dewPointC ?? 0);

  const avgHumidity =
    humidityHours.length > 0
      ? Math.round(humidityHours.reduce((sum, hour) => sum + (hour.humidity ?? 0), 0) / humidityHours.length)
      : displayHumidity;
  const dewPointValues = dewPointHours.map((hour) => hour.dewPointC ?? 0);
  const dewLow = dewPointValues.length > 0 ? Math.min(...dewPointValues) : dewPoint;
  const dewHigh = dewPointValues.length > 0 ? Math.max(...dewPointValues) : dewPoint;

  return (
    <div>
      <DaySelector days={days} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

      <p className="text-[36px] font-medium leading-tight text-white">{displayHumidity}%</p>
      <p className="mt-1 text-[13px] text-white/45">
        {dict.sheets.humidity.dewPointValue.replace("{dewPoint}", String(dewPoint))}
      </p>

      {humidityHours.length > 2 && (
        <div className="mt-4">
          <HourlySeriesGraph
            hours={hours}
            valueOf={(hour) => hour.humidity}
            min={0}
            max={100}
            unit="%"
            sampledValueOf={(hour) => hour.dewPointC}
            sampledValueUnit="°"
          />
        </div>
      )}

      <p className="mt-4 text-[15px] leading-relaxed text-white/85">
        {dewPoint >= 24
          ? dict.sheets.humidity.noteVeryHigh
          : dewPoint >= 18
            ? dict.sheets.humidity.noteHigh
            : dewPoint >= 12
              ? dict.sheets.humidity.noteComfortable
              : dict.sheets.humidity.noteDry}
      </p>

      <div className="mt-4 pt-3">
        <p className="text-[15px] font-semibold text-white/90">{dict.metrics.dailySummary}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {dict.sheets.humidity.summaryText
            .replace(
              "{day}",
              isLuganda
                ? formatDayPrepositionLg(selectedDay?.day ?? "")
                : (selectedDay?.day ?? ""),
            )
            .replace("{avg}", String(avgHumidity))
            .replace("{low}", String(dewLow))
            .replace("{high}", String(dewHigh))}
        </p>
      </div>

      <div className="mt-4 pt-3">
        <p className="text-[15px] font-semibold text-white/90">{dict.sheets.humidity.aboutTitle}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {dict.sheets.humidity.aboutBody}
        </p>
      </div>

      <div className="mt-4 pt-3">
        <p className="text-[13px] leading-relaxed text-white/50">
          {dict.sheets.humidity.ugandaContext}
        </p>
      </div>
    </div>
  );
}
