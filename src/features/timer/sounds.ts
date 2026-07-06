/**
 * タイマー終了音(Web Audio 合成)。音源ファイルは iOS PWA で不安定なため合成音で統一する。
 * 音楽再生中でも気づけるよう、既定はやや大きめの上昇メロディ。
 */

export type SoundId = 'rising' | 'risingLong' | 'triple' | 'buzzer'

interface Note {
  /** 開始オフセット秒 */
  at: number
  freq: number
  dur: number
  /** ピーク音量(0〜1 目安。複数音の合計が 1 を超えると歪むので注意) */
  gain: number
  type?: OscillatorType
}

const SOUNDS: Record<SoundId, { label: string; notes: Note[] }> = {
  // 既定: 5 音の上昇メロディ(大)。最後の音を長く強く鳴らして目立たせる
  rising: {
    label: '上昇メロディ(大)',
    notes: [
      { at: 0.0, freq: 523, dur: 0.14, gain: 0.9 },
      { at: 0.14, freq: 659, dur: 0.14, gain: 0.9 },
      { at: 0.28, freq: 784, dur: 0.14, gain: 0.9 },
      { at: 0.42, freq: 1047, dur: 0.5, gain: 1.0 },
    ],
  },
  risingLong: {
    label: '上昇メロディ(長）',
    notes: [
      { at: 0.0, freq: 523, dur: 0.16, gain: 0.9 },
      { at: 0.16, freq: 659, dur: 0.16, gain: 0.9 },
      { at: 0.32, freq: 784, dur: 0.16, gain: 0.9 },
      { at: 0.48, freq: 988, dur: 0.16, gain: 0.9 },
      { at: 0.64, freq: 1319, dur: 0.6, gain: 1.0 },
    ],
  },
  triple: {
    label: '3連ビープ',
    notes: [
      { at: 0.0, freq: 880, dur: 0.32, gain: 0.9 },
      { at: 0.4, freq: 880, dur: 0.32, gain: 0.9 },
      { at: 0.8, freq: 880, dur: 0.32, gain: 0.9 },
    ],
  },
  buzzer: {
    label: 'ブザー(低音）',
    notes: [
      { at: 0.0, freq: 220, dur: 0.6, gain: 1.0, type: 'square' },
      { at: 0.7, freq: 220, dur: 0.6, gain: 1.0, type: 'square' },
    ],
  },
}

export const SOUND_OPTIONS = (Object.keys(SOUNDS) as SoundId[]).map((id) => ({
  id,
  label: SOUNDS[id].label,
}))

export const DEFAULT_SOUND: SoundId = 'rising'

export function playSound(ctx: AudioContext, id: SoundId) {
  const sound = SOUNDS[id] ?? SOUNDS[DEFAULT_SOUND]
  const t0 = ctx.currentTime
  // マスターゲインで全体を底上げしつつ、リミッター的に上限を抑える
  const master = ctx.createGain()
  master.gain.value = 1.0
  master.connect(ctx.destination)
  for (const note of sound.notes) {
    const start = t0 + note.at
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = note.type ?? 'sine'
    osc.frequency.value = note.freq
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur)
    osc.connect(gain)
    gain.connect(master)
    osc.start(start)
    osc.stop(start + note.dur + 0.02)
  }
}
