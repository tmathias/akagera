/**
 * useWeather — fetches point forecast for a given lat/lon.
 * Automatically refreshes every 30 minutes.
 */
import { useState, useEffect } from 'react';
import { weatherApi } from '@/lib/api';

export function useWeather(lat: number, lon: number) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await weatherApi.forecast(lat, lon);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    const id = setInterval(fetch, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [lat, lon]);

  return { data, loading, error };
}
