import { useState, useEffect } from 'react';
import { Plane, Wifi, WifiOff, PanelRightOpen, PanelRightClose, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopBarProps {
  efbOpen: boolean;
  onToggleEFB: () => void;
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function TopBar({ efbOpen, onToggleEFB }: TopBarProps) {
  const online = useOnlineStatus();
  const time = useClock();
  const utc = time.toUTCString().slice(17, 25); // HH:MM:SS

  return (
    <div className="h-12 flex items-center px-4 gap-4 bg-panel border-b border-panel-border flex-shrink-0 z-10">
      {/* Logo / brand */}
      <div className="flex items-center gap-2 text-avionics-cyan font-cockpit font-bold tracking-widest text-sm">
        <Plane size={18} className="rotate-45" />
        <span>AKAGERA EFB</span>
      </div>

      <div className="h-4 w-px bg-panel-border" />

      {/* UTC clock — pilot-standard Zulu time */}
      <div className="font-cockpit text-sm text-white tabular-nums">
        <span className="text-muted-foreground text-xs mr-1">UTC</span>
        {utc}Z
      </div>

      <div className="flex-1" />

      {/* Connectivity indicator */}
      <div className={cn('flex items-center gap-1 text-xs', online ? 'text-avionics-green' : 'text-avionics-amber')}>
        {online ? <Wifi size={14} /> : <WifiOff size={14} />}
        <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
      </div>

      <button
        title="User profile"
        className="w-8 h-8 rounded-full bg-panel-muted border border-panel-border flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
      >
        <User size={15} />
      </button>

      <button
        title="Settings"
        className="w-8 h-8 rounded flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
      >
        <Settings size={15} />
      </button>

      {/* Toggle EFB panel */}
      <button
        onClick={onToggleEFB}
        title={efbOpen ? 'Hide EFB panel' : 'Show EFB panel'}
        className="w-8 h-8 rounded flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
      >
        {efbOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
      </button>
    </div>
  );
}
