/** Utilidades para el filtro de fechas (desde/hasta) del Dashboard y el Pipeline. */

export interface DateRange {
  from: Date | null;
  to: Date | null;
  fromParam: string;
  toParam: string;
}

/** "2026-08-01" -> Date local a las 00:00 (o 23:59:59.999 si `endOfDay`). */
function parseLocalDate(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

export function resolveDateRange(params: {
  from?: string;
  to?: string;
}): DateRange {
  return {
    from: parseLocalDate(params.from),
    to: parseLocalDate(params.to, true),
    fromParam: params.from || "",
    toParam: params.to || "",
  };
}

/** True si `date` cae dentro del rango (un extremo vacio no limita). */
export function inRange(date: Date | number | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!date) return false;
  const t = typeof date === "number" ? (date < 1e12 ? date * 1000 : date) : date.getTime();
  if (range.from && t < range.from.getTime()) return false;
  if (range.to && t > range.to.getTime()) return false;
  return true;
}
