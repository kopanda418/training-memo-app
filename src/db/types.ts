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

/** 1 日 1 レコード。トレーニング場所とその日全体の感想メモをここに持つ */
export interface Day {
  /** YYYY-MM-DD(端末ローカル) */
  date: string
  locationId?: string
  /** その日のトレーニング全体の感想(体調・環境など) */
  note?: string
}

/**
 * 種目×タグブロック(その日のその種目)の感想メモ。
 * ブロックは永続レコードを持たない(sets の集合)ため、感想は複合主キー
 * [date+exerciseId+tagId] のこのテーブルに別立てで持つ。タグ/種目変更・別日移動時は
 * repository 側でキーを追従させる(架構は architecture.md / ADR-011 参照)。
 */
export interface BlockNote {
  date: string
  exerciseId: string
  /** タグなしは NO_TAG ('') */
  tagId: string
  note: string
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
  /** ウォームアップセットか(週間集計・MAX 判定から除外される。属性とは別の第一級フラグ) */
  isWarmup?: boolean
  /** 実績レップ数 */
  reps: number
  /** RPE(自覚的運動強度。8.5 など小数可) */
  rpe?: number
  /** セット属性(任意テキスト、複数可。例: 左・フル・DS) */
  attributes?: string[]
  /** @deprecated v5 で attributes[] に移行。目標レップも廃止(RPE 欄に置換) */
  targetReps?: number
  /** @deprecated v5 で attributes[] に移行。過去データ互換のため型に残す */
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
  /** v6: 管理画面での並び替え用(旧データは lastUsedAt 降順で初期化) */
  sortOrder: number
}

/** セット属性の入力候補(属性バンク) */
export interface SetAttribute {
  id: string
  name: string
  lastUsedAt: number
  /** v6: 管理画面での並び替え用(旧データは lastUsedAt 降順で初期化) */
  sortOrder: number
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
