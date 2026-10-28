import { useLayoutEffect, useRef } from 'react'
import { useNavigationType } from 'react-router'

// 記録→履歴→「‹ 記録」の一往復専用の最小スクロール復元。
// 汎用フレームワークにしない。保存は履歴への遷移ボタン押下時のみ
// (スクロールリスナーは張らない=記録入力の応答速度ルール遵守)。

/**
 * 保存するスクロール位置。scrollTop の数値だけだと、戻った直後は各ブロックの
 * 前回記録パネル(useLiveQuery)が未描画で上側が短く、同じ数値でも違う場所に
 * なる(後から伸びた分だけズレる)。そこで画面上端に見えていたブロックと
 * その表示位置(アンカー)を覚え、復元はアンカー基準で行う。
 */
export interface RecordScrollPos {
  top: number
  anchor?: { key: string; offset: number }
}

let saved: { date: string; pos: RecordScrollPos } | null = null

/** 記録画面を離れる直前(履歴遷移ボタンの onClick)に呼ぶ */
export function saveRecordScroll(date: string, pos: RecordScrollPos): void {
  saved = { date, pos }
}

/**
 * 保存値を常に消費(クリア)し、日付が一致した時だけ位置を返す。
 * 不一致でもクリアするのは、古い値が後日誤って復元されるのを防ぐため。
 */
export function consumeRecordScroll(date: string): RecordScrollPos | null {
  const s = saved
  saved = null
  return s !== null && s.date === date ? s.pos : null
}

const blockSelector = '[data-record-block]'

/**
 * スクロールコンテナ(App.tsx の唯一の main 要素)の現在位置と、
 * 固定ヘッダーの下に最初に見えている種目ブロック(アンカー)
 */
export function getRecordScrollPos(): RecordScrollPos {
  const main = document.querySelector('main')
  if (!main) return { top: 0 }
  const mainTop = main.getBoundingClientRect().top
  const headerBottom = main.querySelector('header')?.getBoundingClientRect().bottom ?? mainTop
  for (const el of main.querySelectorAll<HTMLElement>(blockSelector)) {
    const rect = el.getBoundingClientRect()
    if (rect.bottom > headerBottom) {
      return {
        top: main.scrollTop,
        anchor: { key: el.dataset.recordBlock ?? '', offset: rect.top - mainTop },
      }
    }
  }
  return { top: main.scrollTop }
}

/**
 * 表示内容が大きく縮む操作(日付送りなど)の「直前」に呼び、先頭へ戻す。
 * 下までスクロールした状態で中身が縮むと、ブラウザが scrollTop を強制的に
 * 補正するが、iOS Safari はこのとき再描画せず画面が背景色のまま(暗転)になる
 * ことがある(#1)。中身が縮む前に 0 へ戻しておけば補正自体が起きない。
 * React の再描画は onClick 完了後なので、ここでは DOM はまだ縮む前の高さ。
 */
export function resetMainScrollTop(): void {
  const main = document.querySelector('main')
  if (main && main.scrollTop !== 0) main.scrollTop = 0
}

/**
 * RecordPage 専用: 履歴画面から POP(‹ 記録 / スワイプバック)で戻ってきた時に、
 * データ描画後(ready)へ一度だけスクロール位置を復元する。
 * タブ経由(PUSH)では復元せず、保存値のクリアだけ行う。
 */
export function useRestoreRecordScroll(date: string, ready: boolean): void {
  const navigationType = useNavigationType()
  const done = useRef(false)
  useLayoutEffect(() => {
    if (done.current || !ready) return
    done.current = true
    const pos = consumeRecordScroll(date)
    if (pos === null || pos.top === 0 || navigationType !== 'POP') return
    const main = document.querySelector('main')
    if (!main) return
    const anchorEl = pos.anchor
      ? [...main.querySelectorAll<HTMLElement>(blockSelector)].find(
          (el) => el.dataset.recordBlock === pos.anchor?.key,
        )
      : undefined
    const apply = () => {
      const target =
        anchorEl?.isConnected && pos.anchor
          ? main.scrollTop +
            anchorEl.getBoundingClientRect().top -
            main.getBoundingClientRect().top -
            pos.anchor.offset
          : pos.top
      if (Math.abs(main.scrollTop - target) > 1) main.scrollTop = target
    }
    apply()
    // 各ブロック内の useLiveQuery(前回記録パネル等)が後から高さを伸ばすので、
    // 高さが落ち着くまで毎フレーム合わせ直す。ユーザーが触ったら即やめる
    let frame = 0
    let stable = 0
    let lastHeight = main.scrollHeight
    let raf = 0
    const stop = () => {
      cancelAnimationFrame(raf)
      main.removeEventListener('touchstart', stop)
      main.removeEventListener('wheel', stop)
    }
    const tick = () => {
      apply()
      stable = main.scrollHeight === lastHeight ? stable + 1 : 0
      lastHeight = main.scrollHeight
      if (stable >= 20 || ++frame > 120) return stop()
      raf = requestAnimationFrame(tick)
    }
    main.addEventListener('touchstart', stop, { passive: true })
    main.addEventListener('wheel', stop, { passive: true })
    raf = requestAnimationFrame(tick)
  }, [ready, date, navigationType])
}
