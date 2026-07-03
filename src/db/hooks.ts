import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { NO_TAG } from './types'

/** 種目・タグのマスタと名前解決関数(UI 共通) */
export function useMasters() {
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const tags = useLiveQuery(() => db.tags.toArray(), [])

  const exerciseName = useMemo(() => {
    const map = new Map(exercises?.map((e) => [e.id, e.name]))
    return (id: string) => map.get(id) ?? '(削除された種目)'
  }, [exercises])

  const tagName = useMemo(() => {
    const map = new Map(tags?.map((t) => [t.id, t.name]))
    return (id: string) => (id === NO_TAG ? undefined : (map.get(id) ?? '(削除されたタグ)'))
  }, [tags])

  return { exercises, tags, exerciseName, tagName }
}
