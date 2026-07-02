import { useState } from 'react'

interface NumberFieldProps {
  value: number
  step: number
  min?: number
  /** true なら整数のみ(inputmode=numeric) */
  integer?: boolean
  suffix?: string
  onCommit: (value: number) => void
}

/**
 * −/＋ ステッパー付き数値入力。
 * ステッパーは即時コミット、直接入力は blur / Enter でコミット(記録入力の応答速度要件)
 */
export function NumberField({ value, step, min = 0, integer, suffix, onCommit }: NumberFieldProps) {
  const [text, setText] = useState(String(value))
  // 外から value が変わったら表示テキストを追従させる(レンダー中の派生 state 調整パターン)
  const [lastValue, setLastValue] = useState(value)
  if (lastValue !== value) {
    setLastValue(value)
    setText(String(value))
  }

  const clamp = (n: number) => Math.round(Math.max(min, n) * 100) / 100

  const commitText = () => {
    const n = Number(text)
    if (Number.isFinite(n) && text.trim() !== '') {
      onCommit(clamp(integer ? Math.round(n) : n))
    } else {
      setText(String(value))
    }
  }

  const btnClass =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 text-lg leading-none text-slate-600 active:bg-slate-200 dark:border-slate-600 dark:text-slate-300 dark:active:bg-slate-700'

  return (
    <div className="flex items-center gap-1">
      <button type="button" className={btnClass} onClick={() => onCommit(clamp(value - step))}>
        −
      </button>
      <div className="flex items-baseline">
        <input
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          className="w-12 bg-transparent text-center text-base font-bold"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
      </div>
      <button type="button" className={btnClass} onClick={() => onCommit(clamp(value + step))}>
        ＋
      </button>
    </div>
  )
}
