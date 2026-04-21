/**
 * ChecklistPanel — interactive checklists with check/uncheck per item.
 * Supports pre-flight, startup, taxi, takeoff, cruise, landing, shutdown phases.
 * State is local (not persisted) — resets when phase changes, as is standard.
 * Critical items highlighted in amber.
 */

import { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Circle, RotateCcw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Built-in Robinson R44 checklist (typical helicopter training fleet)
// In production, checklists are loaded from the backend per aircraft type.
const BUILTIN_CHECKLISTS: Record<string, Array<{ id: string; text: string; response: string; critical?: boolean }>> = {
  'Pre-Flight': [
    { id: 'pf1', text: 'Technical log — reviewed and signed', response: 'DONE', critical: true },
    { id: 'pf2', text: 'Fuel — quantity confirmed, caps secure', response: 'CHECKED', critical: true },
    { id: 'pf3', text: 'Oil level — within limits', response: 'CHECKED', critical: true },
    { id: 'pf4', text: 'Main rotor blades — condition and security', response: 'CHECKED' },
    { id: 'pf5', text: 'Tail rotor — condition, travel, security', response: 'CHECKED', critical: true },
    { id: 'pf6', text: 'Drive belt — condition, tension', response: 'CHECKED', critical: true },
    { id: 'pf7', text: 'Skids / landing gear — condition', response: 'CHECKED' },
    { id: 'pf8', text: 'Windows and doors — clean, secure', response: 'CHECKED' },
    { id: 'pf9', text: 'Pitot cover — removed', response: 'REMOVED', critical: true },
    { id: 'pf10', text: 'Chocks and tie-downs — removed', response: 'REMOVED' },
    { id: 'pf11', text: 'Weight & Balance — calculated and within limits', response: 'CHECKED', critical: true },
    { id: 'pf12', text: 'Weather — briefing obtained, filed if required', response: 'BRIEFED' },
  ],
  'Engine Start': [
    { id: 'es1', text: 'Seats and belts — adjusted and fastened', response: 'CHECKED' },
    { id: 'es2', text: 'Fuel valve — ON', response: 'ON', critical: true },
    { id: 'es3', text: 'Mixture — RICH (if applicable)', response: 'RICH' },
    { id: 'es4', text: 'Throttle — idle, friction set', response: 'IDLE' },
    { id: 'es5', text: 'Rotor brake — OFF', response: 'OFF', critical: true },
    { id: 'es6', text: 'Master — ON', response: 'ON' },
    { id: 'es7', text: 'Governor — ON', response: 'ON' },
    { id: 'es8', text: 'Battery — check voltage ≥ 12V', response: 'CHECKED', critical: true },
    { id: 'es9', text: 'Area clear — announce "clear"', response: 'CLEAR', critical: true },
    { id: 'es10', text: 'Start engine — max 10 s cranking', response: 'STARTED' },
    { id: 'es11', text: 'Oil pressure — rises within 30 s', response: 'CHECKED', critical: true },
    { id: 'es12', text: 'RPM — stabilise at idle, check all instruments', response: 'CHECKED' },
  ],
  'Takeoff': [
    { id: 'to1', text: 'Engine instruments — in green', response: 'CHECKED', critical: true },
    { id: 'to2', text: 'Carb heat — ON, check RPM drop, OFF', response: 'CHECKED' },
    { id: 'to3', text: 'Altimeter — set QNH', response: 'SET' },
    { id: 'to4', text: 'Radio / transponder — set, squawk assigned', response: 'SET' },
    { id: 'to5', text: 'Doors and windows — secured', response: 'SECURED' },
    { id: 'to6', text: 'Hover check — power margin, balance, controls', response: 'CHECKED', critical: true },
  ],
  'Landing': [
    { id: 'la1', text: 'Landing area — confirmed clear', response: 'CONFIRMED', critical: true },
    { id: 'la2', text: 'Wind — confirmed, crosswind within limits', response: 'CHECKED' },
    { id: 'la3', text: 'Fuel — sufficient for missed approach', response: 'CHECKED', critical: true },
    { id: 'la4', text: 'Altimeter — set QNH / QFE', response: 'SET' },
    { id: 'la5', text: 'Approach briefing — completed', response: 'DONE' },
  ],
  'Shutdown': [
    { id: 'sd1', text: 'Collective — full down', response: 'DOWN' },
    { id: 'sd2', text: 'Throttle — idle, cool-down 2 min', response: 'IDLE', critical: true },
    { id: 'sd3', text: 'Ignition — OFF after cool-down', response: 'OFF' },
    { id: 'sd4', text: 'Rotor brake — apply when RPM < 40%', response: 'APPLIED' },
    { id: 'sd5', text: 'Master — OFF', response: 'OFF' },
    { id: 'sd6', text: 'Technical log — complete all entries', response: 'DONE', critical: true },
    { id: 'sd7', text: 'Fuel for next flight — confirm or arrange', response: 'CONFIRMED' },
    { id: 'sd8', text: 'Tie-downs and rotor tie — fitted', response: 'FITTED' },
  ],
};

const PHASES = Object.keys(BUILTIN_CHECKLISTS);

export function ChecklistPanel() {
  const [phase, setPhase] = useState(PHASES[0]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const items = BUILTIN_CHECKLISTS[phase] ?? [];
  const total = items.length;
  const done = items.filter((i) => checked.has(i.id)).length;
  const allDone = done === total;

  // Reset checks when changing phase
  useEffect(() => { setChecked(new Set()); }, [phase]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const reset = () => setChecked(new Set());

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Phase selector */}
      <div className="flex overflow-x-auto gap-1 p-2 border-b border-panel-border flex-shrink-0 scrollbar-hide">
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={cn(
              'flex-shrink-0 px-2.5 py-1 rounded text-[10px] font-cockpit transition-colors whitespace-nowrap',
              phase === p
                ? 'bg-avionics-blue text-white'
                : 'bg-panel-muted text-muted-foreground hover:text-white',
            )}
          >
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Progress bar + controls */}
      <div className="px-3 py-2 border-b border-panel-border flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-cockpit text-muted-foreground">
            {done} / {total} items
          </span>
          <div className="flex items-center gap-2">
            {allDone && (
              <span className="text-[10px] font-cockpit text-avionics-green flex items-center gap-1">
                <CheckCircle size={11} /> COMPLETE
              </span>
            )}
            <button onClick={reset} className="text-muted-foreground hover:text-white" title="Reset checklist">
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
        <div className="h-1 bg-panel-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', allDone ? 'bg-avionics-green' : 'bg-avionics-blue')}
            style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <BookOpen size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No checklist for this phase</p>
          </div>
        )}
        {items.map((item, idx) => {
          const isChecked = checked.has(item.id);
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={cn(
                'w-full flex items-start gap-3 px-3 py-2.5 border-b border-panel-border text-left transition-colors',
                isChecked ? 'bg-panel-muted/40' : 'hover:bg-panel-muted',
              )}
            >
              {/* Sequence number */}
              <span className="text-[10px] font-cockpit text-muted-foreground w-4 mt-0.5 flex-shrink-0 tabular-nums">
                {String(idx + 1).padStart(2, '0')}
              </span>

              {/* Check icon */}
              {isChecked
                ? <CheckCircle size={15} className="text-avionics-green flex-shrink-0 mt-0.5" />
                : <Circle size={15} className={cn('flex-shrink-0 mt-0.5', item.critical ? 'text-avionics-amber' : 'text-muted-foreground')} />
              }

              {/* Item text */}
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'text-xs leading-snug',
                  isChecked ? 'line-through text-muted-foreground' : item.critical ? 'text-avionics-amber' : 'text-white',
                )}>
                  {item.critical && !isChecked && (
                    <AlertTriangle size={10} className="inline mr-1 text-avionics-amber" />
                  )}
                  {item.text}
                </span>
              </div>

              {/* Expected response */}
              <span className={cn(
                'text-[10px] font-cockpit ml-2 flex-shrink-0',
                isChecked ? 'text-avionics-green' : 'text-muted-foreground',
              )}>
                {item.response}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
