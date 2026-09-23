import type { PainRecord } from '../db/types'
import {
  movementLabel,
  onsetLabel,
  painTitle,
  qualityLabel,
  regionLabel,
  timingLabel,
} from './painRegions'

/** 'YYYY-MM-DD' → 'YYYY/M/D' */
function slashDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${y}/${m}/${d}`
}

/** 出現回数の多い順に「ラベル(n回)」で並べる(1 回きりは回数を省略) */
function countLabels(lists: string[][], toLabel: (id: string) => string): string {
  const counts = new Map<string, number>()
  for (const list of lists) for (const id of list) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => (n > 1 ? `${toLabel(id)}(${n}回)` : toLabel(id)))
    .join('、')
}

/** 1 件分の短い説明(経過リスト・一覧用) */
export function describePain(p: PainRecord, exerciseName: (id: string) => string): string {
  const parts = [
    p.regionIds.map(regionLabel).join('・'),
    p.qualities.map(qualityLabel).join('・'),
    p.timings.map(timingLabel).join('・'),
    p.movements.length ? `痛む動き: ${p.movements.map(movementLabel).join('・')}` : '',
    p.exerciseIds.length ? `種目: ${p.exerciseIds.map(exerciseName).join('・')}` : '',
    p.note ?? '',
  ]
  return parts.filter(Boolean).join(' / ')
}

/**
 * 受診時に医師へ見せる要約テキスト(部位×左右 1 グループ分)。
 * records は同じ area×side の記録(順不同)
 */
export function buildPainSummary(
  records: PainRecord[],
  exerciseName: (id: string) => string,
): string {
  if (records.length === 0) return ''
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const max = Math.max(...sorted.map((p) => p.intensity))
  const onset = sorted.find((p) => p.onset)?.onset

  const lines = [
    `【${painTitle(first.area, first.side)}】`,
    `記録期間: ${slashDate(first.date)}〜${slashDate(last.date)}(${sorted.length}回)`,
    `痛みの強さ(0〜10): 最新 ${last.intensity} / 最大 ${max} / 初回 ${first.intensity}`,
  ]
  if (onset) lines.push(`始まり方: ${onsetLabel(onset)}`)
  const fields: [string, string][] = [
    [
      '場所',
      countLabels(
        sorted.map((p) => p.regionIds),
        regionLabel,
      ),
    ],
    [
      '痛みの種類',
      countLabels(
        sorted.map((p) => p.qualities),
        qualityLabel,
      ),
    ],
    [
      '痛む時',
      countLabels(
        sorted.map((p) => p.timings),
        timingLabel,
      ),
    ],
    [
      '痛む動き',
      countLabels(
        sorted.map((p) => p.movements),
        movementLabel,
      ),
    ],
    [
      '関連しそうな種目',
      countLabels(
        sorted.map((p) => p.exerciseIds),
        exerciseName,
      ),
    ],
  ]
  for (const [label, value] of fields) if (value) lines.push(`${label}: ${value}`)
  lines.push('経過:')
  for (const p of sorted) {
    const detail = describePain(p, exerciseName)
    lines.push(`  ${slashDate(p.date)} 強さ${p.intensity}${detail ? ` ${detail}` : ''}`)
  }
  return lines.join('\n')
}
