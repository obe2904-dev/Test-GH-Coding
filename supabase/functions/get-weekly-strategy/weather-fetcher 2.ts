// Fetch weather from Open-Meteo (free, no API key, 16-day forecast).
// _apiKey is kept for backwards-compat with the call site but is not used.
export async function fetchWeatherFromCoordinates(lat, lon, weekDays, hasOutdoorSeating, _apiKey) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` + `&daily=weathercode,temperature_2m_max,temperature_2m_min,apparent_temperature_mean,precipitation_probability_max,windspeed_10m_max` + `&timezone=Europe%2FCopenhagen&forecast_days=16&wind_speed_unit=ms`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API failed: ${response.status}`);
  }
  const data = await response.json();
  const daily = data.daily ?? {};
  // Build date → daily data map
  const dates = daily.time ?? [];
  const dailyMap = new Map();
  dates.forEach((date, i)=>{
    dailyMap.set(date, {
      wmo: daily.weathercode?.[i] ?? 3,
      tempMax: Math.round(daily.temperature_2m_max?.[i] ?? 10),
      tempMin: Math.round(daily.temperature_2m_min?.[i] ?? 5),
      feelsLike: Math.round(daily.apparent_temperature_mean?.[i] ?? 8),
      precipProb: Math.round(daily.precipitation_probability_max?.[i] ?? 25),
      windSpeed: Math.round(daily.windspeed_10m_max?.[i] ?? 4)
    });
  });
  // Build weather days for the plan week
  const days = weekDays.map((date, index)=>{
    const d = dailyMap.get(date);
    if (!d) return createFallbackDay(date);
    return {
      date,
      temp_min: d.tempMin,
      temp_max: d.tempMax,
      feels_like: d.feelsLike,
      condition: mapWMOCondition(d.wmo),
      precipitation_chance: d.precipProb,
      wind_speed: d.windSpeed,
      humidity: 70,
      reliability: index < 4 ? 'specific' : index < 7 ? 'cautious' : 'seasonal'
    };
  });
  const avgTemp = Math.round(days.reduce((s, d)=>s + d.temp_max, 0) / days.length);
  return {
    days,
    pattern: deriveWeatherPattern(days, avgTemp),
    avg_temp: avgTemp,
    has_outdoor_seating: hasOutdoorSeating
  };
}
// Map WMO weather interpretation code to strategy condition type
function mapWMOCondition(wmo) {
  if (wmo === 0) return 'sunny';
  if (wmo <= 2) return 'partly_cloudy';
  if (wmo === 3) return 'cloudy';
  if (wmo === 45 || wmo === 48) return 'fog';
  if (wmo >= 51 && wmo <= 67) return 'rain';
  if (wmo >= 71 && wmo <= 77) return 'snow';
  if (wmo >= 80 && wmo <= 82) return 'rain';
  if (wmo >= 85 && wmo <= 86) return 'snow';
  if (wmo >= 95) return 'rain'; // thunderstorm
  return 'cloudy';
}
// Determine weather pattern with Danish climate thresholds
function deriveWeatherPattern(days, avgTemp) {
  const rainDays = days.filter((d)=>d.condition === 'rain').length;
  // Rainy week takes priority
  if (rainDays >= 3) return 'rainy_week';
  // Temperature-based patterns (Danish climate)
  if (avgTemp < 5) return 'cold_week';
  if (avgTemp > 20) return 'hot_week';
  if (avgTemp > 14) return 'mild_week';
  return 'mixed_week';
}
// Seasonal fallback when API fails or no coordinates
export function createSeasonalFallbackWeather(weekDays, hasOutdoorSeating) {
  const days = weekDays.map((date)=>createFallbackDay(date));
  const avgTemp = Math.round(days.reduce((s, d)=>s + d.temp_max, 0) / days.length);
  return {
    days,
    pattern: deriveWeatherPattern(days, avgTemp),
    avg_temp: avgTemp,
    has_outdoor_seating: hasOutdoorSeating
  };
}
// Create fallback day based on Danish seasonal averages
function createFallbackDay(date) {
  const month = new Date(date).getMonth() + 1;
  // Danish seasonal baselines: [min_temp, max_temp, rain_chance, wind, humidity]
  const seasonalDefaults = {
    1: [
      -2,
      3,
      40,
      6,
      85
    ],
    2: [
      -1,
      4,
      35,
      6,
      80
    ],
    3: [
      2,
      8,
      30,
      5,
      75
    ],
    4: [
      6,
      13,
      25,
      5,
      70
    ],
    5: [
      10,
      18,
      20,
      4,
      65
    ],
    6: [
      14,
      22,
      15,
      4,
      65
    ],
    7: [
      16,
      24,
      15,
      3,
      70
    ],
    8: [
      16,
      23,
      20,
      3,
      70
    ],
    9: [
      12,
      18,
      25,
      4,
      75
    ],
    10: [
      8,
      13,
      35,
      5,
      80
    ],
    11: [
      3,
      7,
      40,
      6,
      85
    ],
    12: [
      0,
      4,
      40,
      6,
      85
    ]
  };
  const [min, max, rain, wind, humid] = seasonalDefaults[month] || [
    10,
    15,
    25,
    4,
    70
  ];
  return {
    date,
    temp_min: min,
    temp_max: max,
    feels_like: Math.round((min + max) / 2),
    condition: 'cloudy',
    precipitation_chance: rain,
    wind_speed: wind,
    humidity: humid,
    reliability: 'seasonal'
  };
}
