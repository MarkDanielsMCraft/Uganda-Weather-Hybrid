import WidgetKit
import SwiftUI

struct WidgetHourlyForecast: Identifiable {
    let id: String
    let label: String
    let temperatureC: Int?
    let conditionTheme: String
    let rainChance: Int?
}

struct WidgetDailyForecast: Identifiable {
    let id: String
    let day: String
    let conditionTheme: String
    let highC: Int?
    let lowC: Int?
    let rainChance: Int?
}

struct WeatherWidgetEntry: TimelineEntry {
    let date: Date
    let districtName: String
    let temperatureC: Int?
    let conditionText: String
    let conditionTheme: String
    let highC: Int?
    let lowC: Int?
    let precipitationChance: Int?
    let windSpeedKph: Int?
    let uvIndex: Int?
    let humidity: Int?
    let sunriseText: String?
    let sunsetText: String?
    let hasActiveAlert: Bool
    let alertHeadline: String?
    let updatedAtText: String?
    let hourlyForecast: [WidgetHourlyForecast]
    let dailyForecast: [WidgetDailyForecast]
    let aqi: Int?
    let aqiCategory: String?
    let agroSeason: String?
    let isLakeZone: Bool

    var accent: Color {
        switch conditionTheme {
        case "clear":
            return Color(red: 0.96, green: 0.72, blue: 0.24)
        case "rain", "thunder":
            return Color(red: 0.42, green: 0.76, blue: 0.96)
        case "fog":
            return Color(red: 0.72, green: 0.79, blue: 0.85)
        default:
            return Color(red: 0.80, green: 0.84, blue: 0.90)
        }
    }
}

func weatherIconName(theme: String) -> String {
    switch theme {
    case "clear":
        return "sun.max.fill"
    case "partly_cloudy":
        return "cloud.sun.fill"
    case "cloudy":
        return "cloud.fill"
    case "rain":
        return "cloud.rain.fill"
    case "thunder":
        return "cloud.bolt.rain.fill"
    case "fog":
        return "cloud.fog.fill"
    case "night":
        return "moon.stars.fill"
    default:
        return "cloud.fill"
    }
}

func weatherIconColor(theme: String) -> Color {
    switch theme {
    case "clear":
        return Color(red: 0.96, green: 0.72, blue: 0.24)
    case "partly_cloudy":
        return Color(red: 0.94, green: 0.78, blue: 0.42)
    case "rain", "thunder":
        return Color(red: 0.48, green: 0.78, blue: 0.95)
    default:
        return Color.white.opacity(0.85)
    }
}

// Atmospheric sky gradients matching the website palette
func skyGradientColors(theme: String) -> [Color] {
    switch theme {
    case "clear":
        return [
            Color(red: 0.10, green: 0.36, blue: 0.66),
            Color(red: 0.16, green: 0.44, blue: 0.76),
            Color(red: 0.08, green: 0.14, blue: 0.24)
        ]
    case "partly_cloudy":
        return [
            Color(red: 0.12, green: 0.25, blue: 0.45),
            Color(red: 0.18, green: 0.35, blue: 0.58),
            Color(red: 0.07, green: 0.11, blue: 0.19)
        ]
    case "cloudy":
        return [
            Color(red: 0.26, green: 0.31, blue: 0.38),
            Color(red: 0.18, green: 0.23, blue: 0.30),
            Color(red: 0.08, green: 0.10, blue: 0.15)
        ]
    case "rain":
        return [
            Color(red: 0.14, green: 0.22, blue: 0.32),
            Color(red: 0.10, green: 0.16, blue: 0.24),
            Color(red: 0.05, green: 0.08, blue: 0.13)
        ]
    case "thunder":
        return [
            Color(red: 0.16, green: 0.13, blue: 0.26),
            Color(red: 0.10, green: 0.09, blue: 0.18),
            Color(red: 0.04, green: 0.04, blue: 0.08)
        ]
    case "fog":
        return [
            Color(red: 0.30, green: 0.34, blue: 0.40),
            Color(red: 0.20, green: 0.24, blue: 0.30),
            Color(red: 0.09, green: 0.11, blue: 0.15)
        ]
    case "night":
        return [
            Color(red: 0.08, green: 0.08, blue: 0.18),
            Color(red: 0.12, green: 0.11, blue: 0.24),
            Color(red: 0.04, green: 0.04, blue: 0.09)
        ]
    default:
        return [
            Color(red: 0.12, green: 0.17, blue: 0.24),
            Color(red: 0.06, green: 0.08, blue: 0.12)
        ]
    }
}

