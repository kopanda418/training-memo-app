import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { CommitInput } from '../../components/CommitInput'
import { showToast } from '../../components/Toast'
import { exportData, importData } from '../../db/backup'
import { db } from '../../db/db'
import { DEFAULT_QUICK_SET_ATTRIBUTES, setSetting, useSetting } from '../../db/settings'
import { todayString } from '../../lib/date'
import { APP_VERSION } from '../../app/version'
import {
  MAX_BOTTOM_GAP,
  getBottomGapPx,
  measureGapCandidate,
  setBottomGapPx,
} from '../../app/viewportFix'
import { SOUND_OPTIONS, type SoundId } from '../timer/sounds'
import { previewSound } from '../timer/timerStore'
import { AttributePicker } from '../record/AttributePicker'
import { TagSelectModal } from './TagSelectModal'

const slotBtnClass =
  'flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm active:bg-slate-100 dark:border-slate-600 dark:active:bg-slate-700'

export function SettingsPage() {
  const navigate = useNavigate()
  const bodyWeight = useSetting<number>('bodyWeight')
  const wakeLockEnabled = useSetting<boolean>('wakeLockEnabled')
  const theme = useSetting<'light' | 'dark' | 'system'>('theme')
  const defaultUnit = useSetting<'kg' | 'lbs'>('defaultUnit')
  const timerSound = (useSetting<SoundId>('timerSound') ?? 'rising') as SoundId
  const quickAttrs = useSetting<string[]>('quickSetAttributes') ?? DEFAULT_QUICK_SET_ATTRIBUTES
  const quickTagIds = useSetting<string[]>('quickExerciseTagIds')
  const tags = useLiveQuery(() => db.tags.orderBy('sortOrder').toArray(), [])

  const [attrSlotOpen, setAttrSlotOpen] = useState<number | null>(null)
  const [tagSlotOpen, setTagSlotOpen] = useState<number | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [gapPx, setGapPx] = useState<number>(getBottomGapPx())

  const changeGapPx = (px: number) => {
    setBottomGapPx(px)
    setGapPx(getBottomGapPx())
  }

  const handleExport = async () => {
    const data = await exportData()
    const file = new File([JSON.stringify(data)], `training-memo-backup-${todayString()}.json`, {
      type: 'application/json',
    })
    // iOS では共有シート経由で「ファイルに保存」できる。非対応環境はダウンロード
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
      } catch {
        // 共有シートのキャンセルは正常系
      }
    } else {
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleImportFile = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (
        !window.confirm('現在のデータをすべてバックアップの内容に置き換えます。よろしいですか?')
      ) {
        return
      }
      await importData(parsed)
      showToast('バックアップから復元しました')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '復元に失敗しました')
    }
  }

  const activeTags = tags?.filter((t) => !t.isArchived) ?? []
  const effectiveTagIds = quickTagIds ?? activeTags.slice(0, 3).map((t) => t.id)
  const tagNameOf = (id: string) => activeTags.find((t) => t.id === id)?.name

  const setQuickAttr = (index: number, value: string) => {
    const next = [...quickAttrs]
    next[index] = value
    void setSetting('quickSetAttributes', next)
  }

  const setQuickTag = (index: number, tagId: string) => {
    const next = [...effectiveTagIds]
    next[index] = tagId
    void setSetting('quickExerciseTagIds', next)
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="flex items-baseline gap-2 text-lg font-bold">
        設定
        <span className="text-xs font-normal text-slate-400">{APP_VERSION}</span>
      </h1>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">テーマ</h2>
        <div className="mt-2 flex gap-2">
          {(
            [
              ['light', 'ライト'],
              ['dark', 'ダーク'],
              ['system', 'システム'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${
                (theme ?? 'dark') === value
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
              }`}
              onClick={() => void setSetting('theme', value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">重量の単位(新規セット)</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          既存セットの単位は変わりません。前セットからの引き継ぎが優先されます
        </p>
        <div className="mt-2 flex gap-2">
          {(['kg', 'lbs'] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${
                (defaultUnit ?? 'kg') === unit
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
              }`}
              onClick={() => void setSetting('defaultUnit', unit)}
            >
              {unit}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">体重(自重セットの 1RM 換算用)</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          自重セットの 1RM は「体重 + 加重」で換算します。未登録の場合、自重セットの 1RM
          は表示されません
        </p>
        <div className="mt-2 flex items-center gap-2">
          <CommitInput
            inputMode="decimal"
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-right text-base font-bold dark:border-slate-600 dark:bg-slate-800"
            value={bodyWeight != null ? String(bodyWeight) : ''}
            placeholder="例: 65"
            onCommit={(t) => {
              const n = Number(t)
              if (t.trim() !== '' && Number.isFinite(n) && n > 0) {
                void setSetting('bodyWeight', Math.round(n * 10) / 10)
              }
            }}
          />
          <span className="text-sm text-slate-500">kg</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">マスタ管理</h2>
        <div className="mt-2 flex flex-col gap-1.5">
          <button
            type="button"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700"
            onClick={() => navigate('/settings/exercises')}
          >
            種目・部位の管理 ›
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-700"
            onClick={() => navigate('/settings/attributes')}
          >
            タグ・属性・場所の管理 ›
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">セット属性のクイックボタン</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          セット行に表示される 3 つの即時入力ボタン。タップして作成済みの属性から選択(新規作成も可)
        </p>
        <div className="mt-2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              className={slotBtnClass}
              onClick={() => setAttrSlotOpen(i)}
            >
              {quickAttrs[i]?.trim() ? (
                quickAttrs[i]
              ) : (
                <span className="text-slate-400">未設定</span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">種目タグのクイックボタン</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          種目選択時のタグ工程に表示される 3 つのボタン。タップして作成済みのタグから選択
        </p>
        <div className="mt-2 flex gap-2">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              className={slotBtnClass}
              onClick={() => setTagSlotOpen(i)}
            >
              {tagNameOf(effectiveTagIds[i] ?? '') ?? (
                <span className="text-slate-400">未設定</span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">タイマー中の画面ロック防止</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          タイマー動作中に画面を消灯させません(iOS はロック中に音を鳴らせないため、オンを推奨)
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${
              (wakeLockEnabled ?? true)
                ? 'bg-sky-600 text-white'
                : 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
            }`}
            onClick={() => void setSetting('wakeLockEnabled', true)}
          >
            オン(推奨)
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${
              (wakeLockEnabled ?? true)
                ? 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
                : 'bg-sky-600 text-white'
            }`}
            onClick={() => void setSetting('wakeLockEnabled', false)}
          >
            オフ
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">タイマー終了音</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          選ぶとその場で試聴します。音楽再生中でも気づきやすい「上昇メロディ」がおすすめです
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {SOUND_OPTIONS.map((opt) => (
            <div key={opt.id} className="flex items-center gap-2">
              <button
                type="button"
                className={`flex-1 rounded-lg py-2.5 text-left text-sm font-bold ${
                  timerSound === opt.id
                    ? 'bg-sky-600 px-3 text-white'
                    : 'border border-slate-300 px-3 text-slate-600 dark:border-slate-600 dark:text-slate-300'
                }`}
                onClick={() => {
                  void setSetting('timerSound', opt.id)
                  void previewSound(opt.id)
                }}
              >
                {opt.label}
              </button>
              <button
                type="button"
                aria-label={`${opt.label}を試聴`}
                className="h-10 w-10 shrink-0 rounded-lg border border-slate-300 text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700"
                onClick={() => void previewSound(opt.id)}
              >
                ▶
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">バックアップ</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          全データ(記録・種目・タグ・設定・テンプレート)を 1 つの JSON
          ファイルに書き出し/復元できます。
          <span className="font-bold text-amber-500">
            ホーム画面のアイコンを削除するとデータも消えるため、定期的な書き出しを推奨します
          </span>
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg bg-sky-600 py-2.5 text-sm font-bold text-white active:bg-sky-700"
            onClick={() => void handleExport()}
          >
            書き出す
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-bold text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700"
            onClick={() => importInputRef.current?.click()}
          >
            復元する
          </button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImportFile(file)
            e.target.value = ''
          }}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold">タブバー位置の補正</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          タブバーの下に空間ができる場合、スライダーを動かすと
          <span className="font-bold">その場でタブバーが下に移動</span>
          します。空間がちょうど消える値に合わせてください(0 = 補正なし。参考:
          ビューポート短縮の実測値 {measureGapCandidate()}px)
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            aria-label="補正を1px減らす"
            className="h-9 w-9 shrink-0 rounded-full border border-slate-300 text-lg leading-none text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700"
            onClick={() => changeGapPx(gapPx - 1)}
          >
            −
          </button>
          <input
            type="range"
            min={0}
            max={MAX_BOTTOM_GAP}
            step={1}
            value={gapPx}
            className="min-w-0 flex-1 accent-sky-500"
            onChange={(e) => changeGapPx(Number(e.target.value))}
          />
          <button
            type="button"
            aria-label="補正を1px増やす"
            className="h-9 w-9 shrink-0 rounded-full border border-slate-300 text-lg leading-none text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700"
            onClick={() => changeGapPx(gapPx + 1)}
          >
            ＋
          </button>
          <span className="tabular w-12 shrink-0 text-right text-sm font-bold">{gapPx}px</span>
        </div>
      </section>

      <p className="text-xs text-slate-400">
        テーマ・単位・バックアップの設定は今後のマイルストーンで追加予定
      </p>

      {attrSlotOpen !== null && (
        <AttributePicker
          open
          current={quickAttrs[attrSlotOpen]?.trim() || undefined}
          onClose={() => setAttrSlotOpen(null)}
          onSelect={(name) => setQuickAttr(attrSlotOpen, name ?? '')}
        />
      )}
      {tagSlotOpen !== null && (
        <TagSelectModal
          open
          allowClear
          onClose={() => setTagSlotOpen(null)}
          onSelect={(tagId) => setQuickTag(tagSlotOpen, tagId ?? '')}
        />
      )}
    </div>
  )
}
