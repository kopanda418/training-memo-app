import { describe, expect, it } from 'vitest'
import { consumeRecordScroll, saveRecordScroll } from './recordScroll'

// フック・DOM 依存関数(useRestoreRecordScroll / getRecordScrollPos)は
// node 環境ではテストしない。純粋なストアの意味論のみ検証する。

const pos480 = { top: 480, anchor: { key: 'ex|tag|0', offset: 120 } }

describe('recordScroll store', () => {
  it('保存した日付と一致する consume は top を返す', () => {
    saveRecordScroll('2026-07-16', pos480)
    expect(consumeRecordScroll('2026-07-16')).toEqual(pos480)
  })

  it('consume は一度きり(2 回目は null)', () => {
    saveRecordScroll('2026-07-16', pos480)
    consumeRecordScroll('2026-07-16')
    expect(consumeRecordScroll('2026-07-16')).toBeNull()
  })

  it('日付が不一致なら null を返し、保存値もクリアする', () => {
    saveRecordScroll('2026-07-16', pos480)
    expect(consumeRecordScroll('2026-07-15')).toBeNull()
    // クリア済みなので一致する日付でももう返らない
    expect(consumeRecordScroll('2026-07-16')).toBeNull()
  })

  it('再保存で上書きされる', () => {
    saveRecordScroll('2026-07-16', { top: 100 })
    saveRecordScroll('2026-07-15', { top: 250 })
    expect(consumeRecordScroll('2026-07-15')).toEqual({ top: 250 })
  })

  it('未保存時の consume は null', () => {
    expect(consumeRecordScroll('2026-07-16')).toBeNull()
  })
})