func atmosphericGlowColor(theme: String) -> Color {
    switch theme {
    case "clear":
        return Color(red: 1.0, green: 0.85, blue: 0.40).opacity(0.35)
    case "partly_cloudy":
        return Color(red: 0.85, green: 0.90, blue: 1.0).opacity(0.25)
    case "cloudy":
        return Color.white.opacity(0.12)
    case "rain":
        return Color(red: 0.40, green: 0.75, blue: 1.0).opacity(0.20)
    case "thunder":
        return Color(red: 0.90, green: 0.80, blue: 1.0).opacity(0.25)
    case "night":
        return Color(red: 0.65, green: 0.75, blue: 1.0).opacity(0.20)
    default:
        return Color.white.opacity(0.10)
    }
}

@ViewBuilder
func dynamicCardBackground(theme: String) -> some View {
    ZStack {
        LinearGradient(
            colors: skyGradientColors(theme: theme),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )

        RadialGradient(
            colors: [atmosphericGlowColor(theme: theme), Color.clear],
            center: .topTrailing,
            startRadius: 5,
            endRadius: 180
        )
        .blendMode(.screen)

        LinearGradient(
            colors: [
                Color.black.opacity(0.18),
                Color.black.opacity(0.48)
            ],
            startPoint: .top,
            endPoint: .bottom
        )

        RoundedRectangle(cornerRadius: 22)
            .stroke(
                LinearGradient(
                    colors: [Color.white.opacity(0.28), Color.white.opacity(0.06)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                lineWidth: 1
            )
    }
    .ignoresSafeArea()
}

struct WeatherTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherWidgetEntry {
        unavailableEntry()
    }

    func getSnapshot(in context: Context, completion: @escaping (WeatherWidgetEntry) -> Void) {
        completion(loadSharedWidgetData())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherWidgetEntry>) -> Void) {
        let cachedEntry = loadSharedWidgetData()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())
            ?? Date().addingTimeInterval(1800)

        // No saved district means the person has not opened the app yet. Guessing a
        // district would show weather for a place they never chose.
        guard let districtSlug = resolveDistrictSlug() else {
            completion(Timeline(entries: [cachedEntry], policy: .after(nextUpdate)))
            return
        }

        fetchLiveWidgetEntry(districtSlug: districtSlug) { liveEntry in
            completion(Timeline(entries: [liveEntry ?? cachedEntry], policy: .after(nextUpdate)))
        }
    }

    private func resolveDistrictSlug() -> String? {
        let defaults = UserDefaults(suiteName: "group.com.ugandaweather.app")
        guard let jsonString = defaults?.string(forKey: "uw:widget:data:v2"),
              let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let slug = json["districtSlug"] as? String,
              !slug.isEmpty else {
            return nil
        }
        return slug
    }

    private func fetchLiveWidgetEntry(districtSlug: String, completion: @escaping (WeatherWidgetEntry?) -> Void) {
        guard let encoded = districtSlug.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://uganda-weather.com/api/v1/weather/current?district=\(encoded)") else {
            completion(nil)
            return
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: request) { data, _, _ in
            guard let data,
                  let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let payload = root["data"] as? [String: Any],
                  let district = payload["district"] as? [String: Any],
                  let districtName = district["name"] as? String else {
                completion(nil)
                return
            }

            let temperature = payload["temperature"] as? [String: Any]
            let condition = payload["condition"] as? [String: Any]
            let daily = payload["daily"] as? [String: Any]
            let precipitation = payload["precipitation"] as? [String: Any]
            let wind = payload["wind"] as? [String: Any]
            let astronomy = payload["astronomy"] as? [String: Any]
            let alerts = payload["alerts"] as? [[String: Any]] ?? []
            let hourlyData = payload["hourly"] as? [[String: Any]] ?? []
            let dailyData = payload["dailyForecast"] as? [[String: Any]] ?? []
            let airQuality = payload["airQuality"] as? [String: Any]

            let hourly: [WidgetHourlyForecast] = hourlyData.compactMap { point in
                guard (point["kind"] as? String) == "hour",
                      let label = point["label"] as? String else { return nil }
                return WidgetHourlyForecast(
                    id: (point["time"] as? String) ?? label,
                    label: label,
                    temperatureC: self.integerValue(point["temp"]),
                    conditionTheme: point["theme"] as? String ?? "unknown",
                    rainChance: self.integerValue(point["rainChance"])
                )
            }

            let dailyForecast: [WidgetDailyForecast] = dailyData.compactMap { point in
                guard let day = point["day"] as? String else { return nil }
                return WidgetDailyForecast(
                    id: (point["date"] as? String) ?? day,
                    day: day,
                    conditionTheme: point["theme"] as? String ?? "unknown",
                    highC: self.integerValue(point["high"]),
                    lowC: self.integerValue(point["low"]),
                    rainChance: self.integerValue(point["rainChance"])
                )
            }

            let isLake = (district["isLakeVictoriaZone"] as? Bool) ?? false

            let entry = WeatherWidgetEntry(
                date: Date(),
                districtName: districtName,
                temperatureC: self.integerValue(temperature?["celsius"]),
                conditionText: condition?["text"] as? String ?? "Weather unavailable",
                conditionTheme: condition?["theme"] as? String ?? "unknown",
                highC: self.integerValue(daily?["high"]),
                lowC: self.integerValue(daily?["low"]),
                precipitationChance: self.integerValue(precipitation?["chance"]),
                windSpeedKph: self.integerValue(wind?["speedKph"]),
                uvIndex: self.integerValue(payload["uvIndex"]),
                humidity: self.integerValue(payload["humidity"]),
                sunriseText: astronomy?["sunrise"] as? String,
                sunsetText: astronomy?["sunset"] as? String,
                hasActiveAlert: !alerts.isEmpty,
                alertHeadline: alerts.first?["title"] as? String,
                updatedAtText: self.formattedUpdateTime(payload["updatedAt"] as? String),
                hourlyForecast: Array(hourly.prefix(8)),
                dailyForecast: Array(dailyForecast.prefix(5)),
                aqi: self.integerValue(airQuality?["aqi"]),
                aqiCategory: airQuality?["category"] as? String,
                agroSeason: district["rainfallPattern"] as? String,
                isLakeZone: isLake
            )
            completion(entry)
        }.resume()
    }

    private func loadSharedWidgetData() -> WeatherWidgetEntry {
        let defaults = UserDefaults(suiteName: "group.com.ugandaweather.app")
        guard let jsonString = defaults?.string(forKey: "uw:widget:data:v2"),
              let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let districtName = json["districtName"] as? String else {
            return unavailableEntry()
        }

        let hourlyData: [[String: Any]] = json["hourlyTimeline"] as? [[String: Any]] ?? []
        let hourly: [WidgetHourlyForecast] = hourlyData.compactMap { point -> WidgetHourlyForecast? in
            guard let label = point["label"] as? String else { return nil }
            return WidgetHourlyForecast(
                id: (point["time"] as? String) ?? label,
                label: label,
                temperatureC: integerValue(point["tempC"]),
                conditionTheme: point["conditionTheme"] as? String ?? "unknown",
                rainChance: integerValue(point["rainChance"])
            )
        }

        let dailyData: [[String: Any]] = json["dailyForecast"] as? [[String: Any]] ?? []
        let dailyForecast: [WidgetDailyForecast] = dailyData.compactMap { point -> WidgetDailyForecast? in
            guard let day = point["day"] as? String else { return nil }
            return WidgetDailyForecast(
                id: (point["date"] as? String) ?? day,
                day: day,
                conditionTheme: point["conditionTheme"] as? String ?? "unknown",
                highC: integerValue(point["highC"] ?? point["high"]),
                lowC: integerValue(point["lowC"] ?? point["low"]),
                rainChance: integerValue(point["rainChance"])
            )
        }

        return WeatherWidgetEntry(
            date: Date(),
            districtName: districtName,
            temperatureC: integerValue(json["temperatureC"]),
            conditionText: json["conditionText"] as? String ?? "Weather unavailable",
            conditionTheme: json["conditionTheme"] as? String ?? "unknown",
            highC: integerValue(json["highC"]),
            lowC: integerValue(json["lowC"]),
            precipitationChance: integerValue(json["precipitationChance"]),
            windSpeedKph: integerValue(json["windSpeedKph"]),
            uvIndex: integerValue(json["uvIndex"]),
            humidity: integerValue(json["humidity"]),
            sunriseText: json["sunriseText"] as? String,
            sunsetText: json["sunsetText"] as? String,
            hasActiveAlert: json["hasActiveAlert"] as? Bool ?? false,
            alertHeadline: json["alertTitle"] as? String,
            updatedAtText: formattedUpdateTime(json["updatedAt"] as? String),
            hourlyForecast: hourly,
            dailyForecast: dailyForecast,
            aqi: integerValue(json["aqi"]),
            aqiCategory: json["aqiCategory"] as? String,
            agroSeason: json["agroSeason"] as? String,
            isLakeZone: (json["isLakeZone"] as? Bool) ?? false
        )
    }

    private func integerValue(_ value: Any?) -> Int? {
        guard let number = value as? NSNumber, number.doubleValue.isFinite else {
            return nil
        }
        // Round like the web app and Android widgets so all three show the same number.
        return Int(number.doubleValue.rounded())
    }

    private func unavailableEntry() -> WeatherWidgetEntry {
        WeatherWidgetEntry(
            date: Date(),
            districtName: "Uganda Weather",
            temperatureC: nil,
            conditionText: "Open app to load weather",
            conditionTheme: "unknown",
            highC: nil,
            lowC: nil,
            precipitationChance: nil,
            windSpeedKph: nil,
            uvIndex: nil,
            humidity: nil,
            sunriseText: nil,
            sunsetText: nil,
            hasActiveAlert: false,
            alertHeadline: nil,
            updatedAtText: nil,
            hourlyForecast: [],
            dailyForecast: [],
            aqi: nil,
            aqiCategory: nil,
            agroSeason: nil,
            isLakeZone: false
        )
    }

    private func formattedUpdateTime(_ value: String?) -> String? {
        guard let value,
              let date = ISO8601DateFormatter().date(from: value) else {
            return nil
        }
        return date.formatted(date: .omitted, time: .shortened)
    }
}

