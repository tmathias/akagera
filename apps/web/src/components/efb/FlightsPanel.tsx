/**
 * FlightsPanel — logbook browser + quick flight-log entry form.
 * Shows totals summary at top, then a chronological list of flights.
 * Inline "New Flight" form creates a record without leaving the map.
 */

import { useEffect, useState, useCallback } from 'react';
import { Plus, Plane, Clock, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { flightsApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

interface Flight {
  id: string;
  flightDate: string;
  departureIcao: string;
  arrivalIcao: string;
  airborneMinutes: number | null;
  blockMinutes: number | null;
  landingCount: number;
  exercise: string | null;
  remarks: string | null;
  status: string;
  aircraft: { registration: string; type: string } | null;
  pic: { name: string } | null;
}

interface LogbookSummary {
  totalFlights: number;
  totalHours: number;
  totalLandings: number;
}

function minutesToHHMM(mins: number | null) {
  if (!mins) return '—';
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'text-avionics-green',
  AIRBORNE: 'text-avionics-cyan',
  PENDING: 'text-avionics-amber',
  CANCELLED: 'text-muted-foreground line-through',
};

export function FlightsPanel() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [summary, setSummary] = useState<LogbookSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New flight form state
  const [form, setForm] = useState({
    flightDate: new Date().toISOString().slice(0, 10),
    departureIcao: '',
    arrivalIcao: '',
    airborneMinutes: '',
    landingCount: '1',
    exercise: '',
    remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [flightData, summaryData] = await Promise.all([
        flightsApi.list() as Promise<Flight[]>,
        flightsApi.summary() as Promise<LogbookSummary>,
      ]);
      setFlights(flightData ?? []);
      setSummary(summaryData);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const submitFlight = async () => {
    if (!form.departureIcao || !form.arrivalIcao) return;
    setSubmitting(true);
    try {
      await flightsApi.create({
        flightDate: new Date(form.flightDate),
        departureIcao: form.departureIcao.toUpperCase(),
        arrivalIcao: form.arrivalIcao.toUpperCase(),
        airborneMinutes: form.airborneMinutes ? Number(form.airborneMinutes) : null,
        landingCount: Number(form.landingCount),
        exercise: form.exercise || null,
        remarks: form.remarks || null,
        status: 'COMPLETED',
      });
      setShowForm(false);
      setForm({ flightDate: new Date().toISOString().slice(0, 10), departureIcao: '', arrivalIcao: '', airborneMinutes: '', landingCount: '1', exercise: '', remarks: '' });
      fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logbook totals */}
      {summary && (
        <div className="grid grid-cols-3 gap-1 p-3 border-b border-panel-border flex-shrink-0">
          <SummaryChip label="Flights" value={String(summary.totalFlights)} />
          <SummaryChip label="Hours" value={`${summary.totalHours}h`} />
          <SummaryChip label="Landings" value={String(summary.totalLandings)} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-panel-border flex-shrink-0">
        <button
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            'flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors',
            showForm ? 'bg-panel-muted text-white' : 'bg-avionics-blue text-white hover:opacity-90',
          )}
        >
          <Plus size={12} />
          Log Flight
        </button>
      </div>

      {/* Inline new flight form */}
      {showForm && (
        <div className="px-3 py-2 border-b border-panel-border flex-shrink-0 bg-panel-muted space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Date">
              <input type="date" value={form.flightDate}
                onChange={(e) => setForm((f) => ({ ...f, flightDate: e.target.value }))}
                className="efb-input" />
            </FormField>
            <FormField label="Duration (min)">
              <input type="number" placeholder="60" value={form.airborneMinutes}
                onChange={(e) => setForm((f) => ({ ...f, airborneMinutes: e.target.value }))}
                className="efb-input" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="From (ICAO)">
              <input type="text" placeholder="HRYR" maxLength={4} value={form.departureIcao}
                onChange={(e) => setForm((f) => ({ ...f, departureIcao: e.target.value.toUpperCase() }))}
                className="efb-input uppercase" />
            </FormField>
            <FormField label="To (ICAO)">
              <input type="text" placeholder="HTDA" maxLength={4} value={form.arrivalIcao}
                onChange={(e) => setForm((f) => ({ ...f, arrivalIcao: e.target.value.toUpperCase() }))}
                className="efb-input uppercase" />
            </FormField>
          </div>
          <FormField label="Exercise / Type">
            <input type="text" placeholder="Charter, Training, ex19…" value={form.exercise}
              onChange={(e) => setForm((f) => ({ ...f, exercise: e.target.value }))}
              className="efb-input" />
          </FormField>
          <FormField label="Remarks">
            <input type="text" placeholder="Optional remarks" value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              className="efb-input" />
          </FormField>
          <div className="flex gap-2">
            <button onClick={submitFlight} disabled={submitting}
              className="flex-1 bg-avionics-green/80 hover:bg-avionics-green text-white rounded py-1.5 text-xs font-cockpit disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Flight'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-3 bg-panel border border-panel-border rounded text-xs text-muted-foreground hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Flight list */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-center text-muted-foreground text-sm">Loading logbook…</div>}
        {!loading && !flights.length && (
          <div className="p-8 text-center text-muted-foreground">
            <Plane size={28} className="mx-auto mb-3 opacity-30 rotate-45" />
            <p className="text-sm">No flights logged yet</p>
          </div>
        )}
        {flights.map((f) => {
          const expanded = expandedId === f.id;
          return (
            <div key={f.id} className="border-b border-panel-border">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-panel-muted transition-colors text-left"
                onClick={() => setExpandedId(expanded ? null : f.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-cockpit text-white">{f.departureIcao}</span>
                    <ArrowRight size={10} className="text-muted-foreground flex-shrink-0" />
                    <span className="font-cockpit text-white">{f.arrivalIcao}</span>
                    {f.aircraft && (
                      <span className="text-muted-foreground ml-1">{f.aircraft.registration}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-cockpit">
                    <span>{formatDate(f.flightDate)}</span>
                    <span className="flex items-center gap-0.5">
                      <Clock size={9} /> {minutesToHHMM(f.airborneMinutes)}
                    </span>
                    {f.exercise && <span className="text-avionics-cyan/70">{f.exercise}</span>}
                  </div>
                </div>
                <span className={cn('text-[10px] font-cockpit mr-1', STATUS_COLORS[f.status] ?? '')}>
                  {f.status}
                </span>
                {expanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
              </button>
              {expanded && (
                <div className="px-3 pb-2 text-[11px] text-muted-foreground grid grid-cols-2 gap-1 bg-panel-muted/50">
                  <span>Landings: <b className="text-white">{f.landingCount}</b></span>
                  <span>Block: <b className="text-white">{minutesToHHMM(f.blockMinutes)}</b></span>
                  {f.pic && <span className="col-span-2">PIC: <b className="text-white">{f.pic.name}</b></span>}
                  {f.remarks && <span className="col-span-2">Remarks: <b className="text-white">{f.remarks}</b></span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel-muted rounded-lg p-2 text-center">
      <div className="text-[10px] text-muted-foreground font-cockpit">{label}</div>
      <div className="text-sm font-bold font-cockpit text-white">{value}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground font-cockpit block mb-0.5">{label}</label>
      {children}
    </div>
  );
}
