import type { Choice } from '../../lib/painRegions'

interface ScaleButtonsProps {
  min: number
  max: number
  value: number | undefined
  onChange: (value: number | undefined) => void
  /** 数値 → 選択時の背景色 */
  colorOf: (n: number) => string
  /** 選択中をもう一度タップで解除できるか */
  clearable?: boolean
}

/** 数値を 1 タップで選ぶボタン列(体調・やる気 1〜10、痛みの強さ 0〜10) */
export function ScaleButtons({ min, max, value, onChange, colorOf, clearable }: ScaleButtonsProps) {
  const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <div className="flex gap-1">
      {nums.map((n) => {
        const selected = value === n
        return (
          <button
            key={n}
            type="button"
            aria-pressed={selected}
            className={`h-9 min-w-0 flex-1 rounded-md text-sm font-bold tabular ${
              selected
                ? 'text-white shadow'
                : 'bg-slate-100 text-slate-600 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:active:bg-slate-700'
            }`}
            style={selected ? { backgroundColor: colorOf(n) } : undefined}
            onClick={() => onChange(selected && clearable ? undefined : n)}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

/** 体調・やる気: 1(悪い)=赤 → 10(良い)=緑 */
export const goodnessColor = (n: number) => `hsl(${Math.round(((n - 1) / 9) * 130)} 65% 45%)`

/** 痛みの強さ: 0=緑、1〜10 は黄 → 赤 */
export const painColor = (n: number) =>
  n === 0 ? 'hsl(150 55% 40%)' : `hsl(${Math.round(45 - n * 4.5)} 85% ${Math.round(50 - n)}%)`

interface ChipsProps {
  choices: Choice[]
  selected: string[]
  onChange: (next: string[]) => void
  /** 単一選択(選び直すと置き換え、同じものをタップで解除) */
  single?: boolean
}

/** 選択式チップ(複数選択が既定) */
export function Chips({ choices, selected, onChange, single }: ChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {choices.map((c) => {
        const on = selected.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              on
                ? 'border-sky-600 bg-sky-600 font-bold text-white'
                : 'border-slate-300 text-slate-600 active:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-800'
            }`}
            onClick={() => {
              if (single) onChange(on ? [] : [c.id])
              else onChange(on ? selected.filter((id) => id !== c.id) : [...selected, c.id])
            }}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 mt-4 text-xs font-bold text-slate-500 dark:text-slate-400">{children}</h3>
  )
}
