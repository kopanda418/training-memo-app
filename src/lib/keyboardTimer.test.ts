import { describe, expect, it } from 'vitest'
import { floatingBottom, isKeyboardOpen, keyboardHeight } from './keyboardTimer'

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

describe('floatingBottom', () => {
  it('キーボードの上端から 8px 上に置く', () => {
    expect(floatingBottom({ innerHeight: 750, viewportHeight: 460 })).toBe(298)
  })

  it('レイアウトビューポートごと縮む端末(キーボード高さ 0)では画面下端に置く', () => {
    // この場面では innerHeight 自体がキーボードの上までしかないので 8px で正しい
    expect(floatingBottom({ innerHeight: 460, viewportHeight: 460 })).toBe(8)
  })
})
