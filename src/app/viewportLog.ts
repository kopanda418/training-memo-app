/**
 * 【一時】iOS 実機のビューポート値を記録する診断ログ(v1.0.21)。
 *
 * キーボード表示中の visualViewport / scrollY の値が仕様どおりに取れず、浮動タイマー
 * ボタンの表示・位置が場面によって崩れる問題の原因特定用。実機で再現操作をしたあと、
 * 設定画面「ビューポート診断」からログをコピーして開発側へ渡してもらう。
 *
 * 原因が確定したらこのファイルと設定画面のセクション、main.tsx の呼び出しごと削除してよい。
 */

const KEY = 'debug.viewportLog'
const MAX_ENTRIES = 60

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

let entries: string[] = load()
let seq = 0

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // 保存に失敗してもメモリ上のログは残る
  }
}

/** 表示用のテキスト(新しいものが下) */
export function readViewportLog(): string {
  return entries.length ? entries.join('\n') : '(ログなし)'
}

export function clearViewportLog(): void {
  entries = []
  seq = 0
  save()
}

function rectOf(el: Element | null | undefined): string {
  if (!el) return '-'
  const r = el.getBoundingClientRect()
  return `${Math.round(r.top)}..${Math.round(r.bottom)}`
}

function focusedLabel(el: Element | null): string {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return 'なし'
  return (el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.tagName).slice(
    0,
    10,
  )
}

function snapshot(ev: string): string {
  const vv = window.visualViewport
  const el = document.activeElement
  const main = document.querySelector('main')
  const n = (v: number | undefined) => Math.round(v ?? 0)
  return [
    ev.padEnd(8),
    `H${n(window.innerHeight)}`,
    `V${n(vv?.height)}`,
    `oT${n(vv?.offsetTop)}`,
    `pT${n(vv?.pageTop)}`,
    `sY${n(window.scrollY)}`,
    `mS${n(main?.scrollTop)}`,
    `欄=${focusedLabel(el)}`,
    `欄位置${rectOf(el)}`,
    `ボタン${rectOf(document.querySelector('[data-timer-float]'))}`,
    `枠${rectOf(document.querySelector('[data-app-shell]'))}`,
  ].join(' ')
}

function record(ev: string) {
  const line = snapshot(ev)
  // 値が前回と同じなら記録しない(キーボードのアニメーション中に大量に積まれるのを防ぐ)
  if (entries.length && entries[entries.length - 1].slice(9) === line.slice(9)) return
  entries.push(`${String(++seq).padStart(2, '0')} ${line}`)
  if (entries.length > MAX_ENTRIES) entries.shift()
  save()
}

/** main.tsx から一度だけ呼ぶ */
export function installViewportLog(): void {
  const vv = window.visualViewport
  // 描画が落ち着いてからの値を見たいので、各イベントの直後と少し後の 2 回記録する
  const hit = (ev: string) => {
    record(ev)
    window.setTimeout(() => record(`${ev}+`), 350)
  }
  document.addEventListener('focusin', () => hit('focusin'))
  document.addEventListener('focusout', () => hit('focusout'))
  vv?.addEventListener('resize', () => hit('resize'))
  vv?.addEventListener('scroll', () => record('scroll'))
}
