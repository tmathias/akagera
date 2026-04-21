import { create } from 'zustand';

export type WeatherLayer = 'wind' | 'temp' | 'rain' | 'clouds' | 'visibility' | 'icing' | 'none';
export type MapLayer = 'terrain' | 'satellite' | 'vfr' | 'ifr';

interface TrafficState {
  showTraffic: boolean;
  showOnGround: boolean;
  lastUpdate: number | null;
}

interface MapState {
  // Viewport
  center: [lon: number, lat: number];
  altitude: number; // camera height in metres
  heading: number;
  pitch: number;

  // Layers
  baseLayer: MapLayer;
  weatherLayer: WeatherLayer;
  showWeather: boolean;
  showTerrain: boolean;
  show3D: boolean;

  // Traffic
  traffic: TrafficState;

  // Route drawing mode
  isDrawingRoute: boolean;
  activeRouteWaypoints: Array<{ lat: number; lon: number; label?: string }>;

  // Actions
  setCenter: (lon: number, lat: number) => void;
  setAltitude: (alt: number) => void;
  setBaseLayer: (layer: MapLayer) => void;
  setWeatherLayer: (layer: WeatherLayer) => void;
  toggleWeather: () => void;
  toggleTraffic: () => void;
  toggle3D: () => void;
  setDrawingRoute: (drawing: boolean) => void;
  addRouteWaypoint: (wp: { lat: number; lon: number; label?: string }) => void;
  clearRoute: () => void;
  setTrafficUpdate: (ts: number) => void;
}

// Default centre: Kigali International Airport (HRYR)
const DEFAULT_CENTER: [number, number] = [30.1395, -1.9686];

export const useMapStore = create<MapState>((set) => ({
  center: DEFAULT_CENTER,
  altitude: 400_000,
  heading: 0,
  pitch: -90,

  baseLayer: 'terrain',
  weatherLayer: 'none',
  showWeather: false,
  showTerrain: true,
  show3D: true,

  traffic: { showTraffic: true, showOnGround: false, lastUpdate: null },

  isDrawingRoute: false,
  activeRouteWaypoints: [],

  setCenter: (lon, lat) => set({ center: [lon, lat] }),
  setAltitude: (altitude) => set({ altitude }),
  setBaseLayer: (baseLayer) => set({ baseLayer }),
  setWeatherLayer: (weatherLayer) => set({ weatherLayer, showWeather: weatherLayer !== 'none' }),
  toggleWeather: () => set((s) => ({ showWeather: !s.showWeather })),
  toggleTraffic: () =>
    set((s) => ({ traffic: { ...s.traffic, showTraffic: !s.traffic.showTraffic } })),
  toggle3D: () => set((s) => ({ show3D: !s.show3D })),
  setDrawingRoute: (isDrawingRoute) => set({ isDrawingRoute }),
  addRouteWaypoint: (wp) =>
    set((s) => ({ activeRouteWaypoints: [...s.activeRouteWaypoints, wp] })),
  clearRoute: () => set({ activeRouteWaypoints: [], isDrawingRoute: false }),
  setTrafficUpdate: (ts) =>
    set((s) => ({ traffic: { ...s.traffic, lastUpdate: ts } })),
}));
