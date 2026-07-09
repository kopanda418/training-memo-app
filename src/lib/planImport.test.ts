import { describe, expect, it } from 'vitest'
import { NO_TAG } from '../db/types'
import {
  computePlanActions,
  setKeyOf,
  validatePlanImportFile,
  type ExistingPlanData,
  type PlanImportFile,
} from './planImport'

const baseFile = (days: PlanImportFile['days']): PlanImportFile => ({
  app: 'training-memo-app',
  kind: 'plan-import',
  formatVersion: 1,
  days,
})

const emptyExisting = (): ExistingPlanData => ({
  exercises: [],
  tags: [],
  bodyPartNames: new Set(),
  dayDates: new Set(),
  setKeys: new Set(),
})

describe('validatePlanImportFile', () => {
  it('accepts a well-formed file', () => {
    const file = baseFile([
      {
        date: '2026-07-14',
        items: [{ exercise: 'ベンチプレス', bodyPart: '胸', sets: [{ weight: 60 }] }],
      },
    ])
    expect(validatePlanImportFile(file)).toEqual(file)
  })

  it('rejects wrong app id', () => {
    expect(() => validatePlanImportFile({ ...baseFile([]), app: 'other-app' })).toThrow()
  })

  it('rejects backup files (kind mismatch)', () => {
    expect(() => validatePlanImportFile({ ...baseFile([]), kind: undefined })).toThrow()
  })

  it('rejects future format versions', () => {
    expect(() => validatePlanImportFile({ ...baseFile([]), formatVersion: 99 })).toThrow()
  })

  it('rejects a set without weight', () => {
    const file = {
      ...baseFile([]),
      days: [
        { date: '2026-07-14', items: [{ exercise: 'ベンチプレス', bodyPart: '胸', sets: [{}] }] },
      ],
    }
    expect(() => validatePlanImportFile(file)).toThrow()
  })
})

