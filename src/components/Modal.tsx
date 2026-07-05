import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/**
 * 画面下から出るボトムシート型モーダル。
 * 呼び出し元が半透明(ウォームアップ行)や transform(ドラッグ)を持っていても
 * 影響を受けないよう、document.body 直下へポータル描画する
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="閉じる"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        className="relative max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        {title && <h2 className="mb-3 text-base font-bold">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}
