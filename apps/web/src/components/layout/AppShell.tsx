/**
 * AppShell — master layout for the EFB.
 *
 * Layout structure:
 * ┌──────────────────────────────────────────────────┐
 * │  TopBar  (aircraft selector, clock, status)      │
 * ├───────────────────────────────────┬──────────────┤
 * │                                   │              │
 * │   CesiumViewer (primary map)      │  EFB Panel   │
 * │   + MapToolbar (floating)         │  (tabbed)    │
 * │                                   │              │
 * └───────────────────────────────────┴──────────────┘
 * │  StatusBar  (GPS, traffic count, weather METAR)  │
 * └──────────────────────────────────────────────────┘
 *
 * The EFB panel is resizable by dragging the divider.
 * On mobile/portrait it slides up as a bottom sheet.
 */

import { useState, useCallback, useRef } from 'react';
import { CesiumViewer } from '@/components/map/CesiumViewer';
import { MapToolbar } from '@/components/map/MapToolbar';
import { EFBPanel } from '@/components/efb/EFBPanel';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { cn } from '@/lib/utils';

const MIN_EFB_WIDTH = 320;
const MAX_EFB_WIDTH = 720;
const DEFAULT_EFB_WIDTH = 420;

export function AppShell() {
  const [efbWidth, setEfbWidth] = useState(DEFAULT_EFB_WIDTH);
  const [efbOpen, setEfbOpen] = useState(true);
  const [efbCollapsed, setEfbCollapsed] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startWidth: efbWidth };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
    e.preventDefault();
  }, [efbWidth]);

  const onDrag = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startX - e.clientX;
    const newWidth = Math.max(MIN_EFB_WIDTH, Math.min(MAX_EFB_WIDTH, dragRef.current.startWidth + delta));
    setEfbWidth(newWidth);
  }, []);

  const onDragEnd = useCallback(() => {
    dragRef.current = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
  }, [onDrag]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-panel select-none">
      {/* Top bar */}
      <TopBar onToggleEFB={() => setEfbOpen((v) => !v)} efbOpen={efbOpen} />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Map — fills remaining space */}
        <div className="relative flex-1 overflow-hidden">
          <CesiumViewer />
          <MapToolbar />
        </div>

        {/* Resize handle */}
        {efbOpen && !efbCollapsed && (
          <div
            onMouseDown={onDragStart}
            className="w-1 bg-panel-border hover:bg-avionics-blue cursor-col-resize transition-colors z-20 flex-shrink-0"
            title="Drag to resize EFB panel"
          />
        )}

        {/* EFB Panel */}
        {efbOpen && (
          <div
            className={cn(
              'flex-shrink-0 transition-all duration-200 overflow-hidden',
              efbCollapsed ? 'w-10' : '',
            )}
            style={!efbCollapsed ? { width: efbWidth } : undefined}
          >
            <EFBPanel
              collapsed={efbCollapsed}
              onToggleCollapse={() => setEfbCollapsed((v) => !v)}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
