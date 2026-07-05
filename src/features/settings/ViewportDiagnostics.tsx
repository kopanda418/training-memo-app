import { useRef, useState } from 'react'

interface Info {
  label: string
  value: string
}

/**
 * タブバー下の空間問題の調査用パネル(原因特定後に削除予定)。
 * どのレイヤーで画面の高さが失われているかを数値で見えるようにする。
 */
export function ViewportDiagnostics() {
  const safeProbeRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<Info[]>([])

  const collect = () => {
    const nav = navigator as Navigator & { standalone?: boolean }
    const vv = window.visualViewport
    const result: Info[] = [
      {
        label: 'スタンドアロン判定',
        value: `display-mode: ${matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'} / navigator.standalone: ${String(nav.standalone)}`,
      },
      { label: 'screen.height(物理)', value: `${screen.height}px` },
      { label: 'window.innerHeight', value: `${window.innerHeight}px` },
      {
        label: 'documentElement.clientHeight',
        value: `${document.documentElement.clientHeight}px`,
      },
      { label: 'visualViewport.height', value: vv ? `${Math.round(vv.height)}px` : '非対応' },
      {
        label: 'visualViewport.offsetTop / pageTop',
        value: vv ? `${Math.round(vv.offsetTop)} / ${Math.round(vv.pageTop)}px` : '非対応',
      },
      { label: 'window.scrollY', value: `${Math.round(window.scrollY)}px` },
      {
        label: 'safe-area-inset-bottom(実測)',
        value: safeProbeRef.current ? `${safeProbeRef.current.offsetHeight}px` : '-',
      },
      { label: 'devicePixelRatio', value: String(window.devicePixelRatio) },
      {
        label: '差分(screen − innerHeight)',
        value: `${screen.height - window.innerHeight}px`,
      },
    ]
    setRows(result)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-bold">画面診断(タブバー問題の調査用)</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        「計測する」を押して表示された数値のスクリーンショットを開発側に共有してください
      </p>
      {/* env() の実値を測るためのプローブ(高さ = safe-area-inset-bottom) */}
      <div
        ref={safeProbeRef}
        aria-hidden
        className="invisible absolute"
        style={{ height: 'env(safe-area-inset-bottom)' }}
      />
      <button
        type="button"
        className="mt-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white active:bg-sky-700"
        onClick={collect}
      >
        計測する
      </button>
      {rows.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 text-xs dark:divide-slate-800">
          {rows.map((row) => (
            <li key={row.label} className="flex justify-between gap-2 py-1">
              <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
              <span className="tabular text-right font-bold">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
