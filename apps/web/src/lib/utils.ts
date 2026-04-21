import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysUntil(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((new Date(d).getTime() - Date.now()) / 86400_000);
}

export function expiryColor(days: number | null): string {
  if (days == null) return 'text-muted-foreground';
  if (days < 0) return 'text-avionics-red';
  if (days < 30) return 'text-avionics-amber';
  if (days < 90) return 'text-yellow-400';
  return 'text-avionics-green';
}
