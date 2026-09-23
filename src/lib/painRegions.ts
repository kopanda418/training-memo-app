/**
 * 痛み記録の部位・選択肢の定義(ADR-014)。
 * DB には画像ではなくここの ID(文字コード)だけを保存する。
 * 部位の分割は整形外科の診察で使う単位に合わせている。
 * ID は保存データのキーなので、一度リリースしたら変更・削除しないこと(追加のみ可)
 */

/** 患者本人から見た左右。C=中央(体幹の正中)、B=両側 */
export type PainSide = 'R' | 'L' | 'B' | 'C'

export const SIDE_LABELS: Record<PainSide, string> = { R: '右', L: '左', B: '両側', C: '中央' }

export interface PainRegion {
  id: string
  label: string
}

export interface PainArea {
  id: string
  label: string
  /** limb=手足・肩など左右がある部位 / axial=首・背中・腰など体の中心線上の部位 */
  kind: 'limb' | 'axial'
  regions: PainRegion[]
}

const area = (
  id: string,
  label: string,
  kind: PainArea['kind'],
  regions: [string, string][],
): PainArea => ({
  id,
  label,
  kind,
  regions: regions.map(([r, l]) => ({ id: `${id}.${r}`, label: l })),
})

export const PAIN_AREAS: PainArea[] = [
  // 頭痛は痛む場所で種類の見当がつく(例: 後頭部=首由来、こめかみ・目の奥=片頭痛や群発頭痛、
  // 頭全体の締め付け=緊張型)。顎関節は重い挙上時の食いしばりで痛めやすいので頭に含める
  area('head', '頭', 'axial', [
    ['frontal', 'おでこ(前頭部)'],
    ['temporal', 'こめかみ(側頭部)'],
    ['parietal', 'てっぺん(頭頂部)'],
    ['occipital', '後頭部(首との境目あたり)'],
    ['orbital', '目の奥・目のまわり'],
    ['whole', '頭全体'],
    ['jaw', '顎(顎関節・食いしばり)'],
  ]),
  area('neck', '首(頸部)', 'axial', [
    ['posterior', '後ろ(うなじ)'],
    ['lateral', '横'],
    ['base', '付け根〜肩の上(僧帽筋上部)'],
    ['anterior', '前'],
  ]),
  area('shoulder', '肩', 'limb', [
    ['anterior', '前側'],
    ['lateral', '外側(三角筋)'],
    ['posterior', '後ろ側'],
    ['superior', '上(肩鎖関節のあたり)'],
    ['deep', '奥の方(場所がはっきりしない)'],
  ]),
  area('upperArm', '上腕', 'limb', [
    ['anterior', '前側(力こぶ・上腕二頭筋)'],
    ['posterior', '後ろ側(上腕三頭筋)'],
  ]),
  area('elbow', '肘', 'limb', [
    ['lateral', '外側(外側上顆・テニス肘の場所)'],
    ['medial', '内側(内側上顆・ゴルフ肘の場所)'],
    ['posterior', '後ろ(肘頭・肘の先)'],
    ['anterior', '前(肘の内側のくぼみ)'],
  ]),
  area('forearm', '前腕', 'limb', [
    ['flexor', '手のひら側'],
    ['extensor', '手の甲側'],
  ]),
  area('wrist', '手首', 'limb', [
    ['radial', '親指側(橈側)'],
    ['ulnar', '小指側(尺側)'],
    ['dorsal', '甲側'],
    ['palmar', '手のひら側'],
  ]),
  area('hand', '手・指', 'limb', [
    ['thumb', '親指'],
    ['fingers', '指(親指以外)'],
    ['palm', '手のひら'],
    ['dorsum', '手の甲'],
  ]),
  area('chest', '胸', 'axial', [
    ['pectoral', '胸の筋肉(大胸筋)'],
    ['sternum', '胸の中央(胸骨)'],
    ['ribs', '肋骨・脇'],
  ]),
  area('abdomen', 'お腹', 'axial', [
    ['upper', '上の方'],
    ['lower', '下の方'],
    ['side', '脇腹'],
  ]),
  area('upperBack', '背中(胸椎部)', 'axial', [
    ['spine', '背骨そのもの(胸椎)'],
    ['paraspinal', '背骨のすぐ横の筋肉'],
    ['interscapular', '肩甲骨の間'],
    ['scapula', '肩甲骨まわり'],
  ]),
  area('lowBack', '腰(腰椎部)', 'axial', [
    ['spine', '背骨そのもの(腰椎)'],
    ['paraspinal', '背骨のすぐ横の筋肉'],
    ['sacroiliac', '骨盤の付け根(仙腸関節)'],
    ['sacrum', 'お尻の割れ目の上(仙骨・尾骨)'],
  ]),
  area('hip', '股関節', 'limb', [
    ['anterior', '前(脚の付け根・鼠径部)'],
    ['lateral', '外側(大転子のあたり)'],
    ['posterior', '後ろ'],
    ['deep', '奥の方(場所がはっきりしない)'],
  ]),
  area('buttock', 'お尻', 'limb', [
    ['gluteal', 'お尻の筋肉(臀筋)'],
    ['ischial', '座ると当たる骨(坐骨)'],
  ]),
  area('thigh', '太もも', 'limb', [
    ['anterior', '前(大腿四頭筋)'],
    ['posterior', '裏(ハムストリングス)'],
    ['medial', '内側(内転筋)'],
    ['lateral', '外側(腸脛靭帯)'],
  ]),
  area('knee', '膝', 'limb', [
    ['anterior', '前(膝のお皿まわり)'],
    ['infrapatellar', 'お皿のすぐ下(膝蓋腱)'],
    ['medial', '内側'],
    ['lateral', '外側'],
    ['posterior', '裏(膝窩)'],
  ]),
  area('lowerLeg', 'すね・ふくらはぎ', 'limb', [
    ['anterior', 'すね(前)'],
    ['medial', 'すねの内側(シンスプリントの場所)'],
    ['posterior', 'ふくらはぎ'],
  ]),
  area('ankle', '足首', 'limb', [
    ['lateral', '外側(外くるぶしのまわり)'],
    ['medial', '内側(内くるぶしのまわり)'],
    ['anterior', '前'],
    ['posterior', '後ろ(アキレス腱)'],
  ]),
  area('foot', '足', 'limb', [
    ['plantar', '足の裏'],
    ['heel', 'かかと'],
    ['dorsum', '足の甲'],
    ['toes', '足の指'],
  ]),
]

