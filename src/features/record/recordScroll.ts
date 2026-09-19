import { useLayoutEffect, useRef } from 'react'
import { useNavigationType } from 'react-router'

// 記録→履歴→「‹ 記録」の一往復専用の最小スクロール復元。
// 汎用フレームワークにしない。保存は履歴への遷移ボタン押下時のみ
// (スクロールリスナーは張らない=記録入力の応答速度ルール遵守)。

let saved: { date: string; top: number } | null = null

/** 記録画面を離れる直前(履歴遷移ボタンの onClick)に呼ぶ */
export function saveRecordScroll(date: string, top: number): void {
  saved = { date, top }
}

/**
 * 保存値を常に消費(クリア)し、日付が一致した時だけ top を返す。
 * 不一致でもクリアするのは、古い値が後日誤って復元されるのを防ぐため。
 */
export function consumeRecordScroll(date: string): number | null {
  const s = saved
  saved = null
  return s !== null && s.date === date ? s.top : null
}

/** スクロールコンテナ(App.tsx の唯一の main 要素)の現在位置 */
export function getMainScrollTop(): number {
  return document.querySelector('main')?.scrollTop ?? 0
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
    const top = consumeRecordScroll(date)
    if (top === null || top === 0 || navigationType !== 'POP') return
    const main = document.querySelector('main')
    if (!main) return
    main.scrollTop = top
    // 各ブロック内の useLiveQuery(前回記録パネル等)が後から高さを伸ばし
    // scrollTop が clamp される間だけ数フレーム再適用。目標に達したら即終了
    let tries = 15
    const tick = () => {
      if (main.scrollTop >= top - 1 || --tries < 0) return
      main.scrollTop = top
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [ready, date, navigationType])
}
