import { CommitInput } from '../../components/CommitInput'
import { setSetting, useSetting } from '../../db/settings'

export function SettingsPage() {
  const bodyWeight = useSetting<number>('bodyWeight')

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-lg font-bold">設定</h1>

      <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <h2 className="text-sm font-bold">体重(自重入力用)</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          記録画面の「自重」ボタンでこの値が重量欄に入ります(懸垂・ディップスなど)
        </p>
        <div className="mt-2 flex items-center gap-2">
          <CommitInput
            inputMode="decimal"
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-right text-base font-bold dark:border-slate-600 dark:bg-slate-700"
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

      <p className="text-xs text-slate-400">
        テーマ・単位・種目/タグ管理・バックアップの設定は今後のマイルストーンで追加予定
      </p>
    </div>
  )
}