// iOS 17 and later replace a widget that does not declare its background with a
// system notice, so the background must go through containerBackground there.
// iOS 15 and 16 do not have that API and keep the plain background.
extension View {
    @ViewBuilder
    func widgetBackground<Background: View>(_ background: Background) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) { background }
        } else {
            self.background(background)
        }
    }
}

// The layouts already add their own padding. Without this, iOS 17 and later add
// extra system margins on top and the content shrinks.
extension WidgetConfiguration {
    func contentMarginsDisabledIfAvailable() -> some WidgetConfiguration {
        if #available(iOSApplicationExtension 17.0, *) {
            return contentMarginsDisabled()
        } else {
            return self
        }
    }
}

// MARK: - 1. Main Forecast Widget View (Small, Medium, Large, Extra Large)
struct WeatherWidgetEntryView: View {
    var entry: WeatherTimelineProvider.Entry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            switch family {
            case .systemSmall:
                smallWidget
            case .systemMedium:
                mediumWidget
            default:
                largeWidget
            }
        }
        .foregroundStyle(.white)
        .widgetBackground(dynamicCardBackground(theme: entry.conditionTheme))
    }

    // 2x2 Square Widget
    private var smallWidget: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Text(entry.districtName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Image(systemName: "location.fill")
                    .font(.system(size: 9))
                    .foregroundStyle(.white.opacity(0.7))
                Spacer(minLength: 0)
                if entry.hasActiveAlert {
                    alertDot
                }
            }

            Text(entry.temperatureC.map { "\($0)°" } ?? "--")
                .font(.system(size: 52, weight: .light, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .padding(.top, 2)

            Spacer(minLength: 0)

            VStack(alignment: .leading, spacing: 2) {
                Image(systemName: weatherIconName(theme: entry.conditionTheme))
                    .font(.system(size: 17))
                    .foregroundStyle(weatherIconColor(theme: entry.conditionTheme))

                Text(entry.conditionText)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.9))
                    .lineLimit(1)

                rangeText
            }
        }
        .padding(14)
    }

    // 4x2 Horizontal Widget
    private var mediumWidget: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 4) {
                        Text(entry.districtName)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Image(systemName: "location.fill")
                            .font(.system(size: 9))
                            .foregroundStyle(.white.opacity(0.7))
                        if entry.hasActiveAlert {
                            alertDot
                        }
                    }
                    Text(entry.temperatureC.map { "\($0)°" } ?? "--")
                        .font(.system(size: 38, weight: .light, design: .rounded))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)

                VStack(alignment: .trailing, spacing: 2) {
                    Image(systemName: weatherIconName(theme: entry.conditionTheme))
                        .font(.system(size: 17))
                        .foregroundStyle(weatherIconColor(theme: entry.conditionTheme))
                    Text(entry.conditionText)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.white.opacity(0.9))
                        .lineLimit(1)
                    rangeText
                }
            }

            hourlyStrip(count: 6)
        }
        .padding(14)
    }

    // 4x4 Large Widget
    private var largeWidget: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 4) {
                        Text(entry.districtName)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Image(systemName: "location.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.white.opacity(0.7))
                        if entry.hasActiveAlert {
                            alertDot
                        }
                    }
                    Text(entry.temperatureC.map { "\($0)°" } ?? "--")
                        .font(.system(size: 42, weight: .light, design: .rounded))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)

                VStack(alignment: .trailing, spacing: 2) {
                    Image(systemName: weatherIconName(theme: entry.conditionTheme))
                        .font(.system(size: 19))
                        .foregroundStyle(weatherIconColor(theme: entry.conditionTheme))
                    Text(entry.conditionText)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.9))
                        .lineLimit(1)
                    rangeText
                }
            }

            hourlyStrip(count: 6)

            Rectangle()
                .fill(Color.white.opacity(0.12))
                .frame(height: 1)

            VStack(spacing: 5) {
                ForEach(entry.dailyForecast) { day in
                    dailyRow(day: day)
                }
            }
        }
        .padding(14)
    }

    private var alertDot: some View {
        Text("!")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(Color(red: 0.99, green: 0.82, blue: 0.53))
            .frame(width: 16, height: 16)
            .background(Color(red: 0.91, green: 0.66, blue: 0.22).opacity(0.25))
            .clipShape(Circle())
    }

    private var rangeText: some View {
        Group {
            if let high = entry.highC, let low = entry.lowC {
                Text("H: \(high)°  L: \(low)°")
            } else {
                Text("Range unavailable")
            }
        }
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(.white.opacity(0.85))
        .lineLimit(1)
    }

    private func hourlyStrip(count: Int) -> some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(Array(entry.hourlyForecast.prefix(count))) { point in
                VStack(spacing: 3) {
                    Text(point.label)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.white.opacity(0.65))
                        .lineLimit(1)
                    Image(systemName: weatherIconName(theme: point.conditionTheme))
                        .font(.system(size: 13))
                        .foregroundStyle(weatherIconColor(theme: point.conditionTheme))
                    Text(point.temperatureC.map { "\($0)°" } ?? "--")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                    if let chance = point.rainChance, chance > 0 {
                        Text("\(chance)%")
                            .font(.system(size: 8, weight: .medium))
                            .foregroundStyle(Color(red: 0.52, green: 0.82, blue: 0.98))
                    } else {
                        Text(" ")
                            .font(.system(size: 8))
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func dailyRow(day: WidgetDailyForecast) -> some View {
        HStack(spacing: 8) {
            Text(day.day)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.85))
                .frame(width: 34, alignment: .leading)

            Image(systemName: weatherIconName(theme: day.conditionTheme))
                .font(.system(size: 12))
                .foregroundStyle(weatherIconColor(theme: day.conditionTheme))
                .frame(width: 18)

            Text(day.lowC.map { "\($0)°" } ?? "--")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.white.opacity(0.6))
                .frame(width: 22, alignment: .trailing)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.12))
                        .frame(height: 4)
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.38, green: 0.72, blue: 0.91),
                                    Color(red: 0.95, green: 0.76, blue: 0.32)
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: max(8, geo.size.width * 0.65), height: 4)
                        .padding(.leading, geo.size.width * 0.15)
                }
                .frame(maxHeight: .infinity, alignment: .center)
            }
            .frame(height: 12)

            Text(day.highC.map { "\($0)°" } ?? "--")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 22, alignment: .trailing)
        }
    }
}

