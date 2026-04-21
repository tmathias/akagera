/**
 * MapToolbar — floating control bar over the Cesium map.
 * Touch-optimized with large hit targets for tablet use.
 */

import { useState } from 'react';
import {
  Layers, Cloud, Plane, Route, Map, Thermometer,
  Wind, Eye, Snowflake, CloudRain, BarChart2, X,
} from 'lucide-react';
import { useMapStore, WeatherLayer, MapLayer } from '@/store/mapStore';
import { cn } from '@/lib/utils';

const WEATHER_LAYERS: { key: WeatherLayer; label: string; icon: React.ReactNode }[] = [
  { key: 'wind', label: 'Wind', icon: <Wind size={14} /> },
  { key: 'temp', label: 'Temp', icon: <Thermometer size={14} /> },
  { key: 'rain', label: 'Precip', icon: <CloudRain size={14} /> },
  { key: 'clouds', label: 'Clouds', icon: <Cloud size={14} /> },
  { key: 'visibility', label: 'Vis', icon: <Eye size={14} /> },
  { key: 'icing', label: 'Icing', icon: <Snowflake size={14} /> },
];

const BASE_LAYERS: { key: MapLayer; label: string }[] = [
  { key: 'terrain', label: 'OSM' },
  { key: 'satellite', label: 'SAT' },
  { key: 'vfr', label: 'VFR' },
  { key: 'ifr', label: 'IFR' },
];

export function MapToolbar() {
  const [showWxPicker, setShowWxPicker] = useState(false);
  const [showLayerPicker, setShowLayerPicker] = useState(false);

  const {
    baseLayer, setBaseLayer,
    weatherLayer, setWeatherLayer,
    showWeather, toggleWeather,
    traffic, toggleTraffic,
    show3D, toggle3D,
    isDrawingRoute, setDrawingRoute, clearRoute,
    activeRouteWaypoints,
  } = useMapStore();

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-none">
      {/* Primary toolbar */}
      <div className="flex gap-2 pointer-events-auto">
        {/* Map layer picker */}
        <div className="relative">
          <ToolButton
            active={showLayerPicker}
            onClick={() => { setShowLayerPicker((v) => !v); setShowWxPicker(false); }}
            title="Map Layers"
          >
            <Layers size={18} />
          </ToolButton>
          {showLayerPicker && (
            <div className="absolute top-12 left-0 bg-panel border border-panel-border rounded-lg p-2 flex flex-col gap-1 min-w-[80px]">
              {BASE_LAYERS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => { setBaseLayer(l.key); setShowLayerPicker(false); }}
                  className={cn(
                    'px-3 py-2 rounded text-xs font-cockpit text-left transition-colors',
                    baseLayer === l.key
                      ? 'bg-avionics-blue text-white'
                      : 'text-muted-foreground hover:bg-panel-muted',
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Weather overlay */}
        <div className="relative">
          <ToolButton
            active={showWeather}
            onClick={() => { setShowWxPicker((v) => !v); }}
            title="Weather Overlays"
          >
            <Cloud size={18} />
          </ToolButton>
          {showWxPicker && (
            <div className="absolute top-12 left-0 bg-panel border border-panel-border rounded-lg p-2 flex flex-col gap-1 min-w-[100px]">
              <button
                onClick={() => { setWeatherLayer('none'); setShowWxPicker(false); }}
                className={cn(
                  'px-3 py-2 rounded text-xs text-left transition-colors flex items-center gap-2',
                  weatherLayer === 'none' ? 'bg-panel-muted text-white' : 'text-muted-foreground hover:bg-panel-muted',
                )}
              >
                <X size={12} /> None
              </button>
              {WEATHER_LAYERS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => { setWeatherLayer(l.key); setShowWxPicker(false); }}
                  className={cn(
                    'px-3 py-2 rounded text-xs text-left transition-colors flex items-center gap-2',
                    weatherLayer === l.key
                      ? 'bg-avionics-blue text-white'
                      : 'text-muted-foreground hover:bg-panel-muted',
                  )}
                >
                  {l.icon} {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Traffic toggle */}
        <ToolButton
          active={traffic.showTraffic}
          onClick={toggleTraffic}
          title="ADS-B Traffic"
        >
          <Plane size={18} />
        </ToolButton>

        {/* Route drawing */}
        <ToolButton
          active={isDrawingRoute}
          onClick={() => {
            if (isDrawingRoute) {
              setDrawingRoute(false);
            } else {
              clearRoute();
              setDrawingRoute(true);
            }
          }}
          title={isDrawingRoute ? 'Stop drawing route' : 'Draw route'}
        >
          <Route size={18} />
        </ToolButton>

        {/* 3D toggle */}
        <ToolButton active={show3D} onClick={toggle3D} title="3D Terrain">
          <Map size={18} />
        </ToolButton>
      </div>

      {/* Route info pill */}
      {activeRouteWaypoints.length > 0 && (
        <div className="pointer-events-auto flex items-center gap-2 bg-panel border border-panel-border rounded-full px-3 py-1 text-xs font-cockpit">
          <BarChart2 size={12} className="text-avionics-green" />
          <span className="text-avionics-green">{activeRouteWaypoints.length} WPT</span>
          {isDrawingRoute && <span className="text-muted-foreground">click map to add</span>}
          <button
            onClick={clearRoute}
            className="text-muted-foreground hover:text-white ml-1"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function ToolButton({
  children, active, onClick, title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center transition-all border',
        'backdrop-blur-sm shadow-lg',
        active
          ? 'bg-avionics-blue border-avionics-blue text-white'
          : 'bg-panel/80 border-panel-border text-muted-foreground hover:text-white hover:bg-panel',
      )}
    >
      {children}
    </button>
  );
}
