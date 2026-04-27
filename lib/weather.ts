import { createSupabaseServer } from "./supabase";

/**
 * Open-Meteo API — besplatno, bez API ključa. Koordinate Niš: 43.32° N, 21.90° E.
 * Dohvata 7 dana u prošlost + današnji + 5 dana u budućnost i ubacuje u `weather_daily` cache.
 */

const NIS_LAT = 43.32;
const NIS_LON = 21.9;

export interface WeatherDay {
  date: string;
  temp_max: number | null;
  temp_min: number | null;
  precipitation: number | null;
  weather_code: number | null;
  summary: string | null;
}

// Open-Meteo WMO weather codes → kratki srpski opis
const WMO: Record<number, string> = {
  0: "Vedro",
  1: "Uglavnom vedro",
  2: "Delimično oblačno",
  3: "Oblačno",
  45: "Magla",
  48: "Gusta magla",
  51: "Slaba rosulja",
  53: "Umerena rosulja",
  55: "Jaka rosulja",
  61: "Slaba kiša",
  63: "Umerena kiša",
  65: "Jaka kiša",
  71: "Slab sneg",
  73: "Umeren sneg",
  75: "Jak sneg",
  80: "Pljuskovi",
  81: "Jaki pljuskovi",
  82: "Vrlo jaki pljuskovi",
  95: "Grmljavina",
  96: "Grmljavina s gradom",
  99: "Jaka grmljavina s gradom",
};

function codeToSummary(code: number | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  return WMO[code] ?? `Kod ${code}`;
}

/**
 * Dohvat prognoze + past_days iz Open-Meteo. Poziva se iz API route-a (za refresh)
 * i rezultat kešira u bazi.
 */
export async function fetchAndCacheWeather(
  pastDays = 14,
  forecastDays = 7
): Promise<number> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(NIS_LAT));
  url.searchParams.set("longitude", String(NIS_LON));
  url.searchParams.set("timezone", "Europe/Belgrade");
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,cloud_cover_mean,sunshine_duration"
  );
  url.searchParams.set("past_days", String(pastDays));
  url.searchParams.set("forecast_days", String(forecastDays));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = (await res.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      weather_code?: number[];
      cloud_cover_mean?: number[];
      sunshine_duration?: number[]; // sekunde
    };
  };

  const daily = data.daily;
  if (!daily?.time) return 0;

  const supabase = createSupabaseServer();
  let count = 0;
  for (let i = 0; i < daily.time.length; i++) {
    const date = daily.time[i];
    const code = daily.weather_code?.[i] ?? null;
    const precip = daily.precipitation_sum?.[i] ?? 0;
    const clouds = daily.cloud_cover_mean?.[i] ?? null;
    const sunH = (daily.sunshine_duration?.[i] ?? 0) / 3600; // u satima
    const summary = smartSummary({ code, precip, clouds, sunshineHours: sunH });

    await supabase.rpc("upsert_weather_daily", {
      p_date: date,
      p_temp_max: daily.temperature_2m_max?.[i] ?? null,
      p_temp_min: daily.temperature_2m_min?.[i] ?? null,
      p_precipitation: precip,
      p_weather_code: code,
      p_summary: summary,
    });
    count++;
  }
  return count;
}

/**
 * Pametna deskripcija vremena — koristi cloud cover i sunshine duration da
 * popravi slučaj gde je Open-Meteo dao "Oblačno" (code 3) za dan sa 8h sunca.
 *
 * Prioritet: padavine > magla > pokrivenost neba.
 */
function smartSummary(opts: {
  code: number | null;
  precip: number;
  clouds: number | null;
  sunshineHours: number;
}): string | null {
  const { code, precip, clouds, sunshineHours } = opts;

  // Ako ima padavina — koristi precipitation kod (61-82, 95-99)
  if (code !== null && code >= 51) {
    return WMO[code] ?? `Kod ${code}`;
  }

  // Magla ima prioritet ako je weather_code 45/48 (pravi fog event)
  if (code === 45 || code === 48) {
    // Ali ako istovremeno ima >6h sunca, nije bila magla ceo dan
    if (sunshineHours >= 6) {
      return clouds !== null && clouds < 35 ? "Sunčano" : "Pretežno sunčano";
    }
    return WMO[code] ?? null;
  }

  // Bez padavina i bez magle — klasifikuj po cloud cover + sunshine
  if (clouds !== null) {
    if (clouds < 20 || sunshineHours >= 9) return "Sunčano";
    if (clouds < 50) return "Pretežno sunčano";
    if (clouds < 75) return "Delimično oblačno";
    if (clouds < 90) return "Pretežno oblačno";
    return "Oblačno";
  }

  // Fallback — ako nemamo clouds, koristi samo sunshine
  if (sunshineHours >= 9) return "Sunčano";
  if (sunshineHours >= 6) return "Pretežno sunčano";
  if (sunshineHours >= 3) return "Delimično oblačno";

  // Totalno bez podataka — koristi weather_code
  return code !== null ? WMO[code] ?? null : null;
}

/**
 * Dohvat vremena za jedan dan (iz cache-a; ako nema, null).
 */
export async function getWeatherForDate(date: string): Promise<WeatherDay | null> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("weather_daily")
    .select("date, temp_max, temp_min, precipitation, weather_code, summary")
    .eq("date", date)
    .maybeSingle();
  return (data as WeatherDay) ?? null;
}

/**
 * Dohvat vremena za opseg — za prikaz trenda sa grafikom ili u analitici.
 */
export async function getWeatherRange(
  start: string,
  end: string
): Promise<WeatherDay[]> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("weather_daily")
    .select("date, temp_max, temp_min, precipitation, weather_code, summary")
    .gte("date", start)
    .lte("date", end)
    .order("date");
  return (data as WeatherDay[]) ?? [];
}