// MARK: - 2. Details Widget View (Small & Medium)
struct DetailsWidgetView: View {
    var entry: WeatherTimelineProvider.Entry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if family == .systemMedium {
                mediumDetails
            } else {
                smallDetails
            }
        }
        .foregroundStyle(.white)
        .widgetBackground(dynamicCardBackground(theme: entry.conditionTheme))
    }

    private var smallDetails: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Text(entry.districtName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Image(systemName: "location.fill")
                    .font(.system(size: 9))
                    .foregroundStyle(.white.opacity(0.7))
                Spacer(minLength: 0)
                Image(systemName: weatherIconName(theme: entry.conditionTheme))
                    .font(.system(size: 14))
                    .foregroundStyle(weatherIconColor(theme: entry.conditionTheme))
            }

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(entry.temperatureC.map { "\($0)°" } ?? "--")
                    .font(.system(size: 34, weight: .light, design: .rounded))
                    .foregroundStyle(.white)

                if let high = entry.highC, let low = entry.lowC {
                    Text("H \(high)°  L \(low)°")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.75))
                }
            }
            .padding(.top, 1)

            Spacer(minLength: 0)

            Rectangle()
                .fill(Color.white.opacity(0.12))
                .frame(height: 1)
                .padding(.bottom, 6)

            VStack(alignment: .leading, spacing: 5) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Precipitation")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.white.opacity(0.65))
                    HStack(spacing: 3) {
                        Image(systemName: "drop.fill")
                            .font(.system(size: 8))
                            .foregroundStyle(Color(red: 0.48, green: 0.78, blue: 0.95))
                        Text(entry.precipitationChance.map { "\($0)% today" } ?? "--")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text("Wind")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.white.opacity(0.65))
                    Text(entry.windSpeedKph.map { "\($0) km/h" } ?? "--")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
        }
        .padding(14)
    }

    private var mediumDetails: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 4) {
                        Text(entry.districtName)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                        Image(systemName: "location.fill")
                            .font(.system(size: 9))
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    Text(entry.conditionText)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.85))
                }
                Spacer()
                Text(entry.temperatureC.map { "\($0)°" } ?? "--")
                    .font(.system(size: 32, weight: .light, design: .rounded))
                    .foregroundStyle(.white)
            }

            Rectangle()
                .fill(Color.white.opacity(0.12))
                .frame(height: 1)

            HStack(spacing: 12) {
                detailBox(title: "Precipitation", value: entry.precipitationChance.map { "\($0)%" } ?? "--", icon: "drop.fill", iconColor: Color(red: 0.48, green: 0.78, blue: 0.95))
                detailBox(title: "Wind", value: entry.windSpeedKph.map { "\($0) km/h" } ?? "--", icon: "wind", iconColor: Color(red: 0.78, green: 0.88, blue: 0.95))
                detailBox(title: "UV Index", value: entry.uvIndex.map { "\($0)" } ?? "--", icon: "sun.max.fill", iconColor: Color(red: 0.96, green: 0.72, blue: 0.24))
                detailBox(title: "Humidity", value: entry.humidity.map { "\($0)%" } ?? "--", icon: "humidity.fill", iconColor: Color(red: 0.42, green: 0.76, blue: 0.96))
            }
        }
        .padding(14)
    }

    private func detailBox(title: String, value: String, icon: String, iconColor: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 3) {
                Image(systemName: icon)
                    .font(.system(size: 9))
                    .foregroundStyle(iconColor)
                Text(title)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
                    .lineLimit(1)
            }
            Text(value)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 3. Daily Forecast Widget View (Small & Medium)
