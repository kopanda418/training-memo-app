import { toDateString } from './date'

export interface CalendarCell {
  /** YYYY-MM-DD */
  date: string
  /** 表示中の月に属する日か(前後月の埋め草は false) */
  inMonth: boolean
}

/**
 * 月のカレンダーグリッド(日曜始まり、週ごとの 2 次元配列)。
 * month は 1〜12。前後月の日も含めて必ず 7 の倍数のセルを返す。
 */
export function monthGrid(year: number, month: number): CalendarCell[][] {
  const firstDay = new Date(year, month - 1, 1)
  const start = new Date(year, month - 1, 1 - firstDay.getDay())
  const cells: CalendarCell[] = []
  const cursor = new Date(start)
  // 6 週分(42 セル)あればどの月も収まるが、最終週が翌月のみなら省く
  for (let i = 0; i < 42; i++) {
    cells.push({
      date: toDateString(cursor),
      inMonth: cursor.getMonth() === month - 1,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  const weeks: CalendarCell[][] = []
  for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks.filter((week) => week.some((c) => c.inMonth))
}

/** 年月に delta ヶ月を加算する。month は 1〜12 */
export function addMonths(year: number, month: number, delta: number): [number, number] {
  const d = new Date(year, month - 1 + delta, 1)
  return [d.getFullYear(), d.getMonth() + 1]
}
