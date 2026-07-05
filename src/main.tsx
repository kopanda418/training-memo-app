import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './app/App'
import { installViewportFix } from './app/viewportFix'
import './index.css'

registerSW({ immediate: true })

// iOS スタンドアロン PWA の既知バグ対策:
// キーボードが入力欄を隠しそうなとき OS がページ全体を上へスクロールさせるが、
// キーボードを閉じた後もスクロールが戻らず、アプリ全体が上へズレて下部に空間が残ることがある。
// 入力終了時とビューポート変化時に強制的に原点へ戻す。
const restoreViewport = () => {
  const active = document.activeElement
  const isTyping =
    active instanceof HTMLElement && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
  if (!isTyping) window.scrollTo(0, 0)
}
document.addEventListener('focusout', () => setTimeout(restoreViewport, 50))
window.visualViewport?.addEventListener('resize', () => setTimeout(restoreViewport, 50))

// タブバー位置の補正(環境依存のため設定で切替。詳細は app/viewportFix.ts)
installViewportFix()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
