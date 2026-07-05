import { useEffect, useState } from 'react'

const EVENT_NAME = 'app-toast'

/** どこからでもトーストを出す(ToastHost が App 直下で待ち受ける) */
export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: message }))
}

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const handler = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail)
      clearTimeout(timer)
      timer = setTimeout(() => setMessage(null), 3500)
    }
    window.addEventListener(EVENT_NAME, handler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
      clearTimeout(timer)
    }
  }, [])

  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center">
      <div
        className="mx-3 mt-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg"
        style={{ marginTop: 'calc(env(safe-area-inset-top) + 8px)' }}
      >
        {message}
      </div>
    </div>
  )
}
