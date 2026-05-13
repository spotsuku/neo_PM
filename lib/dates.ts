/** YYYY-MM-DD 文字列 ↔ Date ヘルパー */

export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // YYYY-MM-DD だけを安全に扱う（timestamp の場合は最初の10文字を採用）
  const ymd = s.slice(0, 10);
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** その月の1日 */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** 月曜開始の "週の月曜" */
export function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=日, 1=月
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

/** [start, end] の中の月の境界（first day of each month）を列挙 */
export function monthsBetween(
  start: Date,
  end: Date,
): { label: string; date: Date }[] {
  const result: { label: string; date: Date }[] = [];
  const cur = startOfMonth(start);
  while (cur <= end) {
    result.push({
      label: `${cur.getMonth() + 1}月`,
      date: new Date(cur),
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return result;
}

/** [start, end] 区間で、月曜ごとに週の開始日とインデックスを列挙 */
export function weeksBetween(
  start: Date,
  end: Date,
): { index: number; date: Date }[] {
  const result: { index: number; date: Date }[] = [];
  const startMon = mondayOf(start);
  const cur = new Date(startMon);
  let i = 1;
  while (cur <= end) {
    result.push({ index: i, date: new Date(cur) });
    cur.setDate(cur.getDate() + 7);
    i++;
  }
  return result;
}
