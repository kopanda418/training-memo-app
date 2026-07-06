import { useEffect } from 'react'
import { useSetting } from '../db/settings'

export type Theme = 'light' | 'dark' | 'system'

/** テーマ設定を <html> の dark クラスと theme-color メタに反映する(デフォルトはダーク) */
export function ThemeApplier() {
  const theme = useSetting<Theme>('theme') ?? 'dark'

  useEffect(() => {
    const mql = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mql.matches)
      document.documentElement.classList.toggle('dark', dark)
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#020617' : '#ffffff')
    }
    apply()
    if (theme === 'system') {
      mql.addEventListener('change', apply)
      return () => mql.removeEventListener('change', apply)
    }
  }, [theme])

  return null
}
