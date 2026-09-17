import { useState, useEffect } from 'react';

/**
 * Parses a date value (SQLite localtime string, ISO string, timestamp, or Date)
 * into a Date object accurately reflecting the local computer timezone.
 *
 * SQLite `datetime('now', 'localtime')` returns "YYYY-MM-DD HH:MM:SS".
 * If parsed directly with naive new Date(), some browsers or environments
 * may interpret it with UTC or irregular offsets.
 * parseLocalDate guarantees exact year, month, day, hour, minute, second
 * in the local computer's clock.
 */
export function parseLocalDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(val).trim();
  if (!str) return null;

  // Check for local format: "YYYY-MM-DD" or "YYYY-MM-DD HH:MM[:SS]" without timezone flag
  const localMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (localMatch && !str.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    const y = parseInt(localMatch[1], 10);
    const m = parseInt(localMatch[2], 10) - 1;
    const d = parseInt(localMatch[3], 10);
    const h = localMatch[4] !== undefined ? parseInt(localMatch[4], 10) : 0;
    const min = localMatch[5] !== undefined ? parseInt(localMatch[5], 10) : 0;
    const s = localMatch[6] !== undefined ? parseInt(localMatch[6], 10) : 0;
    const dateObj = new Date(y, m, d, h, min, s);
    return isNaN(dateObj.getTime()) ? null : dateObj;
  }

  // Fallback to standard Date parsing (e.g. ISO strings with Z or offsets)
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a Date object to "YYYY-MM-DD" using local computer calendar date.
 * Avoids toISOString() which converts to UTC and can shift the date by ±1 day.
 */
export function formatLocalDate(dateObj = new Date()) {
  const d = parseLocalDate(dateObj) || new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Formats a date value into human-readable local date.
 * Options: 'gb' (16/09/2026), 'medium' (16 Sep 2026), 'full' (Wednesday, 16 September 2026)
 */
export function formatDate(val, style = 'gb') {
  const d = parseLocalDate(val);
  if (!d) return '-';

  if (style === 'medium') {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (style === 'full') {
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  return d.toLocaleDateString('en-GB');
}

/**
 * Formats a date value into human-readable local time (e.g. "11:45 am" or "11:45:20 am").
 */
export function formatTime(val, includeSeconds = false) {
  const d = parseLocalDate(val);
  if (!d) return '-';

  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true
  });
}

/**
 * Formats a date and time together (e.g. "16/09/2026 11:45 am").
 */
export function formatDateTime(val, includeSeconds = false) {
  const d = parseLocalDate(val);
  if (!d) return '-';

  const datePart = formatDate(d, 'gb');
  const timePart = formatTime(d, includeSeconds);
  return `${datePart} ${timePart}`;
}

/**
 * Resolves the computer operating system timezone.
 */
export function getSystemTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'System Local';
  } catch (e) {
    return 'System Local';
  }
}

/**
 * React hook that provides a live computer system clock ticking every second.
 * Automatically synchronizes with the host operating system clock.
 */
export function useComputerClock(intervalMs = 1000) {
  const [clock, setClock] = useState(() => {
    const now = new Date();
    return {
      date: now,
      timeString: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
      shortTimeString: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      dateString: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      weekday: now.toLocaleDateString('en-GB', { weekday: 'short' }),
      fullString: now.toLocaleString(),
      timeZone: getSystemTimezone()
    };
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setClock({
        date: now,
        timeString: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        shortTimeString: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        dateString: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        weekday: now.toLocaleDateString('en-GB', { weekday: 'short' }),
        fullString: now.toLocaleString(),
        timeZone: getSystemTimezone()
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return clock;
}
