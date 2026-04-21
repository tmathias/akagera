/**
 * WeatherPanel — shows forecast for the current map center.
 * Renders temperature, wind, precipitation, and cloud bars using Recharts.
 */

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { Thermometer, Wind, CloudRain, Eye } from 'lucide-react';
import { weatherApi } from '@/lib/api';
import { useMapStore } from '@/store/mapStore';

interface ForecastPoint {
  time: string;
  temperature: number;
  windspeed: number;
  winddirection: number;
  visibility: number;
  precipitation: number;
  cloudcover: number;
}

function formatLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function WeatherPanel() {
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { center } = useMapStore();
  const [lon, lat] = center;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    weatherApi.forecast(lat, lon)
      .then((data: any) => {
        if (cancelled) return;
        const d1h = data?.data_1h;
        if (!d1h?.time) { setForecast([]); return; }
        const points: ForecastPoint[] = d1h.time.slice(0, 24).map((t: string, i: number) => ({
          time: formatLocal(t),
          temperature: Math.round(d1h.temperature?.[i] ?? 15),
          windspeed: Math.round(d1h.windspeed?.[i] ?? 0),
          winddirection: Math.round(d1h.winddirection?.[i] ?? 0),
          visibility: Math.round(d1h.visibility?.[i] ?? 10),
          precipitation: +(d1h.precipitation?.[i] ?? 0).toFixed(1),
          cloudcover: Math.round(d1h.cloudcover?.[i] ?? 0),
        }));
        setForecast(points);
      })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [lat, lon]);

  // Show every 3rd label to avoid crowding
  const tickFormatter = (_: string, i: number) => i % 3 === 0 ? forecast[i]?.time ?? '' : '';

  if (loading) return <div className="p-4 text-muted-foreground text-sm text-center">Loading weather…</div>;
  if (error) return <div className="p-4 text-avionics-amber text-sm">Weather unavailable: {error}</div>;
  if (!forecast.length) return <div className="p-4 text-muted-foreground text-sm">No forecast data</div>;

  const current = forecast[0];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-4">
      {/* Current conditions */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<Thermometer size={14} className="text-avionics-amber" />} label="Temp" value={`${current.temperature}°C`} />
        <StatCard icon={<Wind size={14} className="text-avionics-cyan" />} label="Wind" value={`${current.windspeed} kt ${current.winddirection}°`} />
        <StatCard icon={<CloudRain size={14} className="text-avionics-blue" />} label="Precip" value={`${current.precipitation} mm`} />
        <StatCard icon={<Eye size={14} className="text-avionics-green" />} label="Visibility" value={`${current.visibility} km`} />
      </div>

      <SectionLabel>24-Hour Temperature (°C)</SectionLabel>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={forecast} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffb347" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ffb347" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
            <XAxis dataKey="time" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={tickFormatter} />
            <YAxis tick={{ fill: '#666', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: 11 }} />
            <Area type="monotone" dataKey="temperature" stroke="#ffb347" fill="url(#tempGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <SectionLabel>Wind Speed (kt)</SectionLabel>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={forecast} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
            <XAxis dataKey="time" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={tickFormatter} />
            <YAxis tick={{ fill: '#666', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: 11 }} />
            <Area type="monotone" dataKey="windspeed" stroke="#00d4ff" fill="url(#windGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <SectionLabel>Precipitation (mm) & Cloud Cover (%)</SectionLabel>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={forecast} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
            <XAxis dataKey="time" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={tickFormatter} />
            <YAxis yAxisId="left" tick={{ fill: '#666', fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#666', fontSize: 10 }} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="precipitation" fill="#1e6ef5" opacity={0.8} radius={[2, 2, 0, 0]} />
            <Bar yAxisId="right" dataKey="cloudcover" fill="#484f58" opacity={0.5} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-panel-muted rounded-lg p-2 flex items-center gap-2">
      {icon}
      <div>
        <div className="text-[10px] text-muted-foreground font-cockpit">{label}</div>
        <div className="text-sm text-white font-cockpit font-medium">{value}</div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-cockpit text-muted-foreground uppercase tracking-widest">{children}</div>;
}
