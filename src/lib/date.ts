/** 日付キーはすべて端末ローカルの YYYY-MM-DD 文字列で扱う */

export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayString(): string {
  return toDateString(new Date())
}

export function addDays(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return toDateString(new Date(y, m - 1, d + delta))
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

/** 表示用: "7/3(金)"。年が今年でなければ "2025/7/3(金)" */
export function formatDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  const yearPrefix = y === new Date().getFullYear() ? '' : `${y}/`
  return `${yearPrefix}${m}/${d}(${weekday})`
}
