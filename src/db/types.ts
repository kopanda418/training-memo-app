/** 部位の一覧。表示順もこの順 */
export const BODY_PARTS = ['胸', '背中', '脚', '肩', '腕', '腹', 'その他'] as const
export type BodyPart = (typeof BODY_PARTS)[number]

export type WeightUnit = 'kg' | 'lbs'

/** タグなしを表す正規化値。複合インデックス [exerciseId+tagId] が undefined を引けないため空文字を使う (ADR-005) */
export const NO_TAG = ''

export interface Exercise {
  id: string
  name: string
  bodyPart: BodyPart
  sortOrder: number
  isArchived: boolean
  createdAt: number
}

export interface Tag {
  id: string
  name: string
  color?: string
  sortOrder: number
  isArchived: boolean
  createdAt: number
}

/** 1 日 1 レコード。トレーニング場所はここに持つ */
export interface Day {
  /** YYYY-MM-DD(端末ローカル) */
  date: string
  locationId?: string
  note?: string
}

export interface WorkoutSet {
  id: string
  /** YYYY-MM-DD */
  date: string
  exerciseId: string
  /** タグなしは NO_TAG ('') */
  tagId: string
  weight: number
  reps: number
  isAssisted: boolean
  unit: WeightUnit
  memo?: string
  /** 日内の表示順 */
  orderInDay: number
  createdAt: number
}

export interface Location {
  id: string
  name: string
  lastUsedAt: number
}

export interface Setting {
  key: string
  value: unknown
}