struct DailyForecastWidgetView: View {
    var entry: WeatherTimelineProvider.Entry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if family == .systemMedium {
                mediumDaily
            } else {
                smallDaily
            }
        }
        .foregroundStyle(.white)
        .widgetBackground(dynamicCardBackground(theme: entry.conditionTheme))
    }

    private var smallDaily: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Text(entry.districtName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Image(systemName: "location.fill")
                    .font(.system(size: 8))
                    .foregroundStyle(.white.opacity(0.7))
                Spacer(minLength: 0)
                Image(systemName: weatherIconName(theme: entry.conditionTheme))
                    .font(.system(size: 13))
                    .foregroundStyle(weatherIconColor(theme: entry.conditionTheme))
            }

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(entry.temperatureC.map { "\($0)°" } ?? "--")
                    .font(.system(size: 26, weight: .light, design: .rounded))
                    .foregroundStyle(.white)

                if let high = entry.highC, let low = entry.lowC {
                    Text("H \(high)°  L \(low)°")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.white.opacity(0.7))
                }
            }

            Spacer(minLength: 0)

            Rectangle()
                .fill(Color.white.opacity(0.12))
                .frame(height: 1)
                .padding(.bottom, 4)

            VStack(spacing: 3) {
                ForEach(Array(entry.dailyForecast.prefix(4))) { day in
                    HStack(spacing: 4) {
                        Text(day.day)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.white.opacity(0.85))
                            .frame(width: 30, alignment: .leading)

                        Image(systemName: weatherIconName(theme: day.conditionTheme))
                            .font(.system(size: 11))
                            .foregroundStyle(weatherIconColor(theme: day.conditionTheme))
                            .frame(width: 16)

                        Spacer(minLength: 0)

                        Text(day.lowC.map { "\($0)°" } ?? "--")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.white.opacity(0.6))

                        Text(day.highC.map { "\($0)°" } ?? "--")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                }
            }
        }
        .padding(12)
    }

    private var mediumDaily: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                HStack(spacing: 4) {
                    Text(entry.districtName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                    Image(systemName: "location.fill")
                        .font(.system(size: 9))
                        .foregroundStyle(.white.opacity(0.7))
                }
                Spacer()
                Text("5 DAY FORECAST")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(1.0)
                    .foregroundStyle(.white.opacity(0.6))
            }

            HStack(spacing: 6) {
                ForEach(entry.dailyForecast) { day in
                    VStack(spacing: 4) {
                        Text(day.day)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.white.opacity(0.75))
                        Image(systemName: weatherIconName(theme: day.conditionTheme))
                            .font(.system(size: 14))
                            .foregroundStyle(weatherIconColor(theme: day.conditionTheme))
                        Text(day.highC.map { "\($0)°" } ?? "--")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                        Text(day.lowC.map { "\($0)°" } ?? "--")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.white.opacity(0.55))
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(14)
    }
}

