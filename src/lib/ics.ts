import type { DayKey } from './date';

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  date: DayKey;
  time?: string;
  durationMin?: number;
  /** RRULE без префикса, например FREQ=DAILY или FREQ=WEEKLY;BYDAY=TU,SA */
  rrule?: string;
  alarm?: boolean;
}

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const weekdaysRule = (days: number[]) => `FREQ=WEEKLY;BYDAY=${[...days].sort().map((d) => BYDAY[d - 1]).join(',')}`;

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Перенос строк длиннее 75 октетов (RFC 5545), не разрывая символы UTF-8. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curLen = 0;
  for (const ch of line) {
    const l = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (curLen + l > limit) { out.push(cur); cur = ''; curLen = 0; }
    cur += ch; curLen += l;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const pad = (n: number) => String(n).padStart(2, '0');
function dt(date: DayKey, time: string) { return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`; }
function stamp(d: Date) { return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; }

function addMinutes(date: DayKey, time: string, min: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm + min));
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
}

/** Календарь с «плавающим» местным временем: события идут по часам устройства, где бы вы ни были. */
export function buildIcs(events: IcsEvent[], calName: string, now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Berezhno//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(calName)}`];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp(now)}`, `SUMMARY:${escapeText(e.title)}`);
    if (e.time) {
      lines.push(`DTSTART:${dt(e.date, e.time)}`, `DTEND:${addMinutes(e.date, e.time, e.durationMin ?? 10)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`);
    }
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push('TRANSP:TRANSPARENT');
    if (e.alarm && e.time) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(e.title)}`, 'TRIGGER:PT0M', 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
