/** 秒数を "m:ss" 表示にする(タイマー用) */
export function formatTimerSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