// MARK: - 4. Sunrise and Sunset Widget View
struct CelestialArcShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let startPoint = CGPoint(x: rect.minX, y: rect.maxY)
        let controlPoint = CGPoint(x: rect.midX, y: rect.minY - 10)
        let endPoint = CGPoint(x: rect.maxX, y: rect.maxY)

        path.move(to: startPoint)
        path.addQuadCurve(to: endPoint, control: controlPoint)
        return path
    }
}

struct SunriseWidgetView: View {
    var entry: WeatherTimelineProvider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Image(systemName: "sunset.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(Color(red: 0.96, green: 0.72, blue: 0.24))
                Text("SUNSET")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1.0)
                    .foregroundStyle(.white.opacity(0.65))
                Spacer()
                Text(entry.districtName)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.white.opacity(0.8))
                    .lineLimit(1)
            }

            Text(entry.sunsetText ?? "--")
                .font(.system(size: 26, weight: .light, design: .rounded))
                .foregroundStyle(.white)
                .padding(.top, 2)

            Spacer(minLength: 0)

            // Celestial horizon trajectory arc
            ZStack(alignment: .center) {
                CelestialArcShape()
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.2),
                                Color(red: 0.96, green: 0.76, blue: 0.32).opacity(0.8),
                                Color.white.opacity(0.2)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        style: StrokeStyle(lineWidth: 2, lineCap: .round)
                    )
                    .frame(height: 28)

                // Sun ephemeris marker dot
                Circle()
                    .fill(Color(red: 1.0, green: 0.88, blue: 0.40))
                    .frame(width: 9, height: 9)
                    .shadow(color: Color(red: 1.0, green: 0.75, blue: 0.20), radius: 4)
                    .offset(y: -10)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)

            Spacer(minLength: 0)

            Text("Sunrise: \(entry.sunriseText ?? "--")")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.white.opacity(0.75))
        }
        .padding(14)
        .foregroundStyle(.white)
        .widgetBackground(dynamicCardBackground(theme: "clear"))
    }
}

