import { showToast } from '../../components/Toast'
import { getSetting } from '../../db/settings'
import { runNativeTimer } from './nativeTimer'
import { DEFAULT_SOUND, playSound, type SoundId } from './sounds'

/**
 * インターバルタイマーのグローバルストア(useSyncExternalStore 用)。
 * - 残り時間は endsAt(絶対時刻)から計算するため、レンダリングの遅延に影響されない
 * - iOS 制約: 音はユーザー操作起点で AudioContext を resume しておく必要がある(開始タップ時に実施)
 * - Wake Lock はタイマー動作中のみ取得し、タブ復帰時(visibilitychange)に再取得する
 */

export interface TimerState {
  /** 終了予定時刻(epoch ms)。null = 停止中 */
  endsAt: number | null
  /** 開始時の合計秒数 */
  totalSec: number
  overlayOpen: boolean
}

let state: TimerState = { endsAt: null, totalSec: 0, overlayOpen: false }
const listeners = new Set<() => void>()

function setState(patch: Partial<TimerState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function subscribeTimer(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTimerState(): TimerState {
  return state
}

export function remainingSeconds(): number {
  return state.endsAt ? Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)) : 0
}

// ---- 内部: 終了検知・音・Wake Lock ----

let audioCtx: AudioContext | null = null
let wakeLock: WakeLockSentinel | null = null
let watcher: number | undefined

/** ユーザー操作起点で AudioContext を用意/resume する(iOS で音を鳴らす前提条件) */
function ensureAudio(): AudioContext {
  audioCtx ??= new AudioContext()
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  return audioCtx
}

/** 終了音を鳴らす。設定タブの試聴でも使う(操作起点で呼ばれるので resume 済み) */
export async function previewSound(id: SoundId) {
  playSound(ensureAudio(), id)
}

async function playFinishSound() {
  if (!audioCtx) return
  const id = (await getSetting<SoundId>('timerSound')) ?? DEFAULT_SOUND
  playSound(audioCtx, id)
}

async function requestWakeLock() {
  try {
    if (!('wakeLock' in navigator)) return
    wakeLock = await navigator.wakeLock.request('screen')
  } catch {
    // 低電力モードなどで拒否されることがある(タイマー自体は動く)
  }
}

function releaseWakeLock() {
  void wakeLock?.release().catch(() => {})
  wakeLock = null
}

function stopWatcher() {
  if (watcher !== undefined) {
    clearInterval(watcher)
    watcher = undefined
  }
}

function finish() {
  stopWatcher()
  releaseWakeLock()
  void playFinishSound()
  setState({ endsAt: null })
  showToast('⏱ インターバル終了!')
}

function startWatcher() {
  stopWatcher()
  watcher = window.setInterval(() => {
    if (state.endsAt && Date.now() >= state.endsAt) finish()
  }, 250)
}

// タブ復帰時: タイマーが動いていれば Wake Lock を取り直す(iOS は非表示で自動解除される)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.endsAt) {
    void (async () => {
      if ((await getSetting<boolean>('wakeLockEnabled')) ?? true) await requestWakeLock()
    })()
  }
})

// ---- 前回タイマー値(キーボード上の浮動ボタンのワンタップ起動に使う) ----

const LAST_SEC_KEY = 'timer.lastSec'

function loadLastSec(): number {
  const n = Number(localStorage.getItem(LAST_SEC_KEY))
  return Number.isFinite(n) && n > 0 ? n : 60
}

let lastTimerSec = loadLastSec()

/** 直近に開始したタイマー秒数(浮動ボタンはこの値で即開始する) */
export function getLastTimerSec(): number {
  return lastTimerSec
}

function rememberLastSec(sec: number) {
  lastTimerSec = sec
  try {
    localStorage.setItem(LAST_SEC_KEY, String(sec))
  } catch {
    // プライベートモード等で失敗してもメモリ内 lastTimerSec は保持されるので実害なし
  }
}

/**
 * タイマー開始の共通経路。ネイティブ連携 ON なら iOS 時計アプリへ委譲、OFF なら Web Audio タイマー。
 * ネイティブ URL 遷移・AudioContext resume は「ユーザー操作起点で同期的に」行う必要があるため、
 * 設定値は呼び出し側(コンポーネント)が useSetting で解決して渡す。開始秒数は前回値として記録する。
 */
export function beginInterval(
  sec: number,
  opts: { nativeEnabled: boolean; shortcutName: string },
): void {
  if (sec <= 0) return
  rememberLastSec(sec)
  if (opts.nativeEnabled) {
    // 時計アプリへ遷移するので、復帰時に残らないようボトムシートは閉じておく
    runNativeTimer(sec, opts.shortcutName)
    closeTimerOverlay()
  } else {
    void startTimer(sec)
  }
}

// ---- 公開アクション ----

export function openTimerOverlay() {
  setState({ overlayOpen: true })
}

export function closeTimerOverlay() {
  setState({ overlayOpen: false })
}

export async function startTimer(sec: number) {
  if (sec <= 0) return
  // ユーザー操作起点でないと iOS で音が出ないため、ここで AudioContext を用意して resume する
  ensureAudio()
  setState({ endsAt: Date.now() + sec * 1000, totalSec: sec })
  startWatcher()
  if ((await getSetting<boolean>('wakeLockEnabled')) ?? true) await requestWakeLock()
}

export function stopTimer() {
  stopWatcher()
  releaseWakeLock()
  setState({ endsAt: null })
}

export function extendTimer(sec: number) {
  if (!state.endsAt) return
  setState({ endsAt: state.endsAt + sec * 1000, totalSec: state.totalSec + sec })
}
