/** デフォルトの部位(初期シード用。実体は bodyParts テーブルで、追加可能) */
export const DEFAULT_BODY_PARTS = ['胸', '背中', '脚', '肩', '腕', '腹', 'その他'] as const
/** 部位名(bodyParts テーブルの name を参照する自由文字列) */
export type BodyPart = string

/** 部位マスタ */
export interface BodyPartRow {
  id: string
  name: string
  sortOrder: number
}

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
  /** 重量。isBodyweight のときは「加重分」を意味する(0 = 純自重) */
  weight: number
  /** 自重で行ったセットか(表示は「自重」「自重+10kg」) */
  isBodyweight?: boolean
  /** 実績レップ数 */
  reps: number
  /** 目標レップ数(任意) */
  targetReps?: number
  /** セット属性(任意テキスト、1 セットに 1 つ。例: RPE9、ベルトなし、補助) */
  attribute?: string
  /** @deprecated 属性に置き換え(G3)。過去データ互換のため残す */
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

/** セット属性の入力候補(属性バンク) */
export interface SetAttribute {
  id: string
  name: string
  lastUsedAt: number
}

/** トレーニングメニューのテンプレート(種目×タグのリスト) */
export interface Template {
  id: string
  name: string
  items: { exerciseId: string; tagId: string }[]
  createdAt: number
}

export interface Setting {
  key: string
  value: unknown
}
