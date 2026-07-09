import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

const OPEN_WIDTH = 72 // px: 削除ボタンの幅
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
 * 左スワイプで右端に削除ボタンを表出させる汎用ラッパー。
 * 横移動が DRAG_THRESHOLD を超えるまでは何もしないため、内部のボタン/入力への
 * タップやページの縦スクロールを妨げない。開いた状態で前景をタップすると閉じる
 * (誤操作防止。削除ボタン自体は常にタップ可能)。
 * [data-drag-handle] 配下からの操作は別ジェスチャー(並び替え等)に譲り対象外にする。
 */
export function SwipeToDelete({
  onDelete,
  deleteLabel = '削除',
  wrapperClassName,
  contentClassName,
  children,
}: SwipeToDeleteProps) {
  const [dragX, setDragX] = useState(0) // 0(閉) 〜 -OPEN_WIDTH(開)
  const [dragging, setDragging] = useState(false)
  const pointerId = useRef<number | null>(null)
  const start = useRef({ x: 0, y: 0, baseX: 0 })
  const horizontal = useRef<boolean | null>(null) // null=未確定 true=横スワイプ確定 false=縦操作と確定

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) return
    pointerId.current = e.pointerId
    start.current = { x: e.clientX, y: e.clientY, baseX: dragX }
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
    setDragX(Math.min(0, Math.max(-OPEN_WIDTH, start.current.baseX + dx)))
  }

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return
    pointerId.current = null
    if (horizontal.current) {
      setDragX((x) => (x < -OPEN_WIDTH / 2 ? -OPEN_WIDTH : 0))
    }
    setDragging(false)
    horizontal.current = null
  }

  return (
    <div className={`relative overflow-hidden ${wrapperClassName ?? ''}`}>
      <button
        type="button"
        aria-label={deleteLabel}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-600 text-xs font-bold text-white active:bg-red-700"
        style={{ width: OPEN_WIDTH }}
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
