import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

const OPEN_WIDTH = 72 // px: 部分スワイプで開いたままにする(タップで削除)幅
const DELETE_THRESHOLD = 140 // px: これ以上スワイプして指を離すと即削除する
const MAX_DRAG = 200 // px: 見た目上の移動量の上限
const DRAG_THRESHOLD = 8 // px: これ未満の移動はタップ/縦スクロールとみなして無視する

interface SwipeToDeleteProps {
  onDelete: () => void
  deleteLabel?: string
  /** スワイプで隠れる外枠(rounded/z-index 等)を呼び出し側から調整したい場合 */
  wrapperClassName?: string
  /** 前景コンテンツの背景色。削除ボタンを隠す必要があるため不透明にすること */
  contentClassName?: string
  children: ReactNode
}

/**
 * 左スワイプで削除する汎用ラッパー。
 * - 軽くスワイプ(OPEN_WIDTH 以上・DELETE_THRESHOLD 未満)→ 右端に削除ボタンが出た
 *   ままになり、タップで削除(2 アクション、慎重に消したい時向け)
 * - 大きくスワイプ(DELETE_THRESHOLD 以上)して指を離す → その場で即削除(1 アクション)。
 *   閾値を超えると背景色が変わり「離せば消える」ことを示す
 * 横移動が DRAG_THRESHOLD を超えるまでは何もしないため、内部のボタン/入力への
 * タップやページの縦スクロールを妨げない。[data-drag-handle] 配下からの操作は
 * 別ジェスチャー(並び替え等)に譲り対象外にする。
 */
export function SwipeToDelete({
  onDelete,
  deleteLabel = '削除',
  wrapperClassName,
  contentClassName,
  children,
}: SwipeToDeleteProps) {
  const [dragX, setDragXState] = useState(0) // 0(閉) 〜 -MAX_DRAG
  const [dragging, setDragging] = useState(false)
  const dragXRef = useRef(0)
  const pointerId = useRef<number | null>(null)
  const start = useRef({ x: 0, y: 0, baseX: 0 })
  const horizontal = useRef<boolean | null>(null) // null=未確定 true=横スワイプ確定 false=縦操作と確定

  const setDragX = (x: number) => {
    dragXRef.current = x
    setDragXState(x)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) return
    pointerId.current = e.pointerId
    start.current = { x: e.clientX, y: e.clientY, baseX: dragXRef.current }
    horizontal.current = null
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    if (horizontal.current === null) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
      horizontal.current = Math.abs(dx) > Math.abs(dy)
      if (horizontal.current) {
        setDragging(true)
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    }
    if (!horizontal.current) return
    setDragX(Math.min(0, Math.max(-MAX_DRAG, start.current.baseX + dx)))
  }

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return
    pointerId.current = null
    if (horizontal.current) {
      const x = dragXRef.current
      if (x <= -DELETE_THRESHOLD) {
        onDelete()
      } else if (x < -OPEN_WIDTH / 2) {
        setDragX(-OPEN_WIDTH)
      } else {
        setDragX(0)
      }
    }
    setDragging(false)
    horizontal.current = null
  }

  const pastThreshold = dragX <= -DELETE_THRESHOLD

  return (
    <div className={`relative overflow-hidden ${wrapperClassName ?? ''}`}>
      <button
        type="button"
        aria-label={deleteLabel}
        className={`absolute inset-y-0 right-0 flex items-center justify-center text-xs font-bold text-white ${
          pastThreshold ? 'bg-red-700' : 'bg-red-600 active:bg-red-700'
        }`}
        style={{
          width: Math.max(OPEN_WIDTH, -dragX),
          transition: dragging ? 'none' : 'width 200ms ease-out',
        }}
        onClick={onDelete}
      >
        {deleteLabel}
      </button>
      <div
        className={`relative ${contentClassName ?? 'bg-white dark:bg-slate-900'}`}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 200ms ease-out',
          touchAction: 'pan-y',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {children}
      </div>
      {!dragging && dragX !== 0 && (
        <div
          className="absolute inset-0"
          style={{ transform: `translateX(${dragX}px)` }}
          onClick={() => setDragX(0)}
        />
      )}
    </div>
  )
}