describe('computePlanActions', () => {
  it('creates a new exercise and tag, adds the block with reps left as given', () => {
    const file = baseFile([
      {
        date: '2026-07-14',
        location: 'ホームジム',
        items: [
          {
            exercise: 'ベンチプレス',
            bodyPart: '胸',
            tag: '高重量',
            sets: [{ weight: 80, memo: '目標 5reps' }],
          },
        ],
      },
    ])
    const actions = computePlanActions(file, emptyExisting())
    expect(actions.createExercises).toEqual([{ name: 'ベンチプレス', bodyPart: '胸' }])
    expect(actions.createTags).toEqual([{ name: '高重量' }])
    expect(actions.newDays).toEqual([{ date: '2026-07-14', location: 'ホームジム' }])
    expect(actions.addBlocks).toEqual([
      {
        date: '2026-07-14',
        exerciseName: 'ベンチプレス',
        tagName: '高重量',
        sets: [{ weight: 80, memo: '目標 5reps' }],
      },
    ])
    expect(actions.skipBlocks).toEqual([])
    expect(actions.errors).toEqual([])
  })

  it('errors when a new exercise has no bodyPart', () => {
    const file = baseFile([
      { date: '2026-07-14', items: [{ exercise: '謎の種目', sets: [{ weight: 10 }] }] },
    ])
    const actions = computePlanActions(file, emptyExisting())
    expect(actions.errors).toHaveLength(1)
    expect(actions.addBlocks).toEqual([])
    expect(actions.createExercises).toEqual([])
  })

  it('matches an existing exercise/tag by name and does not recreate them', () => {
    const existing: ExistingPlanData = {
      exercises: [{ id: 'ex-1', name: 'ベンチプレス' }],
      tags: [{ id: 'tag-1', name: '高重量' }],
      bodyPartNames: new Set(['胸']),
      dayDates: new Set(['2026-07-14']),
      setKeys: new Set(),
    }
    const file = baseFile([
      {
        date: '2026-07-14',
        items: [{ exercise: 'ベンチプレス', tag: '高重量', sets: [{ weight: 80 }] }],
      },
    ])
    const actions = computePlanActions(file, existing)
    expect(actions.createExercises).toEqual([])
    expect(actions.createTags).toEqual([])
    expect(actions.newDays).toEqual([])
    expect(actions.addBlocks).toHaveLength(1)
  })

  it('skips a block when a set already exists for date+exercise+tag', () => {
    const existing: ExistingPlanData = {
      exercises: [{ id: 'ex-1', name: 'ベンチプレス' }],
      tags: [],
      bodyPartNames: new Set(['胸']),
      dayDates: new Set(['2026-07-14']),
      setKeys: new Set([setKeyOf('2026-07-14', 'ex-1', NO_TAG)]),
    }
    const file = baseFile([
      { date: '2026-07-14', items: [{ exercise: 'ベンチプレス', sets: [{ weight: 80 }] }] },
    ])
    const actions = computePlanActions(file, existing)
    expect(actions.addBlocks).toEqual([])
    expect(actions.skipBlocks).toEqual([
      { date: '2026-07-14', exerciseName: 'ベンチプレス', tagName: undefined },
    ])
  })

  it('never skips a newly-created exercise or tag (no existing sets can reference it)', () => {
    const existing: ExistingPlanData = {
      exercises: [],
      tags: [],
      bodyPartNames: new Set(),
      dayDates: new Set(),
      setKeys: new Set(),
    }
    const file = baseFile([
      {
        date: '2026-07-14',
        items: [{ exercise: '新種目', bodyPart: '腕', sets: [{ weight: 10 }] }],
      },
    ])
    const actions = computePlanActions(file, existing)
    expect(actions.skipBlocks).toEqual([])
    expect(actions.addBlocks).toHaveLength(1)
  })

  it('creates a new bodyPart when a new exercise uses one not in the master', () => {
    const file = baseFile([
      {
        date: '2026-07-14',
        items: [{ exercise: '新種目', bodyPart: '体幹', sets: [{ weight: 10 }] }],
      },
    ])
    const actions = computePlanActions(file, emptyExisting())
    expect(actions.createBodyParts).toEqual(['体幹'])
  })

  it('does not recreate a bodyPart that already exists in the master', () => {
    const existing: ExistingPlanData = {
      exercises: [],
      tags: [],
      bodyPartNames: new Set(['腕']),
      dayDates: new Set(),
      setKeys: new Set(),
    }
    const file = baseFile([
      {
        date: '2026-07-14',
        items: [{ exercise: '新種目', bodyPart: '腕', sets: [{ weight: 10 }] }],
      },
    ])
    const actions = computePlanActions(file, existing)
    expect(actions.createBodyParts).toEqual([])
  })

  it('deduplicates a new bodyPart referenced by multiple new exercises', () => {
    const file = baseFile([
      {
        date: '2026-07-14',
        items: [
          { exercise: 'プランク', bodyPart: '体幹', sets: [{ weight: 0 }] },
          { exercise: 'デッドバグ', bodyPart: '体幹', sets: [{ weight: 0 }] },
        ],
      },
    ])
    const actions = computePlanActions(file, emptyExisting())
    expect(actions.createBodyParts).toEqual(['体幹'])
    expect(actions.createExercises).toHaveLength(2)
  })

  it('only lists a day once as newDays even if referenced by multiple items across the file', () => {
    const file = baseFile([
      {
        date: '2026-07-14',
        items: [
          { exercise: 'ベンチプレス', bodyPart: '胸', sets: [{ weight: 80 }] },
          { exercise: 'スクワット', bodyPart: '脚', sets: [{ weight: 100 }] },
        ],
      },
    ])
    const actions = computePlanActions(file, emptyExisting())
    expect(actions.newDays).toEqual([{ date: '2026-07-14', location: undefined }])
  })

  it('deduplicates a new exercise referenced on multiple days', () => {
    const file = baseFile([
      {
        date: '2026-07-14',
        items: [{ exercise: 'ベンチプレス', bodyPart: '胸', sets: [{ weight: 80 }] }],
      },
      { date: '2026-07-21', items: [{ exercise: 'ベンチプレス', sets: [{ weight: 82.5 }] }] },
    ])
    const actions = computePlanActions(file, emptyExisting())
    expect(actions.createExercises).toEqual([{ name: 'ベンチプレス', bodyPart: '胸' }])
    expect(actions.addBlocks).toHaveLength(2)
    expect(actions.errors).toEqual([])
  })
})
