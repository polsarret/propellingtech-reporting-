// Periodo de cierre por defecto: el mes anterior al actual (el mes en curso nunca está cerrado).
export function defaultClosingPeriod(now = new Date()): { year: number; month: number } {
  const m = now.getMonth(); // 0-11 → el mes anterior en base 1
  return m === 0 ? { year: now.getFullYear() - 1, month: 12 } : { year: now.getFullYear(), month: m };
}

/** Último mes cerrado de un año: diciembre para años pasados, el mes anterior para el año en curso. */
export function closingMonthOf(year: number, now = new Date()): number {
  const d = defaultClosingPeriod(now);
  return year < d.year ? 12 : year === d.year ? d.month : 0;
}
