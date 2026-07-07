import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 描画中の例外を捕捉して復帰用 UI を出す。
 * これがないと例外時に画面全体が真っ暗になり(タブバーのみ残る)、原因も追えない(#1 対策)。
 * ボタンで状態をリセットして再描画を試み、それでも直らなければリロードを促す。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 実機で原因を追えるようコンソールへ残す
    console.error('画面描画エラー:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-sm font-bold">画面の表示中にエラーが発生しました</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            記録データは保存されています。下のボタンで再表示できます
          </p>
          <button
            type="button"
            className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white active:bg-sky-700"
            onClick={() => this.setState({ error: null })}
          >
            再表示する
          </button>
          <button
            type="button"
            className="text-xs text-sky-600 dark:text-sky-400"
            onClick={() => window.location.reload()}
          >
            それでも直らない場合はこちら(再読み込み)
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