const areaById = new Map(PAIN_AREAS.map((a) => [a.id, a]))
const regionById = new Map(PAIN_AREAS.flatMap((a) => a.regions.map((r) => [r.id, r])))

export function getPainArea(areaId: string): PainArea | undefined {
  return areaById.get(areaId)
}

/** regionId('knee.medial')から area ID('knee')を取り出す */
export function areaIdOf(regionId: string): string {
  return regionId.split('.')[0]
}

export function regionLabel(regionId: string): string {
  return regionById.get(regionId)?.label ?? regionId
}

export function areaLabel(areaId: string): string {
  return areaById.get(areaId)?.label ?? areaId
}

/** 選べる左右。手足は右/左/両側、体幹は中央/右/左/両側 */
export function sideOptions(areaId: string): PainSide[] {
  return getPainArea(areaId)?.kind === 'axial' ? ['C', 'R', 'L', 'B'] : ['R', 'L', 'B']
}

/** 見出し用: 「右 膝」「中央 腰(腰椎部)」 */
export function painTitle(areaId: string, side: PainSide): string {
  return `${SIDE_LABELS[side]} ${areaLabel(areaId)}`
}

export interface Choice {
  id: string
  label: string
}

/** 痛みの種類(複数選択) */
export const PAIN_QUALITIES: Choice[] = [
  { id: 'sharp', label: '鋭い(ズキッ)' },
  { id: 'throbbing', label: 'ズキズキ' },
  { id: 'dull', label: '鈍い・重だるい' },
  { id: 'tight', label: '張り・こわばり' },
  { id: 'numb', label: 'しびれ' },
  { id: 'radiating', label: '電気が走る・響く' },
  { id: 'burning', label: '焼けるよう' },
  { id: 'catching', label: '引っかかる' },
  { id: 'instability', label: '抜ける・ぐらつく' },
  { id: 'swelling', label: '腫れ' },
  { id: 'heat', label: '熱っぽい' },
  { id: 'stiff', label: '動かしにくい' },
  { id: 'pressing', label: '締め付けられる・圧迫感' },
]

/** 痛む時(複数選択) */
export const PAIN_TIMINGS: Choice[] = [
  { id: 'training', label: '運動中' },
  { id: 'after', label: '運動後' },
  { id: 'daily', label: '日常の動作' },
  { id: 'rest', label: 'じっとしていても' },
  { id: 'night', label: '夜・寝ている時' },
  { id: 'morning', label: '朝起きた時' },
  { id: 'pressure', label: '押すと痛い' },
]

/** 痛む動き(複数選択) */
export const PAIN_MOVEMENTS: Choice[] = [
  { id: 'push', label: '押す' },
  { id: 'pull', label: '引く' },
  { id: 'overhead', label: '腕を上げる' },
  { id: 'grip', label: '握る' },
  { id: 'squat', label: 'しゃがむ' },
  { id: 'hinge', label: '前かがみ' },
  { id: 'extend', label: '反らす' },
  { id: 'twist', label: 'ひねる' },
  { id: 'load', label: '体重をかける・着地' },
]

/** 発症の仕方(初めて記録する痛みで選ぶ。単一選択) */
export const PAIN_ONSETS: Choice[] = [
  { id: 'sudden', label: '急に(きっかけあり)' },
  { id: 'gradual', label: 'だんだん' },
  { id: 'unknown', label: 'わからない' },
]

const choiceLabel = (list: Choice[], id: string) => list.find((c) => c.id === id)?.label ?? id

export const qualityLabel = (id: string) => choiceLabel(PAIN_QUALITIES, id)
export const timingLabel = (id: string) => choiceLabel(PAIN_TIMINGS, id)
export const movementLabel = (id: string) => choiceLabel(PAIN_MOVEMENTS, id)
export const onsetLabel = (id: string) => choiceLabel(PAIN_ONSETS, id)

/**
 * 受診を急いだ方がよい頭痛か。運動中などに突然起きた頭痛・非常に強い頭痛は
 * 脳の血管のトラブル(くも膜下出血など)の可能性があるため、入力画面で注意を出す
 */
export function isHeadacheWarning(area: string, intensity: number, onset?: string): boolean {
  return area === 'head' && (onset === 'sudden' || intensity >= 8)
}

/** NRS(0〜10)の目安。受診時に医師がよく聞く尺度 */
export function nrsHint(n: number): string {
  if (n === 0) return '痛みなし'
  if (n <= 3) return '軽い'
  if (n <= 6) return '中くらい'
  if (n <= 9) return '強い'
  return '想像できる最悪の痛み'
}
