import type { PainSide } from '../../lib/painRegions'

export type BodyView = 'front' | 'back'

type Geom =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }

interface ShapeDef {
  area: string
  /** 'pair' は画面左側の座標で定義し、右側は左右反転して自動生成する */
  layout: 'pair' | 'center'
  geom: Geom
  /** タップ時に最初から選んでおく細かい部位(図の向きで決まるもの) */
  front?: string
  back?: string
  /** その向きの図にだけ出す */
  only?: BodyView
}

const R = (x: number, y: number, w: number, h: number): Geom => ({ kind: 'rect', x, y, w, h })
const E = (cx: number, cy: number, rx: number, ry: number): Geom => ({
  kind: 'ellipse',
  cx,
  cy,
  rx,
  ry,
})

// 描画順 = 重なり順(後ろほど上。背骨の帯は左右の半分より後に置いてタップを優先させる)
const SHAPES: ShapeDef[] = [
  {
    area: 'neck',
    layout: 'center',
    geom: R(90, 44, 20, 14),
    front: 'neck.anterior',
    back: 'neck.posterior',
  },
  {
    area: 'chest',
    layout: 'pair',
    geom: R(78, 60, 22, 32),
    front: 'chest.pectoral',
    only: 'front',
  },
  {
    area: 'chest',
    layout: 'center',
    geom: R(96, 62, 8, 28),
    front: 'chest.sternum',
    only: 'front',
  },
  { area: 'abdomen', layout: 'center', geom: R(80, 94, 40, 36), only: 'front' },
  {
    area: 'upperBack',
    layout: 'pair',
    geom: R(78, 60, 22, 34),
    back: 'upperBack.scapula',
    only: 'back',
  },
  {
    area: 'upperBack',
    layout: 'center',
    geom: R(96, 60, 8, 34),
    back: 'upperBack.spine',
    only: 'back',
  },
  {
    area: 'lowBack',
    layout: 'pair',
    geom: R(80, 96, 20, 34),
    back: 'lowBack.paraspinal',
    only: 'back',
  },
  {
    area: 'lowBack',
    layout: 'center',
    geom: R(96, 96, 8, 34),
    back: 'lowBack.spine',
    only: 'back',
  },
  {
    area: 'shoulder',
    layout: 'pair',
    geom: E(66, 68, 13, 11),
    front: 'shoulder.anterior',
    back: 'shoulder.posterior',
  },
  {
    area: 'upperArm',
    layout: 'pair',
    geom: R(51, 80, 14, 38),
    front: 'upperArm.anterior',
    back: 'upperArm.posterior',
  },
  {
    area: 'elbow',
    layout: 'pair',
    geom: E(57, 124, 9, 8),
    front: 'elbow.anterior',
    back: 'elbow.posterior',
  },
  {
    area: 'forearm',
    layout: 'pair',
    geom: R(49, 132, 15, 35),
    front: 'forearm.flexor',
    back: 'forearm.extensor',
  },
  {
    area: 'wrist',
    layout: 'pair',
    geom: R(49, 168, 15, 10),
    front: 'wrist.palmar',
    back: 'wrist.dorsal',
  },
  {
    area: 'hand',
    layout: 'pair',
    geom: E(56, 190, 9, 12),
    front: 'hand.palm',
    back: 'hand.dorsum',
  },
  { area: 'hip', layout: 'pair', geom: R(80, 132, 20, 20), front: 'hip.anterior', only: 'front' },
  {
    area: 'buttock',
    layout: 'pair',
    geom: R(80, 132, 20, 26),
    back: 'buttock.gluteal',
    only: 'back',
  },
  {
    area: 'thigh',
    layout: 'pair',
    geom: R(81, 154, 18, 58),
    front: 'thigh.anterior',
    only: 'front',
  },
  {
    area: 'thigh',
    layout: 'pair',
    geom: R(81, 160, 18, 52),
    back: 'thigh.posterior',
    only: 'back',
  },
  {
    area: 'knee',
    layout: 'pair',
    geom: E(90, 221, 10, 9),
    front: 'knee.anterior',
    back: 'knee.posterior',
  },
  {
    area: 'lowerLeg',
    layout: 'pair',
    geom: R(82, 231, 16, 55),
    front: 'lowerLeg.anterior',
    back: 'lowerLeg.posterior',
  },
  {
    area: 'ankle',
    layout: 'pair',
    geom: R(82, 287, 16, 10),
    front: 'ankle.anterior',
    back: 'ankle.posterior',
  },
  {
    area: 'foot',
    layout: 'pair',
    geom: E(89, 305, 10, 7),
    front: 'foot.dorsum',
    back: 'foot.heel',
  },
]

