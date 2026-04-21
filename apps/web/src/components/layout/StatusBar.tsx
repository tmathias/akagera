import { useMapStore } from '@/store/mapStore';
import { useTraffic } from '@/hooks/useTraffic';
import { Signal, Plane, AlertTriangle } from 'lucide-react';

export function StatusBar() {
  const { traffic, activeRouteWaypoints, center } = useMapStore();
  const { states, loading, error } = useTraffic();

  const [lon, lat] = center;
  const trafficCount = states.length;

  return (
    <div className="h-7 flex items-center px-4 gap-6 bg-panel border-t border-panel-border flex-shrink-0 text-xs font-cockpit text-muted-foreground">
      {/* Position */}
      <span className="tabular-nums">
        {Math.abs(lat).toFixed(4)}°{lat >= 0 ? 'N' : 'S'}&nbsp;
        {Math.abs(lon).toFixed(4)}°{lon >= 0 ? 'E' : 'W'}
      </span>

      <div className="h-3 w-px bg-panel-border" />

      {/* Traffic */}
      <span className="flex items-center gap-1">
        <Plane size={11} className={traffic.showTraffic ? 'text-avionics-cyan' : 'text-muted-foreground'} />
        {loading ? 'updating…' : `${trafficCount} aircraft`}
      </span>

      {/* Route */}
      {activeRouteWaypoints.length > 0 && (
        <>
          <div className="h-3 w-px bg-panel-border" />
          <span className="text-avionics-green">{activeRouteWaypoints.length} WPT route active</span>
        </>
      )}

      {error && (
        <>
          <div className="h-3 w-px bg-panel-border" />
          <span className="flex items-center gap-1 text-avionics-amber">
            <AlertTriangle size={11} /> Traffic data error
          </span>
        </>
      )}

      <div className="flex-1" />

      <span className="flex items-center gap-1 text-avionics-green">
        <Signal size={11} /> GPS
      </span>
    </div>
  );
}
