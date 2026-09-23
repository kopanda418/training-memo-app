import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from '../../components/Modal'
import { deletePain, savePain, type PainInput } from '../../db/condition'
import { db } from '../../db/db'
import { useMasters } from '../../db/hooks'
import { listSetsByDate } from '../../db/repository'
import {
  PAIN_MOVEMENTS,
  PAIN_ONSETS,
  PAIN_QUALITIES,
  PAIN_TIMINGS,
  SIDE_LABELS,
  getPainArea,
  nrsHint,
  painTitle,
  sideOptions,
} from '../../lib/painRegions'
import { Chips, FieldLabel, ScaleButtons, painColor } from './controls'

interface PainEditorProps {
  /** 編集対象(id があれば既存の編集、なければ新規) */
  initial: PainInput
  onClose: () => void
}

/** 痛み 1 件(部位×左右)の入力シート。すべて選択式で、自由記述はメモ欄のみ */
export function PainEditor({ initial, onClose }: PainEditorProps) {
  const [draft, setDraft] = useState<PainInput>(initial)
  const area = getPainArea(draft.area)
  const { exerciseName } = useMasters()
  const set = <K extends keyof PainInput>(key: K, value: PainInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  // その日に記録した種目(関連種目の候補)
  const dayExerciseIds = useLiveQuery(
    async () => [...new Set((await listSetsByDate(draft.date)).map((s) => s.exerciseId))],
    [draft.date],
  )
  // 同じ部位×左右の過去記録が無ければ「始まり方」を聞く(初めての痛み)
  const hasEarlier = useLiveQuery(
    async () =>
      (await db.painRecords
        .where('[area+side]')
        .equals([draft.area, draft.side])
        .filter((p) => p.date < draft.date)
        .count()) > 0,
    [draft.area, draft.side, draft.date],
  )

  if (!area) return null

  const handleSave = async () => {
    await savePain(draft)
    onClose()
  }

  const handleDelete = async () => {
    if (draft.id) await deletePain(draft.id)
    onClose()
  }

  const exerciseChoices = (dayExerciseIds ?? []).map((id) => ({ id, label: exerciseName(id) }))

  return (
    <Modal open onClose={onClose} title={`${painTitle(draft.area, draft.side)}の痛み`}>
      <FieldLabel>左右</FieldLabel>
      <Chips
        single
        choices={sideOptions(draft.area).map((s) => ({ id: s, label: SIDE_LABELS[s] }))}
        selected={[draft.side]}
        onChange={(next) => next[0] && set('side', next[0] as PainInput['side'])}
      />

      <FieldLabel>場所(複数可)</FieldLabel>
      <Chips
        choices={area.regions}
        selected={draft.regionIds}
        onChange={(next) => set('regionIds', next)}
      />

      <FieldLabel>
        強さ(0=痛みなし 〜 10=最悪):{' '}
        <span className="text-slate-700 dark:text-slate-200">
          {draft.intensity} {nrsHint(draft.intensity)}
        </span>
      </FieldLabel>
      <ScaleButtons
        min={0}
        max={10}
        value={draft.intensity}
        colorOf={painColor}
        onChange={(n) => n !== undefined && set('intensity', n)}
      />

      <FieldLabel>痛みの種類</FieldLabel>
      <Chips
        choices={PAIN_QUALITIES}
        selected={draft.qualities}
        onChange={(next) => set('qualities', next)}
      />

      <FieldLabel>痛む時</FieldLabel>
      <Chips
        choices={PAIN_TIMINGS}
        selected={draft.timings}
        onChange={(next) => set('timings', next)}
      />

      <FieldLabel>痛む動き</FieldLabel>
      <Chips
        choices={PAIN_MOVEMENTS}
        selected={draft.movements}
        onChange={(next) => set('movements', next)}
      />

      {(hasEarlier === false || draft.onset) && (
        <>
          <FieldLabel>始まり方(初めての痛み)</FieldLabel>
          <Chips
            single
            choices={PAIN_ONSETS}
            selected={draft.onset ? [draft.onset] : []}
            onChange={(next) => set('onset', next[0])}
          />
        </>
      )}

      <FieldLabel>関連しそうな種目(この日の記録から)</FieldLabel>
      {exerciseChoices.length > 0 ? (
        <Chips
          choices={exerciseChoices}
          selected={draft.exerciseIds}
          onChange={(next) => set('exerciseIds', next)}
        />
      ) : (
        <p className="text-xs text-slate-400">この日の種目の記録はありません</p>
      )}

      <FieldLabel>メモ(任意)</FieldLabel>
      <textarea
        rows={2}
        className="w-full resize-none rounded-lg border border-slate-300 bg-transparent px-2 py-1.5 text-sm dark:border-slate-600"
        placeholder="きっかけ・気づいたこと など"
        value={draft.note ?? ''}
        onChange={(e) => set('note', e.target.value)}
      />

      <div className="mt-4 flex gap-2">
        {draft.id && (
          <button
            type="button"
            className="rounded-lg border border-red-300 px-4 py-2.5 text-sm text-red-500 active:bg-red-50 dark:border-red-800 dark:active:bg-red-950"
            onClick={() => void handleDelete()}
          >
            削除
          </button>
        )}
        <button
          type="button"
          className="flex-1 rounded-lg bg-sky-600 py-2.5 text-sm font-bold text-white active:bg-sky-700"
          onClick={() => void handleSave()}
        >
          保存
        </button>
      </div>
    </Modal>
  )
}
