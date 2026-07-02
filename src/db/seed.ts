import type { BodyPart, Exercise, Tag } from './types'

const DEFAULT_EXERCISES: Record<BodyPart, string[]> = {
  胸: [
    'ベンチプレス',
    'インクラインベンチプレス',
    'ダンベルプレス',
    'ダンベルフライ',
    'チェストプレス',
    'ペックフライ',
    'ディップス',
  ],
  背中: [
    'デッドリフト',
    'ラットプルダウン',
    'ベントオーバーロウ',
    'シーテッドロウ',
    'チンニング(懸垂)',
    'ワンハンドロウ',
  ],
  脚: [
    'スクワット',
    'レッグプレス',
    'レッグエクステンション',
    'レッグカール',
    'ブルガリアンスクワット',
    'カーフレイズ',
  ],
  肩: ['ショルダープレス', 'サイドレイズ', 'リアレイズ', 'フロントレイズ', 'アップライトロウ'],
  腕: [
    'バーベルカール',
    'ダンベルカール',
    'ハンマーカール',
    'トライセプスプレスダウン',
    'ナローベンチプレス',
    'スカルクラッシャー',
  ],
  腹: ['クランチ', 'レッグレイズ', 'アブローラー', 'プランク'],
  その他: [],
}

const DEFAULT_TAGS = ['高重量日', '中重量日', '低重量日']

export function buildDefaultExercises(): Exercise[] {
  const now = Date.now()
  const result: Exercise[] = []
  let order = 0
  for (const [bodyPart, names] of Object.entries(DEFAULT_EXERCISES) as [BodyPart, string[]][]) {
    for (const name of names) {
      result.push({
        id: crypto.randomUUID(),
        name,
        bodyPart,
        sortOrder: order++,
        isArchived: false,
        createdAt: now,
      })
    }
  }
  return result
}

export function buildDefaultTags(): Tag[] {
  const now = Date.now()
  return DEFAULT_TAGS.map((name, i) => ({
    id: crypto.randomUUID(),
    name,
    sortOrder: i,
    isArchived: false,
    createdAt: now,
  }))
}
