/**
 * EFBPanel — right-side tabbed panel.
 * Tabs: Map (weather detail) | Documents | W&B | Flights | Checklists
 */

import { useState } from 'react';
import {
  Cloud, FileText, Scale, BookOpen, Plane,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WeatherPanel } from './WeatherPanel';
import { DocumentsPanel } from './DocumentsPanel';
import { WeightBalancePanel } from './WeightBalancePanel';
import { FlightsPanel } from './FlightsPanel';
import { ChecklistPanel } from './ChecklistPanel';

type Tab = 'weather' | 'documents' | 'wb' | 'flights' | 'checklists';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'weather', label: 'WX', icon: <Cloud size={16} /> },
  { id: 'documents', label: 'DOCS', icon: <FileText size={16} /> },
  { id: 'wb', label: 'W&B', icon: <Scale size={16} /> },
  { id: 'flights', label: 'LOG', icon: <Plane size={16} /> },
  { id: 'checklists', label: 'CKL', icon: <BookOpen size={16} /> },
];

interface EFBPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function EFBPanel({ collapsed, onToggleCollapse }: EFBPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('weather');

  if (collapsed) {
    return (
      <div className="h-full bg-panel border-l border-panel-border flex flex-col items-center pt-2 gap-2">
        <button onClick={onToggleCollapse} className="p-2 text-muted-foreground hover:text-white">
          <ChevronLeft size={16} />
        </button>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); onToggleCollapse(); }}
            className="p-2 text-muted-foreground hover:text-white"
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full bg-panel border-l border-panel-border flex flex-col overflow-hidden efb-panel">
      {/* Tab bar */}
      <div className="flex items-center border-b border-panel-border flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-cockpit transition-colors border-b-2',
              activeTab === t.id
                ? 'border-avionics-cyan text-avionics-cyan'
                : 'border-transparent text-muted-foreground hover:text-white',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
        {/* Collapse button */}
        <button
          onClick={onToggleCollapse}
          className="px-2 py-2 text-muted-foreground hover:text-white border-b-2 border-transparent"
          title="Collapse EFB panel"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Tab content — fills remaining height with scroll */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'weather' && <WeatherPanel />}
        {activeTab === 'documents' && <DocumentsPanel />}
        {activeTab === 'wb' && <WeightBalancePanel />}
        {activeTab === 'flights' && <FlightsPanel />}
        {activeTab === 'checklists' && <ChecklistPanel />}
      </div>
    </div>
  );
}
