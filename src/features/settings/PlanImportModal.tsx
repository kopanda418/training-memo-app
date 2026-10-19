import { useRef, useState } from 'react'
import { Modal } from '../../components/Modal'
import { showToast } from '../../components/Toast'
import { applyPlanImport, previewPlanImport, validatePlanImportFile } from '../../db/planImport'
import {
  recommendedModeOf,
  type PlanActions,
  type PlanImportFile,
  type PlanImportMode,
} from '../../lib/planImport'

interface PlanImportModalProps {
  open: boolean
  onClose: () => void
}

const blockLabel = (b: { date: string; exerciseName: string; tagName?: string; round: number }) =>
  `${b.date} ${b.exerciseName}${b.tagName ? `(${b.tagName})` : ''}${b.round ? ` ${b.round + 1}回目` : ''}`

const MODES: { mode: PlanImportMode; label: string; hint: string }[] = [
  { mode: 'skip', label: '上書きしない', hint: '既に記録がある種目はスキップ' },
  { mode: 'overwrite', label: '重複のみ上書き', hint: '重なった種目だけ置き換え、他は残す' },
  {
    mode: 'replaceDay',
    label: '同日を全て置き換え',
    hint: 'ファイルにある日の記録を全部消してから入れ直す',
  },
]

/**
 * プラン取り込み。既定では既存データを書き換えず、まだ記録がない
 * date+種目×タグ にだけセットを追加する(docs/decisions.md ADR-010)。
 * 重複の扱いは 3 択(ADR-016): 上書きしない / 重複のみ上書き(ADR-012)/ 同日を全て置き換え。
 * 書き換えを伴うときは確認ダイアログを出す。ファイル選択 → プレビュー確認 → 取り込みの2段階
 */
