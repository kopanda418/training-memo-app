import { useEffect, useState } from 'react'
import { scrollToBottom, scrollToLastDoneSet } from './recordScroll'

function isTextInputFocused(): boolean {
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
}

const btnClass =
  'pointer-events-auto flex h-11 w-11 flex-col items-center justify-center rounded-full bg-slate-700/80 text-white shadow-lg active:bg-slate-900 dark:bg-slate-600/85 dark:active:bg-slate-500'

/**
 * 記録画面右下の浮動ジャンプボタン。種目が多い日に、他画面から戻った後や
 * 種目を追加したい時に長いスクロールをしなくて済むようにする。
 * - 「続き」: 回数入力済みの最下段セットへ
 * - 「最下部」: 一番下(＋ 種目を追加)へ
 *
 * RecordPage の末尾に置く高さ 0 の sticky 要素なので、main のスクロール領域の
 * 下端(タブバーの直上)に張り付く。スクロールリスナーは張らない(常時表示)。
 * 文字入力中はキーボード直上の「休憩」ボタンと重ならないよう隠す。
 */
export function RecordJumpButtons({ hasDoneSet }: { hasDoneSet: boolean }) {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    // focusout 直後は activeElement が body のため、次のフォーカス先確定を待って判定する
    const update = () => setTimeout(() => setTyping(isTextInputFocused()), 0)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [])

  if (typing) return null

  return (
    <div className="pointer-events-none sticky bottom-3 z-20 h-0">
      <div className="absolute right-3 bottom-0 flex flex-col gap-2">
        {hasDoneSet && (
          <button
            type="button"
            aria-label="入力済みの最後のセットへ移動"
            className={btnClass}
            onClick={scrollToLastDoneSet}
          >
            <span className="text-base leading-none" aria-hidden>
              ↓
            </span>
            <span className="text-[9px] leading-tight">続き</span>
          </button>
        )}
        <button
          type="button"
          aria-label="一番下へ移動"
          className={btnClass}
          onClick={scrollToBottom}
        >
          <span className="text-base leading-none" aria-hidden>
            ⤓
          </span>
          <span className="text-[9px] leading-tight">最下部</span>
        </button>
      </div>
    </div>
  )
}
