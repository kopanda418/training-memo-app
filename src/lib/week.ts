import { addDays, toDateString } from './date'

/** その日が属する週の開始日(月曜)を返す */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay() // 0=日
  const offsetFromMonday = (day + 6) % 7
  return toDateString(new Date(y, m - 1, d - offsetFromMonday))
}

/** 週開始日に delta 週を加算する */
export function addWeeks(weekStartDate: string, delta: number): string {
  return addDays(weekStartDate, delta * 7)
}

/** 週の終了日(開始 + 6 日) */
export function weekEnd(weekStartDate: string): string {
  return addDays(weekStartDate, 6)
}

/** 表示用: "7/6〜7/12" */
export function formatWeekLabel(weekStartDate: string): string {
  const fmt = (date: string) => {
    const [, m, d] = date.split('-').map(Number)
    return `${m}/${d}`
  }
  return `${fmt(weekStartDate)}〜${fmt(weekEnd(weekStartDate))}`
}
