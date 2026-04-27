import type { WeatherDay } from "@/lib/weather";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
} from "lucide-react";

function iconFor(code: number | null | undefined) {
  if (code === null || code === undefined) return Cloud;
  if (code === 0 || code === 1) return Sun;
  if (code === 2 || code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 55) return CloudDrizzle;
  if (code >= 61 && code <= 65) return CloudRain;
  if (code >= 71 && code <= 75) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

export default function WeatherBadge({
  weather,
  compact = false,
}: {
  weather: WeatherDay | null;
  compact?: boolean;
}) {
  if (!weather) {
    return compact ? null : (
      <div className="text-xs text-ink-400">Vreme nije dostupno</div>
    );
  }
  const Icon = iconFor(weather.weather_code);
  const tMax = weather.temp_max !== null ? Math.round(weather.temp_max) : null;
  const tMin = weather.temp_min !== null ? Math.round(weather.temp_min) : null;
  const rain =
    weather.precipitation !== null && weather.precipitation > 0
      ? ` · ${weather.precipitation.toFixed(1).replace(".", ",")}mm`
      : "";

  return (
    <div
      className={`inline-flex items-center gap-2 ${
        compact ? "text-xs" : "text-sm"
      } text-ink-700`}
      title={weather.summary ?? undefined}
    >
      <Icon size={compact ? 14 : 16} className="text-ink-500" />
      <span className="tabular-nums font-semibold">
        {tMax !== null ? `${tMax}°` : "—"}
        {tMin !== null && ` / ${tMin}°`}
      </span>
      {!compact && weather.summary && (
        <span className="text-ink-500">· {weather.summary}{rain}</span>
      )}
    </div>
  );
}