const mirror = (g: Geom): Geom =>
  g.kind === 'rect' ? { ...g, x: 200 - g.x - g.w } : { ...g, cx: 200 - g.cx }

export interface BodyMapSelection {
  area: string
  side: PainSide
  /** 図の向きから推定した細かい部位(無ければ未選択で開く) */
  regionId?: string
}

interface BodyMapProps {
  view: BodyView
  /** `${area}|${side}` → 強さ(0〜10)。記録済みの場所を色付けする */
  marked: Map<string, number>
  onSelect: (sel: BodyMapSelection) => void
}

/** 強さに応じた塗り(0 は緑=回復、1〜10 は黄→赤) */
function intensityFill(n: number): string {
  if (n === 0) return 'hsl(150 55% 55%)'
  return `hsl(${Math.round(48 - n * 4.8)} 90% ${Math.round(62 - n * 1.5)}%)`
}

/**
 * タップで痛む場所を選ぶ人体図(ADR-014: 図は入力手段のみ。保存するのは部位コード)。
 * 左右は本人から見た左右。正面図は画面の左が「右」、背面図は画面の左が「左」
 */
export function BodyMap({ view, marked, onSelect }: BodyMapProps) {
  const items = SHAPES.filter((s) => !s.only || s.only === view).flatMap((s) => {
    const regionId = view === 'front' ? s.front : s.back
    if (s.layout === 'center') return [{ ...s, geom: s.geom, side: 'C' as PainSide, regionId }]
    // 画面左側の図形: 正面なら本人の右、背面なら本人の左
    const leftSide: PainSide = view === 'front' ? 'R' : 'L'
    const rightSide: PainSide = view === 'front' ? 'L' : 'R'
    return [
      { ...s, geom: s.geom, side: leftSide, regionId },
      { ...s, geom: mirror(s.geom), side: rightSide, regionId },
    ]
  })

  // 体幹の部位で中央・両側に記録がある場合も色を付ける
  const levelOf = (area: string, side: PainSide) =>
    marked.get(`${area}|${side}`) ?? marked.get(`${area}|B`)

  return (
    <svg
      viewBox="0 0 200 320"
      className="mx-auto block w-full max-w-[280px] select-none"
      role="group"
      aria-label={view === 'front' ? '人体図(正面)' : '人体図(背面)'}
    >
      <text x="30" y="20" className="fill-slate-400 text-[11px]" textAnchor="middle">
        {view === 'front' ? '右' : '左'}
      </text>
      <text x="170" y="20" className="fill-slate-400 text-[11px]" textAnchor="middle">
        {view === 'front' ? '左' : '右'}
      </text>
      <circle cx="100" cy="24" r="17" className="fill-slate-200 dark:fill-slate-700" />
      {items.map((it) => {
        const level = levelOf(it.area, it.side)
        const common = {
          className:
            level === undefined
              ? 'cursor-pointer fill-slate-200 stroke-white active:fill-sky-300 dark:fill-slate-700 dark:stroke-slate-950 dark:active:fill-sky-700'
              : 'cursor-pointer stroke-white dark:stroke-slate-950',
          style: level === undefined ? undefined : { fill: intensityFill(level) },
          strokeWidth: 1.5,
          onClick: () => onSelect({ area: it.area, side: it.side, regionId: it.regionId }),
        }
        const key = `${it.area}-${it.side}-${it.layout}`
        return it.geom.kind === 'rect' ? (
          <rect
            key={key}
            x={it.geom.x}
            y={it.geom.y}
            width={it.geom.w}
            height={it.geom.h}
            rx={5}
            {...common}
          />
        ) : (
          <ellipse
            key={key}
            cx={it.geom.cx}
            cy={it.geom.cy}
            rx={it.geom.rx}
            ry={it.geom.ry}
            {...common}
          />
        )
      })}
    </svg>
  )
}