// MARK: - 5. Specialized Agriculture Widget View
struct AgricultureWidgetView: View {
    var entry: WeatherTimelineProvider.Entry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("AGRICULTURE")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(.white.opacity(0.55))
                Spacer()
                Text(entry.districtName)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
            }

            Text("Farm weather")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color(red: 0.96, green: 0.78, blue: 0.38))

            Text("Rain chance today: \(entry.precipitationChance.map { "\($0)%" } ?? "--")")
                .font(.system(size: 11))
                .foregroundStyle(.white.opacity(0.75))

            Spacer(minLength: 0)

            HStack {
                Text(rainfallPatternLabel(entry.agroSeason) ?? "Season not available")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(.white.opacity(0.85))
                Spacer()
                Image(systemName: "leaf.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(red: 0.96, green: 0.78, blue: 0.38))
            }
        }
        .padding(14)
        .foregroundStyle(.white)
        .widgetBackground(dynamicCardBackground(theme: "partly_cloudy"))
    }
}

// Same wording the website uses for a district's rainfall pattern.
func rainfallPatternLabel(_ pattern: String?) -> String? {
    switch pattern {
    case "bimodal":
        return "Two rainy seasons a year"
    case "unimodal":
        return "One long rainy season a year"
    default:
        return nil
    }
}

