import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Standardizes AM/PM notation to all caps without dots (e.g., 02:00 PM) */
export function formatTime(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  });
  
  // Force AM/PM to be uppercase and remove any dots (handles some browsers/locales)
  return timeStr.replace(/([ap])\.?\s?m\.?/i, (match) => match.replace(/\./g, '').trim().toUpperCase());
}
