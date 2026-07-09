import { useRef, useState } from 'react'
import { Modal } from '../../components/Modal'
import { showToast } from '../../components/Toast'
import { applyPlanImport, previewPlanImport, validatePlanImportFile } from '../../db/planImport'
import type { PlanActions, PlanImportFile } from '../../lib/planImport'

interface PlanImportModalProps {
  open: boolean
  onClose: () => void
}

const blockLabel = (b: { date: string; exerciseName: string; tagName?: string }) =>
  `${b.date} ${b.exerciseName}${b.tagName ? `(${b.tagName})` : ''}`

/**
 * プラン取り込み(追加専用)。既存データは書き換えず、まだ記録がない
 * date+種目×タグ にだけセットを追加する(docs/decisions.md ADR-010)。
 * ファイル選択 → プレビュー確認 → 取り込みの2段階
 */
export function PlanImportModal({ open, onClose }: PlanImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<PlanImportFile | null>(null)
  const [preview, setPreview] = useState<PlanActions | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setFile(null)
    setPreview(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = async (rawFile: File) => {
    try {
      const parsed = validatePlanImportFile(JSON.parse(await rawFile.text()))
      setFile(parsed)
      setPreview(await previewPlanImport(parsed))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'プランファイルを読み込めませんでした')
    }
  }

  const handleApply = async () => {
    if (!file) return
    setBusy(true)
    try {
      const result = await applyPlanImport(file)
      showToast(
        `取り込みました(追加 ${result.addBlocks.length} 件 / スキップ ${result.skipBlocks.length} 件)`,
      )
      handleClose()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '取り込みに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="プラン取り込み(追加のみ)">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          既存の記録は変更・削除されません。まだ記録がない日付×種目×タグの組み合わせにだけ、
          セットを追加します
        </p>

        {!preview && (
          <button
            type="button"
            className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-bold text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700"
            onClick={() => fileInputRef.current?.click()}
          >
            プランファイルを選ぶ
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ''
          }}
        />

        {preview && (
          <div className="flex flex-col gap-3">
            {preview.errors.length > 0 && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {preview.errors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}

            {(preview.createExercises.length > 0 || preview.createTags.length > 0) && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {preview.createExercises.length > 0 && (
                  <p>新規種目: {preview.createExercises.map((e) => e.name).join(' / ')}</p>
                )}
                {preview.createTags.length > 0 && (
                  <p>新規タグ: {preview.createTags.map((t) => t.name).join(' / ')}</p>
                )}
              </div>
            )}

            <div>
              <p className="mb-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                追加 {preview.addBlocks.length} 件
              </p>
              <ul className="max-h-32 overflow-y-auto text-xs text-slate-600 dark:text-slate-300">
                {preview.addBlocks.map((b, i) => (
                  <li key={i}>
                    {blockLabel(b)} — {b.sets.length}セット
                  </li>
                ))}
                {preview.addBlocks.length === 0 && (
                  <li className="text-slate-400">追加対象はありません</li>
                )}
              </ul>
            </div>

            {preview.skipBlocks.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-bold text-slate-400">
                  スキップ(既に記録あり) {preview.skipBlocks.length} 件
                </p>
                <ul className="max-h-24 overflow-y-auto text-xs text-slate-400">
                  {preview.skipBlocks.map((b, i) => (
                    <li key={i}>{blockLabel(b)}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-bold text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700"
                onClick={reset}
                disabled={busy}
              >
                やり直す
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-sky-600 py-2.5 text-sm font-bold text-white active:bg-sky-700 disabled:opacity-40"
                onClick={() => void handleApply()}
                disabled={busy || preview.errors.length > 0 || preview.addBlocks.length === 0}
              >
                取り込む
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