export function PlanImportModal({ open, onClose }: PlanImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<PlanImportFile | null>(null)
  const [preview, setPreview] = useState<PlanActions | null>(null)
  const [mode, setMode] = useState<PlanImportMode>('skip')
  // 実績のある種目は上書き・削除しない(ADR-019。既定オン)
  const [keepPerformed, setKeepPerformed] = useState(true)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setFile(null)
    setPreview(null)
    setMode('skip')
    setKeepPerformed(true)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = async (rawFile: File) => {
    try {
      const parsed = validatePlanImportFile(JSON.parse(await rawFile.text()))
      const initialMode = recommendedModeOf(parsed) ?? mode
      setFile(parsed)
      setMode(initialMode)
      setPreview(await previewPlanImport(parsed, { mode: initialMode, keepPerformed }))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'プランファイルを読み込めませんでした')
    }
  }

  const handleChangeMode = async (next: PlanImportMode) => {
    setMode(next)
    if (file) setPreview(await previewPlanImport(file, { mode: next, keepPerformed }))
  }

  const handleChangeKeep = async (next: boolean) => {
    setKeepPerformed(next)
    if (file) setPreview(await previewPlanImport(file, { mode, keepPerformed: next }))
  }

  const recommended = file ? recommendedModeOf(file) : undefined
  // 取り込むと消える、実績(回数)が入ったセットの数(ADR-019)
  const lostPerformed = preview
    ? preview.overwriteBlocks.reduce((n, b) => n + (b.performedSetCount ?? 0), 0) +
      (mode === 'replaceDay'
        ? preview.removeBlocks.reduce((n, b) => n + b.performedSetCount, 0)
        : 0)
    : 0
  const performedWarning = lostPerformed
    ? `⚠ 実績(回数)が入ったセットが ${lostPerformed} セット消えます。\n\n`
    : ''

  const handleApply = async () => {
    if (!file || !preview) return
    if (mode === 'overwrite' && preview.overwriteBlocks.length > 0) {
      const list = preview.overwriteBlocks.map((b) => `・${blockLabel(b)}`).join('\n')
      const ok = window.confirm(
        `${performedWarning}次の記録は既存データと重複しています。上書きしますか?\n\n${list}`,
      )
      if (!ok) return
    }
    if (
      mode === 'replaceDay' &&
      (preview.removeBlocks.length > 0 || preview.overwriteBlocks.length > 0)
    ) {
      const touched = [...preview.removeBlocks, ...preview.overwriteBlocks].map((b) => b.date)
      const dates = [...new Set(touched)].sort()
      const removed = preview.removeBlocks.length
        ? '\n\n【削除される種目】\n' +
          preview.removeBlocks
            .map(
              (b) =>
                `・${blockLabel(b)}(${b.setCount}セット` +
                (b.performedSetCount ? `、うち実績 ${b.performedSetCount}` : '') +
                ')',
            )
            .join('\n')
        : ''
      const kept = preview.keptBlocks.length
        ? '\n\n【実績があるので残す種目】\n' +
          preview.keptBlocks.map((b) => `・${blockLabel(b)}`).join('\n')
        : ''
      const ok = window.confirm(
        performedWarning +
          '次の日の記録を消してから、プランの内容を入れ直します。' +
          (lostPerformed ? '実際に記録したセットも消えます。' : '') +
          `よろしいですか?\n\n${dates.join(' / ')}${removed}${kept}`,
      )
      if (!ok) return
    }
    setBusy(true)
    try {
      const result = await applyPlanImport(file, { mode, keepPerformed })
      showToast(
        `取り込みました(追加 ${result.addBlocks.length} 件` +
          (mode !== 'skip' ? ` / 上書き ${result.overwriteBlocks.length} 件` : '') +
          (mode === 'replaceDay' ? ` / 削除 ${result.removeBlocks.length} 件` : '') +
          (result.keptBlocks.length ? ` / 実績のため残した ${result.keptBlocks.length} 件` : '') +
          (mode === 'skip' ? ` / スキップ ${result.skipBlocks.length} 件` : '') +
          ')',
      )
      handleClose()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '取り込みに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="プラン取り込み">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          まだ記録がない日付×種目×タグの組み合わせにセットを追加します。既に記録がある日の扱いは、
          ファイルを選んだあとに 3 つから選べます
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

            {(preview.createBodyParts.length > 0 ||
              preview.createExercises.length > 0 ||
              preview.createTags.length > 0) && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {preview.createBodyParts.length > 0 && (
                  <p>新規部位: {preview.createBodyParts.join(' / ')}</p>
                )}
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

            {(preview.skipBlocks.length > 0 ||
              preview.overwriteBlocks.length > 0 ||
              preview.removeBlocks.length > 0 ||
              mode !== 'skip') && (
              <div>
                <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                  既に記録がある日の扱い
                </p>
                <div className="mb-2 flex flex-col gap-1">
                  {MODES.map((m) => (
                    <label
                      key={m.mode}
                      className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                        mode === m.mode
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan-import-mode"
                        className="mt-0.5"
                        checked={mode === m.mode}
                        onChange={() => void handleChangeMode(m.mode)}
                        disabled={busy}
                      />
                      <span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {m.label}
                          {recommended === m.mode && (
                            <span className="ml-1 font-normal text-sky-600 dark:text-sky-400">
                              (プランの推奨)
                            </span>
                          )}
                        </span>
                        <span className="block text-slate-500 dark:text-slate-400">{m.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {mode !== 'skip' && (
                  <label className="mb-2 flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs dark:border-emerald-800 dark:bg-emerald-950">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={keepPerformed}
                      onChange={(e) => void handleChangeKeep(e.target.checked)}
                      disabled={busy}
                    />
                    <span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        実績のある種目は残す(おすすめ)
                      </span>
                      <span className="block text-slate-500 dark:text-slate-400">
                        回数を記録したセットがある種目は、消さず・上書きせずそのまま残します
                      </span>
                    </span>
                  </label>
                )}
                {preview.keptBlocks.length > 0 && (
                  <>
                    <p className="mb-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      残す(実績あり) {preview.keptBlocks.length} 件
                    </p>
                    <ul className="mb-2 max-h-24 overflow-y-auto text-xs text-emerald-600 dark:text-emerald-400">
                      {preview.keptBlocks.map((b, i) => (
                        <li key={i}>
                          {blockLabel(b)} — 実績 {b.performedSetCount}/{b.setCount}セット
                          {b.inPlan && '(プラン側は取り込まない)'}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {mode === 'skip' && (
                  <>
                    <p className="mb-1 text-xs font-bold text-slate-400">
                      スキップ(既に記録あり) {preview.skipBlocks.length} 件
                    </p>
                    <ul className="max-h-24 overflow-y-auto text-xs text-slate-400">
                      {preview.skipBlocks.map((b, i) => (
                        <li key={i}>{blockLabel(b)}</li>
                      ))}
                    </ul>
                  </>
                )}
                {mode !== 'skip' && (
                  <>
                    <p className="mb-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                      上書き(既存セットを削除して置き換え) {preview.overwriteBlocks.length} 件
                    </p>
                    <ul className="max-h-24 overflow-y-auto text-xs text-amber-600 dark:text-amber-400">
                      {preview.overwriteBlocks.map((b, i) => (
                        <li key={i}>
                          {blockLabel(b)}
                          {!!b.performedSetCount && (
                            <span className="ml-1 font-bold text-red-600 dark:text-red-400">
                              ⚠ 実績 {b.performedSetCount}セットが消える
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {mode === 'replaceDay' && (
                  <>
                    <p className="mt-2 mb-1 text-xs font-bold text-red-600 dark:text-red-400">
                      削除(新しいプランに無い種目) {preview.removeBlocks.length} 件
                    </p>
                    <ul className="max-h-24 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                      {preview.removeBlocks.map((b, i) => (
                        <li key={i}>
                          {blockLabel(b)} — {b.setCount}セット
                          {b.performedSetCount > 0 && (
                            <span className="ml-1 font-bold">
                              ⚠ うち実績 {b.performedSetCount}セット
                            </span>
                          )}
                        </li>
                      ))}
                      {preview.removeBlocks.length === 0 && (
                        <li className="text-slate-400">削除される種目はありません</li>
                      )}
                    </ul>
                  </>
                )}
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
                disabled={
                  busy ||
                  preview.errors.length > 0 ||
                  (preview.addBlocks.length === 0 &&
                    preview.overwriteBlocks.length === 0 &&
                    preview.removeBlocks.length === 0)
                }
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
