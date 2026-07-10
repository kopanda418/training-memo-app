import { useState } from 'react'

interface CommitInputProps {
  value: string
  onCommit: (value: string) => void
  placeholder?: string
  className?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
  /** 複数行(textarea)にする。感想メモなど改行を許可したい入力向け。Enter は改行に使い、確定は blur のみ */
  multiline?: boolean
}

/**
 * blur / Enter で確定するテキスト入力。
 * 1 打鍵ごとに DB へ書かず、確定時のみ onCommit する(記録入力の応答速度要件)。
 * multiline=true では textarea になり、Enter は改行(確定は blur のみ)。
 */
export function CommitInput({
  value,
  onCommit,
  placeholder,
  className,
  inputMode = 'text',
  multiline = false,
}: CommitInputProps) {
  const [text, setText] = useState(value)
  // 外部から value が変わったら追従(レンダー中の派生 state 調整パターン)
  const [lastValue, setLastValue] = useState(value)
  if (lastValue !== value) {
    setLastValue(value)
    setText(value)
  }

  if (multiline) {
    return (
      <textarea
        className={className}
        placeholder={placeholder}
        value={text}
        rows={1}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== value) onCommit(text)
        }}
      />
    )
  }

  return (
    <input
      type="text"
      inputMode={inputMode}
      className={className}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => {
        if (text !== value) onCommit(text)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}
