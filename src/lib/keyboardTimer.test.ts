import { describe, expect, it } from 'vitest'
import { anchoredTop, isKeyboardOpen, keyboardHeight } from './keyboardTimer'

describe('isKeyboardOpen', () => {
  it('キーボードが閉じていれば false', () => {
    expect(isKeyboardOpen({ innerHeight: 750, viewportHeight: 750 })).toBe(false)
  })

  it('アドレスバー伸縮程度の差(60px)は無視する', () => {
    expect(isKeyboardOpen({ innerHeight: 750, viewportHeight: 690 })).toBe(false)
  })

  it('数字キーボードが開いていれば true', () => {
    expect(isKeyboardOpen({ innerHeight: 750, viewportHeight: 460 })).toBe(true)
  })
})

describe('keyboardHeight', () => {
  it('負にはならない', () => {
    expect(keyboardHeight({ innerHeight: 700, viewportHeight: 780 })).toBe(0)
  })
})

describe('anchoredTop', () => {
  it('入力欄の真上(48px 上)に置く', () => {
    // 入力欄 top=500 / 高さ44、可視領域の上端は 200
    expect(anchoredTop({ inputTop: 500, inputBottom: 544, scrollTop: 200 })).toBe(452)
  })

  it('スクロール量が変わっても入力欄との位置関係は変わらない', () => {
    expect(anchoredTop({ inputTop: 500, inputBottom: 544, scrollTop: 0 })).toBe(452)
  })

  it('入力欄が可視領域の一番上にあるときは真下へ回す', () => {
    // 上に置くと 452 で、可視領域の上端 500 より上=画面外になる
    expect(anchoredTop({ inputTop: 500, inputBottom: 544, scrollTop: 500 })).toBe(552)
  })

  it('境界: 真上に GAP 分の余白が残るならそのまま上に置く', () => {
    expect(anchoredTop({ inputTop: 500, inputBottom: 544, scrollTop: 444 })).toBe(452)
    expect(anchoredTop({ inputTop: 500, inputBottom: 544, scrollTop: 445 })).toBe(552)
  })

  it('コンテンツ先頭付近でも上に 48px 取れるなら上に置く', () => {
    // 可視領域の上端は 0 なので、top=12 は画面内に収まる
    expect(anchoredTop({ inputTop: 60, inputBottom: 100, scrollTop: 0 })).toBe(12)
  })

  it('コンテンツの一番上に張り付いた入力欄は真下へ回す', () => {
    expect(anchoredTop({ inputTop: 8, inputBottom: 48, scrollTop: 0 })).toBe(56)
  })
})
