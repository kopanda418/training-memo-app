import { useState } from 'react'

interface CommitInputProps {
  value: string
  onCommit: (value: string) => void
  placeholder?: string
  className?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
}

/**
 * blur / Enter で確定するテキスト入力。
 * 1 打鍵ごとに DB へ書かず、確定時のみ onCommit する(記録入力の応答速度要件)
 */
export function CommitInput({
  value,
  onCommit,
  placeholder,
  className,
  inputMode = 'text',
}: CommitInputProps) {
  const [text, setText] = useState(value)
  // 外部から value が変わったら追従(レンダー中の派生 state 調整パターン)
  const [lastValue, setLastValue] = useState(value)
  if (lastValue !== value) {
    setLastValue(value)
    setText(value)
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
