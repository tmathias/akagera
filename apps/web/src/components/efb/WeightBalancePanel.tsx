/**
 * WeightBalancePanel — W&B calculator with graphical CG envelope.
 *
 * Workflow:
 *  1. Select aircraft template (stores stations & envelope definition)
 *  2. Enter weights for each station (pilot, copilot, passengers, baggage, fuel)
 *  3. See calculated CG plotted on envelope chart
 *  4. Green = within limits, Red = out of limits
 *
 * CG Envelope chart uses Recharts ComposedChart:
 *  - Area shape = envelope boundary (filled)
 *  - ReferenceLine = max gross weight
 *  - Scatter point = current CG location
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, Area, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { Scale, Plus, Minus, CheckCircle, AlertTriangle, Save } from 'lucide-react';
import { wbApi, aircraftApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Station {
  id: string;
  name: string;
  arm: number;
  defaultWeight: number;
  maxWeight: number;
}

interface EnvelopePoint {
  weight: number;
  cgMin: number;
  cgMax: number;
}

interface WBTemplate {
  id: string;
  name: string;
  emptyWeight: number;
  emptyCg: number;
  stations: Station[];
  envelopePoints: EnvelopePoint[];
  aircraft: { registration: string; type: string };
}

interface WBResult {
  totalWeight: number;
  totalMoment: number;
  cgInches: number;
  withinLimits: boolean;
  marginPercent: number;
  items: Array<{ stationId: string; name: string; arm: number; weight: number; moment: number }>;
}

// Convert envelope points to chart-friendly format for shaded area
function buildEnvelopeData(points: EnvelopePoint[]) {
  return [...points].sort((a, b) => a.weight - b.weight).map((p) => ({
    weight: p.weight,
    cgMin: p.cgMin,
    cgMax: p.cgMax,
    cgRange: [p.cgMin, p.cgMax] as [number, number],
  }));
}

export function WeightBalancePanel() {
  const [templates, setTemplates] = useState<WBTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WBTemplate | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [result, setResult] = useState<WBResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    wbApi.listTemplates().then((data: any) => {
      setTemplates(data ?? []);
      if (data?.length) loadTemplate(data[0]);
    }).catch(() => {});
  }, []);

  const loadTemplate = useCallback((t: WBTemplate) => {
    setSelectedTemplate(t);
    setResult(null);
    const defaults: Record<string, number> = {};
    t.stations?.forEach((s) => { defaults[s.id] = s.defaultWeight; });
    setWeights(defaults);
  }, []);

  const calculate = useCallback(async () => {
    if (!selectedTemplate) return;
    setCalculating(true);
    try {
      const loadItems = Object.entries(weights).map(([stationId, weight]) => ({ stationId, weight }));
      const res = await wbApi.calculate(selectedTemplate.id, loadItems) as WBResult;
      setResult(res);
    } catch (e) {
      console.error('W&B calc error', e);
    } finally {
      setCalculating(false);
    }
  }, [selectedTemplate, weights]);

  // Auto-calculate on weight change (debounced via timeout is fine here)
  useEffect(() => {
    if (!selectedTemplate) return;
    const t = setTimeout(calculate, 400);
    return () => clearTimeout(t);
  }, [weights, selectedTemplate, calculate]);

  const saveRecord = async () => {
    if (!result || !selectedTemplate) return;
    setSaving(true);
    try {
      const loadItems = Object.entries(weights).map(([stationId, weight]) => ({ stationId, weight }));
      await wbApi.saveRecord({
        aircraftId: selectedTemplate.aircraft?.registration,
        templateId: selectedTemplate.id,
        calculation: result,
        loadItems,
      });
    } finally {
      setSaving(false);
    }
  };

  const envelopeData = selectedTemplate ? buildEnvelopeData(selectedTemplate.envelopePoints ?? []) : [];
  const maxWeight = envelopeData.length ? Math.max(...envelopeData.map((p) => p.weight)) : 3000;
  const cgDomain = envelopeData.length
    ? [
        Math.floor(Math.min(...envelopeData.map((p) => p.cgMin)) - 2),
        Math.ceil(Math.max(...envelopeData.map((p) => p.cgMax)) + 2),
      ]
    : [80, 120];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-4">
      {/* Template selector */}
      <div>
        <label className="text-[10px] font-cockpit text-muted-foreground uppercase tracking-widest mb-1 block">
          Aircraft / Template
        </label>
        <select
          className="w-full bg-panel-muted border border-panel-border rounded px-2 py-2 text-sm text-white"
          onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (t) loadTemplate(t);
          }}
          value={selectedTemplate?.id ?? ''}
        >
          {!templates.length && <option>No templates — add one first</option>}
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.aircraft?.registration} — {t.name}
            </option>
          ))}
        </select>
      </div>

      {selectedTemplate && (
        <>
          {/* Station weights */}
          <div className="space-y-2">
            <div className="text-[10px] font-cockpit text-muted-foreground uppercase tracking-widest">
              Loading Stations
            </div>

            {/* Empty aircraft (read-only) */}
            <StationRow
              label="Empty Aircraft"
              arm={selectedTemplate.emptyCg}
              weight={selectedTemplate.emptyWeight}
              maxWeight={selectedTemplate.emptyWeight}
              readOnly
            />

            {selectedTemplate.stations?.map((s) => (
              <StationRow
                key={s.id}
                label={s.name}
                arm={s.arm}
                weight={weights[s.id] ?? 0}
                maxWeight={s.maxWeight}
                onChange={(v) => setWeights((prev) => ({ ...prev, [s.id]: v }))}
              />
            ))}
          </div>

          {/* CG Envelope Chart */}
          <div>
            <div className="text-[10px] font-cockpit text-muted-foreground uppercase tracking-widest mb-2">
              CG Envelope
            </div>

            {envelopeData.length > 0 ? (
              <div className="h-52 bg-panel-muted rounded-lg p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={envelopeData}
                    margin={{ top: 4, right: 8, left: -10, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                    <XAxis
                      dataKey="weight"
                      domain={[0, maxWeight * 1.05]}
                      type="number"
                      label={{ value: 'Weight (lbs)', fill: '#666', fontSize: 10, position: 'insideBottom', offset: -2 }}
                      tick={{ fill: '#666', fontSize: 10 }}
                    />
                    <YAxis
                      domain={cgDomain}
                      label={{ value: 'CG (in)', fill: '#666', fontSize: 10, angle: -90, position: 'insideLeft' }}
                      tick={{ fill: '#666', fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: 11 }}
                      formatter={(v: any) => [`${v}`, '']}
                    />

                    {/* Envelope shaded area */}
                    <Area
                      type="linear"
                      dataKey="cgRange"
                      stroke="#39d353"
                      strokeWidth={1.5}
                      fill="#39d353"
                      fillOpacity={0.15}
                      legendType="none"
                    />

                    {/* Max gross weight reference line */}
                    <ReferenceLine
                      x={maxWeight}
                      stroke="#ff4444"
                      strokeDasharray="4 4"
                      label={{ value: 'MGW', fill: '#ff4444', fontSize: 10 }}
                    />

                    {/* Current CG point */}
                    {result && (
                      <Scatter
                        data={[{ weight: result.totalWeight, CG: result.cgInches }]}
                        dataKey="CG"
                        fill={result.withinLimits ? '#39d353' : '#ff4444'}
                        name="Current CG"
                        r={6}
                        shape="circle"
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyEnvelopePlaceholder />
            )}
          </div>

          {/* Results summary */}
          {result && (
            <div className={cn(
              'rounded-lg p-3 border flex flex-col gap-2',
              result.withinLimits
                ? 'bg-green-950/30 border-avionics-green/40'
                : 'bg-red-950/30 border-avionics-red/40',
            )}>
              <div className="flex items-center gap-2">
                {result.withinLimits
                  ? <CheckCircle size={16} className="text-avionics-green" />
                  : <AlertTriangle size={16} className="text-avionics-red" />}
                <span className={cn('font-cockpit font-bold text-sm', result.withinLimits ? 'text-avionics-green' : 'text-avionics-red')}>
                  {result.withinLimits ? 'WITHIN LIMITS' : 'OUT OF LIMITS'}
                </span>
                {result.withinLimits && (
                  <span className="ml-auto text-xs text-muted-foreground font-cockpit">
                    {result.marginPercent}% margin
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <WBStat label="Gross Wt" value={`${result.totalWeight.toFixed(0)} lb`} />
                <WBStat label="CG" value={`${result.cgInches.toFixed(2)} in`} />
                <WBStat label="Moment" value={`${(result.totalMoment / 1000).toFixed(1)}k`} />
              </div>
            </div>
          )}

          {/* Save record button */}
          {result && (
            <button
              onClick={saveRecord}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-avionics-blue/80 hover:bg-avionics-blue text-white rounded-lg py-2 text-sm font-cockpit transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save W&B Record'}
            </button>
          )}
        </>
      )}

      {!selectedTemplate && !templates.length && (
        <div className="text-center text-muted-foreground text-sm py-8">
          <Scale size={32} className="mx-auto mb-3 opacity-30" />
          <p>No W&B templates configured.</p>
          <p className="text-xs mt-1">Contact your administrator to add aircraft templates.</p>
        </div>
      )}
    </div>
  );
}

interface StationRowProps {
  label: string;
  arm: number;
  weight: number;
  maxWeight: number;
  readOnly?: boolean;
  onChange?: (v: number) => void;
}

function StationRow({ label, arm, weight, maxWeight, readOnly, onChange }: StationRowProps) {
  const moment = (weight * arm) / 1000;
  const pct = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;

  return (
    <div className="bg-panel-muted rounded px-2 py-1.5 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground font-cockpit">arm {arm}" | {moment.toFixed(2)}k in·lb</div>
      </div>

      {readOnly ? (
        <span className="text-sm font-cockpit text-muted-foreground w-16 text-right">{weight} lb</span>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange?.(Math.max(0, weight - 10))}
            className="w-6 h-6 rounded bg-panel border border-panel-border text-muted-foreground hover:text-white flex items-center justify-center"
          >
            <Minus size={10} />
          </button>
          <input
            type="number"
            className="w-16 bg-panel border border-panel-border rounded text-sm font-cockpit text-center text-white py-0.5 focus:outline-none focus:border-avionics-blue"
            value={weight}
            min={0}
            max={maxWeight}
            onChange={(e) => onChange?.(Math.max(0, Math.min(maxWeight, Number(e.target.value))))}
          />
          <button
            onClick={() => onChange?.(Math.min(maxWeight, weight + 10))}
            className="w-6 h-6 rounded bg-panel border border-panel-border text-muted-foreground hover:text-white flex items-center justify-center"
          >
            <Plus size={10} />
          </button>
        </div>
      )}

      {/* Weight bar */}
      {!readOnly && (
        <div className="w-1 h-8 bg-panel rounded-full overflow-hidden">
          <div
            className={cn('w-full rounded-full transition-all', pct > 95 ? 'bg-avionics-red' : pct > 80 ? 'bg-avionics-amber' : 'bg-avionics-green')}
            style={{ height: `${pct}%`, marginTop: 'auto' }}
          />
        </div>
      )}
    </div>
  );
}

function WBStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground font-cockpit">{label}</div>
      <div className="text-sm text-white font-cockpit font-bold">{value}</div>
    </div>
  );
}

function EmptyEnvelopePlaceholder() {
  return (
    <div className="h-52 bg-panel-muted rounded-lg flex items-center justify-center text-muted-foreground text-xs">
      Envelope data not configured for this template
    </div>
  );
}
