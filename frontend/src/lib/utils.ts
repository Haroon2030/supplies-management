import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { RequestStatus } from './types';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export type Tone = 'accent' | 'ok' | 'bad' | 'info' | 'plum' | 'warn' | 'muted';

export const toneClass: Record<Tone, string> = {
  accent: 'bg-accent/15 text-accent-soft ring-accent/30',
  ok: 'bg-ok/15 text-ok ring-ok/30',
  bad: 'bg-bad/15 text-bad ring-bad/30',
  info: 'bg-info/15 text-info ring-info/30',
  plum: 'bg-plum/15 text-plum ring-plum/30',
  warn: 'bg-warn/15 text-warn ring-warn/30',
  muted: 'bg-white/8 text-muted ring-white/15',
};

export const statusTone: Record<RequestStatus, Tone> = {
  PENDING_MANAGER: 'warn', NEEDS_EDIT: 'plum', REJECTED: 'bad', PENDING_WAREHOUSE: 'accent',
  AWAITING_PURCHASE: 'info', PARTIALLY_ISSUED: 'plum', ISSUED: 'ok', CANCELLED: 'muted',
};

/** يحمّل الصفوف كملف CSV (UTF-8 مع BOM ليفتح العربي سليماً في Excel). */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
