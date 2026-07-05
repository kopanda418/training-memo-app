import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './app/App'
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

// WebKit の既知バグ対策(実測で確認済み):
// ステータスバー透過のスタンドアロン PWA では、描画キャンバスは画面全体に及ぶのに
// レイアウトビューポートがステータスバー分だけ短く画面上端に固定されるため、
// fixed 要素の bottom:0 が物理画面よりステータスバー高ぶん上に来る。
// 差分(screen.height - innerHeight)と safe-area-inset-top の小さい方を補正量として
// --bottom-gap に設定し、App のコンテナとモーダルを下へ延長する。バグのない環境では 0。
const updateViewportGap = () => {
  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  let gap = 0
  if (standalone) {
    const missing = screen.height - window.innerHeight
    const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat'))
    if (missing > 0 && Number.isFinite(safeTop) && safeTop > 0) {
      gap = Math.min(missing, safeTop)
    }
  }
  document.documentElement.style.setProperty('--bottom-gap', `${gap}px`)
}
updateViewportGap()
window.addEventListener('resize', () => setTimeout(updateViewportGap, 50))
window.addEventListener('orientationchange', () => setTimeout(updateViewportGap, 300))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
