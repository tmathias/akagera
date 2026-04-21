/**
 * useTraffic — polls OpenSky via the backend proxy every 15 s.
 * Automatically derives bounding box from current Cesium camera viewport.
 * Returns typed aircraft state array and loading/error state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { trafficApi } from '@/lib/api';
import { useMapStore } from '@/store/mapStore';

export interface AircraftState {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  timePosition: number | null;
  lastContact: number;
  longitude: number | null;
  latitude: number | null;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;
  trueTrack: number | null;
  verticalRate: number | null;
  squawk: string | null;
  category: number | null;
}

const POLL_INTERVAL_MS = 15_000;
// Default bounding box: East Africa (large area for demo)
const DEFAULT_BBOX = { lamin: -5, lamax: 5, lomin: 25, lomax: 37 };

export function useTraffic() {
  const [states, setStates] = useState<AircraftState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIcao, setSelectedIcao] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { traffic, center, altitude } = useMapStore();

  // Derive bounding box from camera position
  // At high altitude show larger area; at low altitude zoom in
  const getBbox = useCallback(() => {
    const [lon, lat] = center;
    const degSpread = Math.max(1, Math.min(20, altitude / 50_000));
    return {
      lamin: lat - degSpread,
      lamax: lat + degSpread,
      lomin: lon - degSpread,
      lomax: lon + degSpread,
    };
  }, [center, altitude]);

  const fetchStates = useCallback(async () => {
    if (!traffic.showTraffic) return;
    setLoading(true);
    setError(null);
    try {
      const bbox = getBbox();
      const data = await trafficApi.getStates(
        bbox.lamin, bbox.lamax, bbox.lomin, bbox.lomax,
      ) as AircraftState[];
      setStates(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [traffic.showTraffic, getBbox]);

  useEffect(() => {
    fetchStates();
    intervalRef.current = setInterval(fetchStates, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStates]);

  const getSelected = useCallback(
    () => states.find((s) => s.icao24 === selectedIcao) ?? null,
    [states, selectedIcao],
  );

  return { states, loading, error, selectedIcao, setSelectedIcao, selectedState: getSelected() };
}