// MARK: - 6. Specialized Air Quality Widget View
struct AirQualityWidgetView: View {
    var entry: WeatherTimelineProvider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("AIR QUALITY")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(.white.opacity(0.55))
                Spacer()
                Text(entry.districtName)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
            }

            Text(entry.aqi.map { "AQI \($0)" } ?? "AQI --")
                .font(.system(size: 24, weight: .light, design: .rounded))
                .foregroundStyle(.white)

            Text(entry.aqiCategory ?? "Air quality not available")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color(red: 0.48, green: 0.78, blue: 0.95))

            Spacer(minLength: 0)

            Text("Air quality index")
                .font(.system(size: 9))
                .foregroundStyle(.white.opacity(0.55))
        }
        .padding(14)
        .foregroundStyle(.white)
        .widgetBackground(dynamicCardBackground(theme: "cloudy"))
    }
}

// MARK: - Widget Configurations & Bundle Registration
struct UgandaWeatherWidget: Widget {
    let kind: String = "UgandaWeatherWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherTimelineProvider()) { entry in
            WeatherWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Forecast")
        .description("Current weather, the next few hours, and the next 5 days.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabledIfAvailable()
    }
}

struct UgandaDetailsWidget: Widget {
    let kind: String = "UgandaDetailsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherTimelineProvider()) { entry in
            DetailsWidgetView(entry: entry)
        }
        .configurationDisplayName("Details")
        .description("Rain chance, wind, UV index, and humidity.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabledIfAvailable()
    }
}

struct UgandaDailyForecastWidget: Widget {
    let kind: String = "UgandaDailyForecastWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherTimelineProvider()) { entry in
            DailyForecastWidgetView(entry: entry)
        }
        .configurationDisplayName("Daily Forecast")
        .description("Current weather and the next 5 days.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabledIfAvailable()
    }
}

struct UgandaSunriseWidget: Widget {
    let kind: String = "UgandaSunriseWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherTimelineProvider()) { entry in
            SunriseWidgetView(entry: entry)
        }
        .configurationDisplayName("Sunrise and Sunset")
        .description("Sunrise and sunset times for your district.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabledIfAvailable()
    }
}

struct UgandaAgricultureWidget: Widget {
    let kind: String = "UgandaAgricultureWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherTimelineProvider()) { entry in
            AgricultureWidgetView(entry: entry)
        }
        .configurationDisplayName("Agriculture")
        .description("Rain chance today and the rainfall pattern for your district.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabledIfAvailable()
    }
}

struct UgandaAirQualityWidget: Widget {
    let kind: String = "UgandaAirQualityWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherTimelineProvider()) { entry in
            AirQualityWidgetView(entry: entry)
        }
        .configurationDisplayName("Air Quality")
        .description("Air quality index for your district.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabledIfAvailable()
    }
}

@main
struct UgandaWeatherWidgetBundle: WidgetBundle {
    var body: some Widget {
        UgandaWeatherWidget()
        UgandaDetailsWidget()
        UgandaDailyForecastWidget()
        UgandaSunriseWidget()
        UgandaAgricultureWidget()
        UgandaAirQualityWidget()
    }
}
